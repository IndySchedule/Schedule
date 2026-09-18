const PROJECT_ID = 'indyschedule-1';
const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let certificateCache = { values: null, expiresAt: 0 };

function base64UrlDecode(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(normalized);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function parseJwtPart(value) {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(value)));
}

async function getCertificates(fetchImpl = fetch) {
    if (certificateCache.values && Date.now() < certificateCache.expiresAt) return certificateCache.values;
    const response = await fetchImpl(JWK_URL);
    if (!response.ok) throw new Error('Unable to load token signing keys');
    const document = await response.json();
    const values = Object.fromEntries((document.keys || []).map((key) => [key.kid, key]));
    const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 3600);
    certificateCache = { values, expiresAt: Date.now() + Math.max(300, maxAge) * 1000 };
    return values;
}

export async function verifyFirebaseToken(token, options = {}) {
    if (!token || typeof token !== 'string') throw Object.assign(new Error('Authentication required'), { status: 401, code: 'auth-required' });
    const parts = token.split('.');
    if (parts.length !== 3) throw Object.assign(new Error('Invalid authentication token'), { status: 401, code: 'invalid-token' });
    let header;
    let payload;
    try { header = parseJwtPart(parts[0]); payload = parseJwtPart(parts[1]); }
    catch { throw Object.assign(new Error('Invalid authentication token'), { status: 401, code: 'invalid-token' }); }
    const projectId = options.projectId || PROJECT_ID;
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || !header.kid || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` ||
        typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128 || !Number.isFinite(payload.exp) || payload.exp <= now ||
        !Number.isFinite(payload.iat) || payload.iat > now + 300) {
        throw Object.assign(new Error('Expired or invalid authentication token'), { status: 401, code: 'invalid-token' });
    }
    const certificates = await getCertificates(options.fetchImpl);
    const signingJwk = certificates[header.kid];
    if (!signingJwk) throw Object.assign(new Error('Invalid authentication token'), { status: 401, code: 'invalid-token' });
    const key = await crypto.subtle.importKey('jwk', signingJwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlDecode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) throw Object.assign(new Error('Invalid authentication token'), { status: 401, code: 'invalid-token' });
    return { uid: payload.sub, email: payload.email || null };
}

export function bearerToken(request) {
    const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || '';
}

export function resetCertificateCacheForTests() {
    certificateCache = { values: null, expiresAt: 0 };
}
