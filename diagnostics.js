(function initializePrivacySafeDiagnostics() {
    const STORAGE_KEY = 'indyDiagnosticsSession_v1';
    const ALLOWED_AREAS = new Set(['calendar', 'account_sync', 'javascript']);
    const recent = new Map();

    function safeCode(error, fallback = 'unknown') {
        const raw = String(error?.code || error?.name || fallback).toLowerCase();
        const cleaned = raw.replace(/^firebase[/:_-]*/i, '').replace(/[^a-z0-9_-]/g, '_').slice(0, 48);
        return !cleaned || cleaned === 'error' ? fallback : cleaned;
    }

    function readSessionRecords() {
        try {
            const records = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(records) ? records.slice(-19) : [];
        } catch {
            return [];
        }
    }

    function report(area, error, fallbackCode = 'unknown') {
        if (!ALLOWED_AREAS.has(area)) return;
        const record = {
            area,
            code: safeCode(error, fallbackCode),
            online: navigator.onLine !== false,
            time: new Date().toISOString()
        };
        const signature = `${record.area}:${record.code}:${record.online}`;
        const now = Date.now();
        if (now - (recent.get(signature) || 0) < 60000) return;
        recent.set(signature, now);

        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...readSessionRecords(), record].slice(-20)));
        } catch {}

        // trackAnalyticsEvent already enforces the user's Analytics choice.
        // Only allowlisted labels are sent—never messages, URLs, stacks,
        // account IDs, schedule names, or user-entered text.
        window.trackAnalyticsEvent?.('app_error', {
            error_area: record.area,
            error_code: record.code,
            was_online: record.online
        });
    }

    window.reportAppError = report;
    window.getSessionDiagnostics = () => readSessionRecords().map((record) => ({ ...record }));

    window.addEventListener('error', (event) => {
        if (event.target !== window && event.target?.tagName !== 'SCRIPT') return;
        report('javascript', event.error, event.target !== window ? 'resource_load' : 'runtime');
    }, true);
    window.addEventListener('unhandledrejection', (event) => {
        report('javascript', event.reason, 'unhandled_promise');
    });
})();
