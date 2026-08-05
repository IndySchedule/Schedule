import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ical from 'node-ical';

const FEED_URL = 'https://calendar.google.com/calendar/ical/myplace.wcs.edu_7jsl4069ahumr4235cdivoue6o%40group.calendar.google.com/public/basic.ics';
const PUBLIC_CALENDAR_URL = 'https://ihs.wcs.edu/calendar';
const TIME_ZONE = 'America/Chicago';
const OUTPUT_PATH = new URL('../data/ihs-calendar-events.json', import.meta.url);
const DAY_MS = 24 * 60 * 60 * 1000;

const textValue = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value.val === 'string') return value.val.trim();
  return value == null ? '' : String(value).trim();
};

const dateKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const dateKey = (date) => {
  const parts = Object.fromEntries(
    dateKeyFormatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const nextDateKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};

const coveredDays = (start, end, allDay) => {
  const finalInstant = new Date(Math.max(start.getTime(), end.getTime() - 1));
  // DATE values represent calendar days rather than instants. Reading them in
  // America/Chicago could shift UTC midnight to the previous evening.
  const first = allDay ? start.toISOString().slice(0, 10) : dateKey(start);
  const last = allDay ? finalInstant.toISOString().slice(0, 10) : dateKey(finalInstant);
  const days = [];
  for (let key = first; key <= last; key = nextDateKey(key)) days.push(key);
  return days;
};

const now = new Date();
const rangeStart = new Date(now.getTime() - 2 * DAY_MS);
const rangeEnd = new Date(now.getTime() + 120 * DAY_MS);
const parsed = await ical.async.fromURL(FEED_URL, {
  headers: { 'User-Agent': 'Indy-Schedule-Calendar-Sync/1.0' },
  signal: AbortSignal.timeout(20_000)
});

const events = [];
for (const event of Object.values(parsed)) {
  if (event?.type !== 'VEVENT' || event.recurrenceid) continue;
  const instances = event.rrule
    ? ical.expandRecurringEvent(event, { from: rangeStart, to: rangeEnd, expandOngoing: true })
    : [event];

  for (const instance of instances) {
    const start = instance.start instanceof Date ? instance.start : new Date(instance.start);
    if (Number.isNaN(start.getTime())) continue;
    const suppliedEnd = instance.end instanceof Date ? instance.end : new Date(instance.end);
    const allDay = Boolean(instance.isFullDay || instance.datetype === 'date' || instance.start?.dateOnly);
    const end = Number.isNaN(suppliedEnd.getTime())
      ? new Date(start.getTime() + (allDay ? DAY_MS : 60 * 60 * 1000))
      : suppliedEnd;
    if (end < rangeStart || start > rangeEnd) continue;

    const title = textValue(instance.summary) || 'IHS event';
    events.push({
      id: `${textValue(instance.uid) || title}-${start.toISOString()}`,
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      days: coveredDays(start, end, allDay),
      location: textValue(instance.location)
    });
  }
}

const uniqueEvents = [...new Map(events.map((event) => [event.id, event])).values()]
  .sort((first, second) => first.start.localeCompare(second.start));
const comparableOutput = {
  rangeStart: dateKey(rangeStart),
  rangeEnd: dateKey(rangeEnd),
  events: uniqueEvents
};
let generatedAt = new Date().toISOString();
try {
  const previous = JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
  const previousComparable = {
    rangeStart: previous.rangeStart,
    rangeEnd: previous.rangeEnd,
    events: previous.events
  };
  if (previous.ready && JSON.stringify(previousComparable) === JSON.stringify(comparableOutput)) {
    generatedAt = previous.generatedAt;
  }
} catch {
  // The first workflow run creates the ready data file.
}

const output = {
  ready: true,
  generatedAt,
  source: PUBLIC_CALENDAR_URL,
  timeZone: TIME_ZONE,
  rangeStart: comparableOutput.rangeStart,
  rangeEnd: comparableOutput.rangeEnd,
  events: uniqueEvents
};

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${uniqueEvents.length} IHS calendar events.`);
