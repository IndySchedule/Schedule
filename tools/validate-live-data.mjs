import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const errors = [];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value) => typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
const previousMonth = (month) => {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, value - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
const report = (condition, message) => {
  if (!condition) errors.push(message);
};

const calendar = JSON.parse(await readFile(new URL('data/ihs-calendar-events.json', root), 'utf8'));
report(calendar.schemaVersion === 1, 'Calendar schemaVersion must be 1.');
report(calendar.kind === 'ihs-calendar-events', 'Calendar kind is invalid.');
report(calendar.ready === true, 'Calendar data must be marked ready.');
report(calendar.source === 'https://ihs.wcs.edu/calendar', 'Calendar source must be the official IHS calendar.');
report(validDate(calendar.lastCheckedAt || calendar.generatedAt), 'Calendar lastCheckedAt is invalid.');
report(validDate(calendar.contentUpdatedAt || calendar.generatedAt), 'Calendar contentUpdatedAt is invalid.');
report(Number(calendar.refreshIntervalHours) === 3, 'Calendar refresh interval must be three hours.');
report(Number(calendar.staleAfterHours) >= 6, 'Calendar stale threshold is too short.');
report(datePattern.test(calendar.rangeStart || '') && datePattern.test(calendar.rangeEnd || ''), 'Calendar coverage dates are invalid.');
report(calendar.rangeStart <= calendar.rangeEnd, 'Calendar coverage range is reversed.');
report(Array.isArray(calendar.events), 'Calendar events must be an array.');

const eventIds = new Set();
(calendar.events || []).forEach((event, index) => {
  const prefix = `Calendar event ${index + 1}`;
  report(typeof event.id === 'string' && event.id.length > 0, `${prefix} has no id.`);
  report(!eventIds.has(event.id), `${prefix} has a duplicate id.`);
  eventIds.add(event.id);
  report(typeof event.title === 'string' && event.title.trim().length > 0 && event.title.length <= 300, `${prefix} has an invalid title.`);
  report(validDate(event.start), `${prefix} has an invalid start.`);
  report(validDate(event.end) && new Date(event.end) >= new Date(event.start), `${prefix} has an invalid end.`);
  report(typeof event.allDay === 'boolean', `${prefix} has an invalid allDay value.`);
  report(Array.isArray(event.days) && event.days.length > 0 && event.days.every((day) => datePattern.test(day)), `${prefix} has invalid date coverage.`);
});

await import(new URL('school-calendar.js', root));
await import(new URL('lunch-menu.js', root));
const lunch = globalThis.IndyLunchMenu;
const schoolCalendar = globalThis.IndyCalendar;
report(lunch?.schemaVersion === 1 && lunch?.ready === true, 'Lunch data is not ready or uses an unsupported schema.');
report(lunch?.OFFICIAL_MENU_URL === 'https://www.wcs.edu/about-us/menus-nutrition', 'Lunch source must be the official WCS menu page.');
report(/^https:\/\/docs\.wcs\.edu\/.*High-School-Lunch-Menu\.pdf$/i.test(lunch?.SOURCE_DOCUMENT_URL || ''), 'Lunch PDF must come from the official WCS document host.');
report(/^[a-f0-9]{64}$/.test(lunch?.SOURCE_HASH || ''), 'Lunch source hash is invalid.');
report(/^\d{4}-\d{2}$/.test(lunch?.MENU_MONTH || ''), 'Lunch menu month is invalid.');
report(validDate(lunch?.UPDATED_AT), 'Lunch updated time is invalid.');
report(datePattern.test(lunch?.COVERAGE_START || '') && datePattern.test(lunch?.COVERAGE_END || ''), 'Lunch coverage dates are invalid.');
report(lunch?.COVERAGE_START <= lunch?.COVERAGE_END, 'Lunch coverage range is reversed.');

const menuEntries = Object.entries(lunch?.MENUS || {});
report(menuEntries.length > 0, 'Lunch menu has no dated entries.');
const retainedMenuMonths = new Set(menuEntries.map(([dateKey]) => dateKey.slice(0, 7)));
report(retainedMenuMonths.has(lunch?.MENU_MONTH) && retainedMenuMonths.size <= 2, 'Lunch data must retain only the source month and optional prior month.');
report([...retainedMenuMonths].every((month) => month === lunch?.MENU_MONTH || month === previousMonth(lunch?.MENU_MONTH || '0000-01')), 'Retained lunch data must be from adjacent months.');
menuEntries.forEach(([dateKey, items]) => {
  report(datePattern.test(dateKey), `Lunch date ${dateKey} is invalid.`);
  report(retainedMenuMonths.has(dateKey.slice(0, 7)), `Lunch date ${dateKey} is outside the retained menu months.`);
  report(dateKey >= lunch.COVERAGE_START && dateKey <= lunch.COVERAGE_END, `Lunch date ${dateKey} is outside its coverage range.`);
  report(Array.isArray(items) && items.length >= 2 && items.every((item) => typeof item === 'string' && item.trim()), `Lunch date ${dateKey} needs at least two valid items.`);
  report(schoolCalendar?.getDayType(dateKey) === 'regular' || schoolCalendar?.getDayType(dateKey) === 'lateStart', `Lunch date ${dateKey} is not a full instructional day.`);
});

if (errors.length) {
  console.error(`Live-data validation failed:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${calendar.events.length} calendar events and ${menuEntries.length} lunch dates.`);
}
