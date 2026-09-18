const SCHOOLGY_HOST = /(^|\.)schoology\.com$/i;

export function normalizeCalendarUrl(value) {
    if (typeof value !== 'string') throw Object.assign(new Error('Enter a valid Schoology calendar link.'), { status: 400, code: 'invalid-calendar-url' });
    const trimmed = value.trim();
    const normalized = trimmed.replace(/^webcal:\/\//i, 'https://');
    let url;
    try { url = new URL(normalized); }
    catch { throw Object.assign(new Error('Enter a valid Schoology calendar link.'), { status: 400, code: 'invalid-calendar-url' }); }
    if (url.protocol !== 'https:' || !SCHOOLGY_HOST.test(url.hostname) || url.username || url.password || url.port) {
        throw Object.assign(new Error('Use a Schoology calendar link from a schoology.com address.'), { status: 400, code: 'invalid-calendar-url' });
    }
    url.hash = '';
    return url.toString();
}

function unfoldIcs(value) {
    return value.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
}

function unescapeText(value = '') {
    return value.replace(/\\[nN]/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function zonedIso(parts, timeZone) {
    const intended = Date.UTC(...parts);
    let guess = intended;
    try {
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const shown = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
            const represented = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
            guess += intended - represented;
        }
        return new Date(guess).toISOString();
    } catch { return new Date(intended).toISOString(); }
}

function parseIcsDate(value, parameters = '') {
    if (!value) return null;
    const allDay = /VALUE=DATE/i.test(parameters) || /^\d{8}$/.test(value);
    if (allDay) {
        const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
        return match ? { iso: `${match[1]}-${match[2]}-${match[3]}T23:59:59Z`, allDay: true } : null;
    }
    const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
    if (!match) return null;
    if (match[7]) return { iso: `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}Z`, allDay: false };
    const timeZone = parameters.match(/TZID=([^;:]+)/i)?.[1] || 'America/Chicago';
    return { iso: zonedIso([Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0)], timeZone), allDay: false };
}

function property(line) {
    const divider = line.indexOf(':');
    if (divider < 0) return null;
    const left = line.slice(0, divider);
    const [name, ...params] = left.split(';');
    return { name: name.toUpperCase(), params: params.join(';'), value: line.slice(divider + 1) };
}

async function sha256(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function parseAssignments(ics, now = new Date()) {
    if (typeof ics !== 'string' || !ics.includes('BEGIN:VCALENDAR')) throw Object.assign(new Error('Schoology did not return a valid calendar.'), { status: 422, code: 'invalid-calendar' });
    const events = [];
    let current = null;
    for (const line of unfoldIcs(ics)) {
        if (line === 'BEGIN:VEVENT') { current = {}; continue; }
        if (line === 'END:VEVENT') {
            if (current) events.push(current);
            current = null;
            continue;
        }
        if (!current) continue;
        const item = property(line);
        if (item && !Object.prototype.hasOwnProperty.call(current, item.name)) current[item.name] = item;
    }
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).getTime();
    const horizon = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).getTime();
    const results = [];
    for (const event of events) {
        const parsedDate = parseIcsDate(event.DTSTART?.value, event.DTSTART?.params);
        if (!parsedDate) continue;
        const dueTime = new Date(parsedDate.iso).getTime();
        if (!Number.isFinite(dueTime) || dueTime < cutoff || dueTime > horizon) continue;
        const title = unescapeText(event.SUMMARY?.value) || 'Untitled Schoology event';
        const description = unescapeText(event.DESCRIPTION?.value);
        const location = unescapeText(event.LOCATION?.value);
        const courseMatch = description.match(/(?:Course|Section|Class):\s*([^\n]+)/i);
        const course = location || courseMatch?.[1]?.trim() || '';
        const stableSource = event.UID?.value ? `uid:${unescapeText(event.UID.value)}` : `event:${title}|${parsedDate.iso}|${course}`;
        results.push({ id: await sha256(stableSource), title, course, dueAt: parsedDate.iso, allDay: parsedDate.allDay });
    }
    return results.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}
