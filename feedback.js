// Paste your public Formspree form endpoint here. No API secret is needed.
const FORMSPREE_ENDPOINT = "https://formspree.io/f/mqpkggqq";

async function notifyFeedbackWithFormspree(feedback, feedbackId) {
    if (!/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(FORMSPREE_ENDPOINT)) {
        console.warn('Feedback notification skipped: formspree_not_configured');
        return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: controller.signal,
            body: JSON.stringify({
                category: feedback.category,
                message: feedback.message,
                name: feedback.name,
                email: feedback.email,
                school: 'Independence High School',
                uid: feedback.uid,
                pageUrl: feedback.pageUrl,
                feedbackId
            })
        });
        if (!response.ok) console.warn('Feedback notification failed: formspree_http_error');
    } catch {
        // Never log submitted content, email addresses, endpoint, or response bodies.
        console.warn('Feedback notification failed: formspree_network_or_timeout');
    } finally {
        clearTimeout(timeout);
    }
}

(() => {
    const form = document.getElementById('feedback-form');
    if (!form) return;
    const field = (name) => form.elements.namedItem(name);
    const button = document.getElementById('feedback-submit');
    const status = document.getElementById('feedback-status');
    const message = field('message');
    const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (localPreview) {
        const notice = document.createElement('p');
        notice.className = 'contact-action-note';
        notice.textContent = 'Local test mode: feedback is saved to the Firebase emulator. A configured Formspree endpoint will still send a real notification.';
        form.before(notice);
    }
    const categories = ['schedule', 'bug', 'suggestion', 'account', 'other'];
    let busy = false;
    let lastSent = 0;
    let authReady = false;
    let subscribed = false;
    const touched = new Set();
    ['name', 'email'].forEach((key) => field(key).addEventListener('input', () => touched.add(key)));
    const updateCount = () => {
        message.setCustomValidity('');
        document.getElementById('feedback-count').textContent = `${message.value.length.toLocaleString()} / 2,000`;
    };
    message.addEventListener('input', updateCount);
    function watchAuth() {
        if (subscribed || !window.authManager?.auth) return;
        subscribed = true;
        window.authManager.auth.onAuthStateChanged((user) => {
            authReady = true;
            for (const [key, value] of [['name', user?.displayName], ['email', user?.email]]) {
                if (!touched.has(key)) field(key).value = (value || '').slice(0, key === 'name' ? 100 : 254);
            }
        });
    }
    window.addEventListener('indy-firebase-ready', watchAuth);
    watchAuth();
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy) return;
        message.setCustomValidity(message.value.trim() ? '' : 'Please enter a message.');
        if (!form.reportValidity()) return;
        if (!categories.includes(field('category').value)) return;
        if (Date.now() - lastSent < 60000) {
            status.textContent = 'Please wait a minute before sending more feedback.';
            return;
        }
        busy = true;
        button.disabled = true;
        button.textContent = 'Sending...';
        form.setAttribute('aria-busy', 'true');
        status.textContent = '';
        const pendingNotice = setTimeout(() => {
            status.textContent = 'Still waiting for confirmation. Keep this page open to avoid sending twice.';
        }, 15000);
        const originalMessage = message.value;
        try {
            if (!navigator.onLine) throw Object.assign(new Error(), { code: 'offline' });
            if (!authReady) throw Object.assign(new Error(), { code: 'firebase-not-ready' });
            const user = window.authManager.auth.currentUser;
            const page = new URL(window.location.href);
            // Query strings and fragments can contain personal data or sign-in tokens.
            page.search = '';
            page.hash = '';
            const feedback = {
                category: field('category').value,
                message: originalMessage.trim(),
                name: field('name').value.trim(),
                email: field('email').value.trim(),
                uid: user?.uid || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'new',
                pageUrl: page.href.slice(0, 2048),
                appVersion: '1.3.5'
            };
            const savedFeedback = await firebase.firestore().collection('feedback').add(feedback);
            clearTimeout(pendingNotice);
            status.textContent = 'Feedback saved. Finishing submission…';
            await notifyFeedbackWithFormspree(feedback, savedFeedback.id);
            lastSent = Date.now();
            if (message.value === originalMessage) message.value = '';
            updateCount();
            status.textContent = localPreview ? 'Thanks! Your test feedback was saved in the Firestore emulator.' : 'Thanks! Your feedback has been sent.';
        } catch (error) {
            const code = ['permission-denied', 'offline', 'firebase-not-ready', 'unavailable', 'unauthenticated'].includes(error?.code)
                ? error.code : 'unknown';
            // Log only a fixed code, never the payload, credentials, or provider message.
            console.warn('Feedback submission failed:', code);
            if (code === 'permission-denied') {
                status.textContent = "Feedback is temporarily unavailable. Please use the support email below.";
            } else if (code === 'offline') {
                status.textContent = "You're offline. Reconnect and try again; your message is still here.";
            } else if (code === 'firebase-not-ready') {
                status.textContent = "Feedback is still connecting. Please wait a moment and try again.";
            } else {
                status.textContent = "We couldn't send your feedback. Please try again.";
            }
        } finally {
            clearTimeout(pendingNotice);
            busy = false;
            button.disabled = false;
            button.textContent = 'Send Feedback';
            form.setAttribute('aria-busy', 'false');
        }
    });
})();
