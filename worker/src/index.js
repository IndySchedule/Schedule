import { bearerToken, verifyFirebaseToken } from './security.js';
import { normalizeCalendarUrl, parseAssignments } from './calendar.js';
import { decryptCalendarUrl, encryptCalendarUrl } from './crypto.js';

const DEFAULT_ORIGINS = new Set([
    'https://indy-schedule.web.app',
    'https://indy-schedule.firebaseapp.com',
    'https://indyschedule.com',
    'https://www.indyschedule.com',
    'https://schoolschedules.net',
    'https://www.schoolschedules.net'
]);

function allowedOrigins(env) {
    const configured = String(env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
    return new Set([...DEFAULT_ORIGINS, ...configured]);
}

function corsOrigin(request, env) {
    const origin = request.headers.get('origin');
    if (!origin) return null;
    if (allowedOrigins(env).has(origin)) return origin;
    if (env.ENVIRONMENT !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
    return '';
}

function json(request, env, body, status = 200) {
    const origin = corsOrigin(request, env);
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', vary: 'Origin' };
    if (origin) headers['access-control-allow-origin'] = origin;
    return new Response(JSON.stringify(body), { status, headers });
}

async function authenticatedUser(request, env) {
    return verifyFirebaseToken(bearerToken(request), { projectId: env.FIREBASE_PROJECT_ID || 'indyschedule-1' });
}

async function readJson(request) {
    try { return await request.json(); }
    catch { throw Object.assign(new Error('The request could not be read.'), { status: 400, code: 'invalid-request' }); }
}

async function fetchCalendar(url, fetchImpl = fetch) {
    const normalized = normalizeCalendarUrl(url);
    const response = await fetchImpl(normalized, {
        redirect: 'manual',
        headers: { accept: 'text/calendar, text/plain;q=0.9', 'user-agent': 'Indy-Schedule-Assignments/1.0' }
    });
    if (response.status >= 300 && response.status < 400) throw Object.assign(new Error('Schoology redirected the calendar unexpectedly.'), { status: 502, code: 'calendar-unavailable' });
    if (!response.ok) throw Object.assign(new Error('Schoology calendar is temporarily unavailable.'), { status: 502, code: 'calendar-unavailable' });
    const length = Number(response.headers.get('content-length') || 0);
    if (length > 2_000_000) throw Object.assign(new Error('The Schoology calendar is too large to process.'), { status: 422, code: 'invalid-calendar' });
    const text = await response.text();
    if (text.length > 2_000_000 || !text.includes('BEGIN:VCALENDAR')) throw Object.assign(new Error('That link did not return a valid Schoology calendar.'), { status: 422, code: 'invalid-calendar' });
    return text;
}

async function connect(request, env, uid) {
    const { calendarUrl } = await readJson(request);
    const normalized = normalizeCalendarUrl(calendarUrl);
    const ics = await fetchCalendar(normalized);
    await parseAssignments(ics);
    const encrypted = await encryptCalendarUrl(normalized, env.CALENDAR_ENCRYPTION_KEY);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO schoology_connections (firebase_uid, encrypted_calendar_url, connected_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(firebase_uid) DO UPDATE SET encrypted_calendar_url = excluded.encrypted_calendar_url, updated_at = excluded.updated_at`)
        .bind(uid, encrypted, now, now).run();
    return { connected: true };
}

async function status(env, uid) {
    const row = await env.DB.prepare('SELECT connected_at, updated_at FROM schoology_connections WHERE firebase_uid = ?').bind(uid).first();
    return { connected: !!row, connectedAt: row?.connected_at || null, lastSuccessfulRefresh: null };
}

async function disconnect(env, uid) {
    await env.DB.batch([
        env.DB.prepare('DELETE FROM completed_assignments WHERE firebase_uid = ?').bind(uid),
        env.DB.prepare('DELETE FROM schoology_connections WHERE firebase_uid = ?').bind(uid)
    ]);
    return { connected: false };
}

async function assignments(env, uid) {
    const connection = await env.DB.prepare('SELECT encrypted_calendar_url FROM schoology_connections WHERE firebase_uid = ?').bind(uid).first();
    if (!connection) throw Object.assign(new Error('Connect your Schoology calendar first.'), { status: 404, code: 'not-connected' });
    const calendarUrl = await decryptCalendarUrl(connection.encrypted_calendar_url, env.CALENDAR_ENCRYPTION_KEY);
    const parsed = await parseAssignments(await fetchCalendar(calendarUrl));
    const completed = await env.DB.prepare('SELECT assignment_id FROM completed_assignments WHERE firebase_uid = ?').bind(uid).all();
    const completedIds = new Set((completed.results || []).map((row) => row.assignment_id));
    return { assignments: parsed.map((item) => ({ ...item, completed: completedIds.has(item.id) })), fetchedAt: new Date().toISOString() };
}

async function setComplete(env, uid, assignmentId, complete) {
    if (!/^[a-f0-9]{64}$/.test(assignmentId)) throw Object.assign(new Error('Invalid assignment identifier.'), { status: 400, code: 'invalid-assignment' });
    if (complete) {
        await env.DB.prepare(`INSERT INTO completed_assignments (firebase_uid, assignment_id, completed_at) VALUES (?, ?, ?)
            ON CONFLICT(firebase_uid, assignment_id) DO UPDATE SET completed_at = excluded.completed_at`)
            .bind(uid, assignmentId, new Date().toISOString()).run();
    } else {
        await env.DB.prepare('DELETE FROM completed_assignments WHERE firebase_uid = ? AND assignment_id = ?').bind(uid, assignmentId).run();
    }
    return { assignmentId, completed: complete };
}

export async function handleRequest(request, env) {
    const origin = corsOrigin(request, env);
    if (request.headers.has('origin') && !origin) return json(request, env, { code: 'origin-not-allowed', message: 'This website is not allowed to use the API.' }, 403);
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: {
            'access-control-allow-origin': origin,
            'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
            'access-control-allow-headers': 'Authorization, Content-Type',
            'access-control-max-age': '86400', vary: 'Origin'
        } });
    }
    try {
        const { uid } = await authenticatedUser(request, env);
        const url = new URL(request.url);
        if (url.pathname === '/api/schoology/connect' && request.method === 'POST') return json(request, env, await connect(request, env, uid));
        if (url.pathname === '/api/schoology/status' && request.method === 'GET') return json(request, env, await status(env, uid));
        if (url.pathname === '/api/schoology/disconnect' && request.method === 'DELETE') return json(request, env, await disconnect(env, uid));
        if (url.pathname === '/api/assignments' && request.method === 'GET') return json(request, env, await assignments(env, uid));
        const match = url.pathname.match(/^\/api\/assignments\/([^/]+)\/complete$/);
        if (match && (request.method === 'POST' || request.method === 'DELETE')) {
            return json(request, env, await setComplete(env, uid, decodeURIComponent(match[1]), request.method === 'POST'));
        }
        return json(request, env, { code: 'not-found', message: 'API route not found.' }, 404);
    } catch (error) {
        const statusCode = Number(error.status) || 500;
        if (statusCode >= 500) console.error('Schoology API request failed', { code: error.code || 'internal-error', route: new URL(request.url).pathname });
        return json(request, env, {
            code: statusCode >= 500 ? (error.code || 'service-error') : (error.code || 'request-error'),
            message: statusCode >= 500 ? 'Schoology assignments are temporarily unavailable. Please try again.' : error.message
        }, statusCode);
    }
}

export default { fetch: handleRequest };
export { fetchCalendar, corsOrigin, connect, status, disconnect, assignments, setComplete };
