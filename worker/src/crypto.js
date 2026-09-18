function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}

function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function encryptionKey(secret) {
    if (!secret) throw new Error('CALENDAR_ENCRYPTION_KEY is not configured');
    let material;
    try { material = base64ToBytes(secret); }
    catch { material = new TextEncoder().encode(secret); }
    if (![16, 24, 32].includes(material.length)) material = new Uint8Array(await crypto.subtle.digest('SHA-256', material));
    return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptCalendarUrl(value, secret) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(secret), new TextEncoder().encode(value));
    return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptCalendarUrl(value, secret) {
    const [version, iv, encrypted] = String(value).split('.');
    if (version !== 'v1' || !iv || !encrypted) throw new Error('Invalid encrypted calendar value');
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, await encryptionKey(secret), base64ToBytes(encrypted));
    return new TextDecoder().decode(clear);
}
