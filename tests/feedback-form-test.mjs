import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../feedback.js', import.meta.url), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; };
function setup({ configured = true, save, send, user = null, valid = true } = {}) {
    const fields = Object.fromEntries(['category', 'message', 'name', 'email'].map(key => [key, {
        value: key === 'category' ? 'bug' : key === 'message' ? 'Test message' : '',
        addEventListener() {}, setCustomValidity(value) { this.validation = value; }
    }]));
    const elements = { 'feedback-submit': {}, 'feedback-status': {}, 'feedback-count': {} };
    let submit;
    elements['feedback-form'] = {
        elements: { namedItem: key => fields[key] },
        reportValidity: () => valid && !fields.message.validation,
        setAttribute() {}, before() {}, addEventListener: (_, fn) => { submit = fn; }
    };
    const writes = [], requests = [], warnings = [], timers = new Map();
    const firestore = () => ({ collection: name => {
        assert.equal(name, 'feedback');
        return { add: async data => { writes.push(data); return save ? save(data) : {id:'saved-id'}; } };
    } });
    firestore.FieldValue = { serverTimestamp: () => 'server-timestamp' };
    vm.runInNewContext(source.replace(/const FORMSPREE_ENDPOINT = "[^"]*";/, `const FORMSPREE_ENDPOINT = "${configured ? 'https://formspree.io/f/test123' : 'PASTE_ENDPOINT_HERE'}";`), {
        document: {getElementById: id => elements[id], createElement: () => ({})},
        location: {hostname:'example.com'},
        window: { location:{href:'https://example.com/?private=value#token'}, addEventListener() {},
            authManager: {auth: {currentUser:user, onAuthStateChanged: fn => fn(user)}} },
        navigator:{onLine:true}, firebase:{firestore}, URL, AbortController,
        console:{warn: (...args) => warnings.push(args)},
        fetch: async (url, options) => { requests.push({url, options}); return send ? send(url, options) : {ok:true}; },
        setTimeout: (fn, delay) => { const id = {}; timers.set(id,{fn,delay}); return id; },
        clearTimeout: id => timers.delete(id)
    });
    return {fields, elements, writes, requests, warnings, timers, submit: () => submit({preventDefault(){}})};
}
test('saves first, sends captured JSON and Auth UID, then clears the form', async () => {
    const saved = deferred();
    const h = setup({save:()=>saved.promise, user:{uid:'real-uid',displayName:'Test Name',email:'test@example.com'}});
    const pending = h.submit();
    assert.equal(h.requests.length,0);
    assert.equal(h.elements['feedback-submit'].disabled,true);
    h.fields.message.value = 'A new draft typed while waiting';
    saved.resolve({id:'saved-id'}); await pending;
    const req = h.requests[0]; const body = JSON.parse(req.options.body);
    assert.equal(req.options.method,'POST');
    assert.equal(req.options.headers.Accept,'application/json');
    assert.equal(req.options.headers['Content-Type'],'application/json');
    assert.equal(body.message,'Test message');
    assert.equal(body.uid,'real-uid');
    assert.equal(body.name,'Test Name');
    assert.equal(body.email,'test@example.com');
    assert.equal(body.school,'Independence High School');
    assert.equal(body.pageUrl,'https://example.com/');
    assert.equal(body.feedbackId,'saved-id');
    assert.equal(h.fields.message.value,'A new draft typed while waiting');
    assert.match(h.elements['feedback-status'].textContent,/Thanks!/);
    assert.equal(h.elements['feedback-submit'].disabled,false);
});
test('Firestore failure preserves message and never calls Formspree', async () => {
    const h = setup({save:()=>Promise.reject({code:'permission-denied'})});
    await h.submit();
    assert.equal(h.requests.length,0);
    assert.equal(h.fields.message.value,'Test message');
    assert.doesNotMatch(h.elements['feedback-status'].textContent,/Thanks!/);
});
test('HTTP and network notification failures still show successful submission', async () => {
    for (const send of [()=>({ok:false}), ()=>Promise.reject(new Error('sensitive provider data'))]) {
        const h = setup({send}); await h.submit();
        assert.equal(h.writes.length,1);
        assert.match(h.elements['feedback-status'].textContent,/Thanks!/);
        assert.equal(h.fields.message.value,'');
        assert.equal(h.warnings.length,1);
        assert(!JSON.stringify(h.warnings).includes('sensitive'));
    }
});
test('double clicks are blocked throughout the notification request', async () => {
    const notification = deferred(); const h = setup({send:()=>notification.promise});
    const pending = h.submit();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await h.submit();
    assert.equal(h.writes.length,1); assert.equal(h.requests.length,1);
    assert.equal(h.elements['feedback-submit'].disabled,true);
    notification.resolve({ok:true}); await pending;
    await h.submit();
    assert.equal(h.writes.length,1);
});
test('notification timeout releases the button and preserves success', async () => {
    const h = setup({send:(_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('timeout'))))});
    const pending = h.submit();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    [...h.timers.values()].find(timer=>timer.delay===10000).fn();
    await pending;
    assert.match(h.elements['feedback-status'].textContent,/Thanks!/);
    assert.equal(h.elements['feedback-submit'].disabled,false);
    assert.equal(h.timers.size,0);
});
test('placeholder endpoint skips notification while saving Firestore', async () => {
    const h = setup({configured:false}); await h.submit();
    assert.equal(h.requests.length,0); assert.equal(h.writes.length,1);
    assert.match(h.elements['feedback-status'].textContent,/Thanks!/);
    assert.match(h.warnings[0][0],/formspree_not_configured/);
});
test('invalid form never writes or sends', async () => {
    const h = setup({valid:false}); await h.submit();
    assert.equal(h.writes.length,0); assert.equal(h.requests.length,0);
});
