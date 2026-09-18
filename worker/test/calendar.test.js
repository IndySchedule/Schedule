import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCalendarUrl, parseAssignments } from '../src/calendar.js';
import { encryptCalendarUrl, decryptCalendarUrl } from '../src/crypto.js';

test('normalizes webcal Schoology links to HTTPS', () => {
    assert.equal(normalizeCalendarUrl('webcal://app.schoology.com/calendar/feed/abc'), 'https://app.schoology.com/calendar/feed/abc');
});

test('rejects invalid protocols and non-Schoology hosts to prevent SSRF', () => {
    for (const value of ['http://app.schoology.com/a', 'https://example.com/a', 'https://schoology.com.evil.test/a', 'https://user@schoology.com/a']) {
        assert.throws(() => normalizeCalendarUrl(value), /Schoology calendar link/);
    }
});

test('parses folded ICS lines, escaped values, courses, all-day dates, and stable IDs', async () => {
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:assignment-42@example', 'DTSTART:20260920T153000Z',
        'SUMMARY:Research\\, draft', 'DESCRIPTION:Course: AP English', ' LOCATION continued', 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:assignment-43@example', 'DTSTART;VALUE=DATE:20260922', 'SUMMARY:Read chapter 4', 'LOCATION:Biology', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const first = await parseAssignments(ics, new Date('2026-09-18T12:00:00Z'));
    const second = await parseAssignments(ics, new Date('2026-09-18T12:00:00Z'));
    assert.equal(first.length, 2);
    assert.equal(first[0].title, 'Research, draft');
    assert.match(first[0].course, /AP English/);
    assert.equal(first[1].allDay, true);
    assert.equal(first[0].id, second[0].id);
    assert.match(first[0].id, /^[a-f0-9]{64}$/);
});

test('rejects non-calendar responses', async () => {
    await assert.rejects(() => parseAssignments('<html>login</html>'), /valid calendar/);
});

test('encrypted calendar URLs roundtrip and use unique nonces', async () => {
    const secret = 'unit-test-encryption-secret';
    const url = 'https://app.schoology.com/calendar/feed/private-token';
    const first = await encryptCalendarUrl(url, secret);
    const second = await encryptCalendarUrl(url, secret);
    assert.notEqual(first, second);
    assert.equal(await decryptCalendarUrl(first, secret), url);
    assert.equal(await decryptCalendarUrl(second, secret), url);
    assert.ok(!first.includes('private-token'));
});
