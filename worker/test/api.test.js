import test from 'node:test';
import assert from 'node:assert/strict';
import { corsOrigin, handleRequest, connect, assignments, setComplete, status, disconnect } from '../src/index.js';

class Statement {
    constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
    bind(...values) { this.values = values; return this; }
    async first() {
        if (this.sql.includes('schoology_connections')) return this.db.connections.get(this.values[0]) || null;
        return null;
    }
    async all() {
        if (this.sql.includes('completed_assignments')) {
            const prefix = `${this.values[0]}:`;
            return { results: [...this.db.completed.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ assignment_id: key.slice(prefix.length) })) };
        }
        return { results: [] };
    }
    async run() {
        const [uid, id] = this.values;
        if (this.sql.startsWith('INSERT INTO schoology_connections')) this.db.connections.set(uid, { encrypted_calendar_url: id, connected_at: this.values[2], updated_at: this.values[3] });
        if (this.sql.startsWith('INSERT INTO completed_assignments')) this.db.completed.set(`${uid}:${id}`, this.values[2]);
        if (this.sql.startsWith('DELETE FROM completed_assignments') && this.sql.includes('assignment_id')) this.db.completed.delete(`${uid}:${id}`);
        if (this.sql.startsWith('DELETE FROM completed_assignments') && !this.sql.includes('assignment_id')) {
            for (const key of this.db.completed.keys()) if (key.startsWith(`${uid}:`)) this.db.completed.delete(key);
        }
        if (this.sql.startsWith('DELETE FROM schoology_connections')) this.db.connections.delete(uid);
        return { success: true };
    }
}

class FakeDb {
    constructor() { this.connections = new Map(); this.completed = new Map(); }
    prepare(sql) { return new Statement(this, sql); }
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); }
}

test('missing Firebase bearer token is rejected', async () => {
    const response = await handleRequest(new Request('https://worker.test/api/schoology/status', { headers: { origin: 'https://indy-schedule.web.app' } }), { DB: new FakeDb() });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'auth-required');
});

test('malformed Firebase bearer token is rejected', async () => {
    const response = await handleRequest(new Request('https://worker.test/api/schoology/status', { headers: { origin: 'https://indy-schedule.web.app', authorization: 'Bearer not-a-jwt' } }), { DB: new FakeDb() });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'invalid-token');
});

test('CORS allows configured production origin and rejects arbitrary sites', () => {
    assert.equal(corsOrigin(new Request('https://worker.test', { headers: { origin: 'https://indy-schedule.web.app' } }), {}), 'https://indy-schedule.web.app');
    assert.equal(corsOrigin(new Request('https://worker.test', { headers: { origin: 'https://evil.example' } }), {}), '');
});

test('completion records are isolated by Firebase UID and can be restored', async () => {
    const db = new FakeDb();
    const id = 'a'.repeat(64);
    await setComplete({ DB: db }, 'user-one', id, true);
    await setComplete({ DB: db }, 'user-two', id, true);
    await setComplete({ DB: db }, 'user-one', id, false);
    assert.equal(db.completed.has(`user-one:${id}`), false);
    assert.equal(db.completed.has(`user-two:${id}`), true);
});

test('status and disconnect only affect the authenticated user', async () => {
    const db = new FakeDb();
    db.connections.set('user-one', { connected_at: 'one', updated_at: 'one' });
    db.connections.set('user-two', { connected_at: 'two', updated_at: 'two' });
    db.completed.set(`user-one:${'a'.repeat(64)}`, 'now');
    assert.equal((await status({ DB: db }, 'user-one')).connected, true);
    await disconnect({ DB: db }, 'user-one');
    assert.equal((await status({ DB: db }, 'user-one')).connected, false);
    assert.equal((await status({ DB: db }, 'user-two')).connected, true);
});

test('connect validates the feed, stores only ciphertext, and assignments remain user-isolated', async () => {
    const db = new FakeDb();
    const env = { DB: db, CALENDAR_ENCRYPTION_KEY: 'test-secret' };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:one\r\nDTSTART:20260920T120000Z\r\nSUMMARY:Essay\r\nEND:VEVENT\r\nEND:VCALENDAR', { status: 200, headers: { 'content-type': 'text/calendar' } });
    try {
        const result = await connect(new Request('https://worker.test/api/schoology/connect', { method: 'POST', body: JSON.stringify({ calendarUrl: 'webcal://app.schoology.com/calendar/feed/private-token' }) }), env, 'user-one');
        assert.equal(result.connected, true);
        assert.ok(!db.connections.get('user-one').encrypted_calendar_url.includes('private-token'));
        assert.equal((await status(env, 'user-one')).connected, true);
        assert.equal((await status(env, 'user-two')).connected, false);
        const first = await assignments(env, 'user-one');
        assert.equal(first.assignments[0].title, 'Essay');
        await assert.rejects(() => assignments(env, 'user-two'), (error) => error.code === 'not-connected');
    } finally { globalThis.fetch = originalFetch; }
});
