load('school-calendar.js');
load('lunch-menu.js');

let passed = 0;
function assert(condition, message) {
    if (!condition) throw new Error(message);
    passed += 1;
}

function assertEqual(actual, expected, message) {
    assert(actual === expected, `${message}: expected ${expected}, received ${actual}`);
}

const calendar = globalThis.IndyCalendar;
assert(calendar, 'IndyCalendar should load');
const lunchMenu = globalThis.IndyLunchMenu;
assert(lunchMenu, 'IndyLunchMenu should load');
assertEqual(lunchMenu.OFFICIAL_MENU_URL, 'https://www.wcs.edu/about-us/menus-nutrition', 'Missing menus link to the official WCS page');
assert(lunchMenu.ready && lunchMenu.schemaVersion === 1, 'Lunch data exposes a validated schema');
assertEqual(lunchMenu.MENU_MONTH, '2026-08', 'Lunch data declares its active month');
assert(!Number.isNaN(new Date(lunchMenu.UPDATED_AT).getTime()), 'Lunch data declares a valid update time');
assertEqual(lunchMenu.getMenu('2026-08-04'), null, 'An unlisted lunch date uses the fallback');
assertEqual(Object.keys(lunchMenu.MENUS).length, 15, 'All fifteen August cafeteria dates are loaded');
assert(lunchMenu.getMenu('2026-08-11').includes('Mini Corndogs'), 'August menu items are available by date');
assertEqual(calendar.TIME_ZONE, 'America/Chicago', 'School timezone');

assertEqual(calendar.getDayType('2026-08-04'), 'noSchool', 'Pre-semester staff day');
assertEqual(calendar.getDayType('2026-08-10'), 'halfDay', 'First student day');
assertEqual(calendar.getDayType('2026-08-11'), 'regular', 'First full student day');
assertEqual(calendar.getDayType('2026-08-18'), 'lateStart', 'First late-start day');
assertEqual(calendar.getDayType('2026-09-07'), 'noSchool', 'Labor Day');
assertEqual(calendar.getDayType('2026-09-08'), 'lateStart', 'Tuesday late start after Labor Day');
assertEqual(calendar.getDayType('2026-10-14'), 'noSchool', 'Fall break');
assertEqual(calendar.getDayType('2026-12-18'), 'halfDay', 'Semester half day');
assertEqual(calendar.getDayType('2027-01-04'), 'noSchool', 'Teacher preparation day');
assertEqual(calendar.getDayType('2027-01-05'), 'lateStart', 'Second semester late-start return');
assertEqual(calendar.getDayType('2027-05-27'), 'halfDay', 'Last student day');
assertEqual(calendar.getDayType('2027-05-28'), 'noSchool', 'After school year');
assertEqual(calendar.getNextInstructionalDateKey('2026-08-04'), '2026-08-10', 'Next day before school starts');
assertEqual(calendar.getNextInstructionalDateKey('2026-09-04'), '2026-09-08', 'Next day across holiday weekend');

const officialLateStarts = [
    '2026-08-18', '2026-08-24', '2026-08-31',
    '2026-09-08', '2026-09-14', '2026-09-21', '2026-09-28',
    '2026-10-05', '2026-10-19', '2026-10-26',
    '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-30',
    '2026-12-07',
    '2027-01-05', '2027-01-11', '2027-01-19', '2027-01-25',
    '2027-02-01', '2027-02-08', '2027-02-22',
    '2027-03-01', '2027-03-08', '2027-03-22', '2027-03-29',
    '2027-04-05'
];
assertEqual(calendar.LATE_START_DATES.length, 27, 'Official late-start date count');
assertEqual(calendar.LATE_START_DATES.join(','), officialLateStarts.join(','), 'Official late-start date list');
assert(officialLateStarts.every((date) => calendar.getScheduleKey(date) === 'lateStart'), 'Every official date selects the late-start schedule');
assertEqual(calendar.getDayType('2026-08-17'), 'regular', 'Monday exception before first late start');
assertEqual(calendar.getScheduleKey('2026-08-17'), 'normalNoSoar', 'Regular Monday uses no-SOAR schedule');
assertEqual(calendar.getScheduleKey('2026-08-21'), 'normalNoSoar', 'Regular Friday uses no-SOAR schedule');
assertEqual(calendar.getScheduleKey('2026-08-12'), 'normal', 'Regular Wednesday uses SOAR schedule');

const regular = calendar.SCHEDULES.normal;
const regularNoSoar = calendar.SCHEDULES.normalNoSoar;
const lateStart = calendar.SCHEDULES.lateStart;
const halfDay = calendar.SCHEDULES.halfDay;
assertEqual(regular.length, 8, 'SOAR schedule includes seven periods and SOAR');
assertEqual(regularNoSoar.length, 7, 'No-SOAR schedule includes seven periods');
assertEqual(lateStart.length, 7, 'Late-start schedule period count');
assertEqual(halfDay.length, 7, 'Half-day schedule period count');
const rows = (schedule) => schedule.map(({ name, start, end }) => `${name}|${start}|${end}`).join(',');
assertEqual(rows(regular), [
    'Period 1|07:40|08:29', 'Period 2|08:34|09:21', 'Period 3|09:26|10:13',
    'SOAR|10:13|10:53', 'Period 4|10:58|11:45', 'Period 5|11:50|13:02',
    'Period 6|13:07|13:54', 'Period 7|13:59|14:47'
].join(','), 'Official SOAR bell schedule');
assertEqual(rows(regularNoSoar), [
    'Period 1|07:40|08:33', 'Period 2|08:38|09:31', 'Period 3|09:36|10:29',
    'Period 4|10:34|11:27', 'Period 5|11:32|12:50', 'Period 6|12:55|13:48',
    'Period 7|13:53|14:47'
].join(','), 'Official no-SOAR bell schedule');
assertEqual(rows(lateStart), [
    'Period 1|08:25|09:11', 'Period 2|09:16|10:00', 'Period 3|10:05|10:49',
    'Period 4|10:54|11:38', 'Period 5|11:43|13:06', 'Period 6|13:11|13:55',
    'Period 7|14:00|14:47'
].join(','), 'Official late-start bell schedule');
assertEqual(lateStart[0].start, '08:25', 'Late-start day begins at 8:25');
assertEqual(lateStart[6].end, '14:47', 'Late-start day dismissal');
assertEqual(halfDay[6].end, '11:15', 'Half-day dismissal');
assertEqual(calendar.getLunchPeriod('normal', 'A').start, '11:45', 'SOAR A lunch start');
assertEqual(calendar.getLunchPeriod('normal', 'B').end, '12:36', 'SOAR B lunch end');
assertEqual(calendar.getLunchPeriod('normal', 'C').end, '13:02', 'SOAR C lunch end');
assertEqual(calendar.getLunchPeriod('normalNoSoar', 'A').start, '11:27', 'No-SOAR A lunch start');
assertEqual(calendar.getLunchPeriod('normalNoSoar', 'B').start, '11:56', 'No-SOAR B lunch start');
assertEqual(calendar.getLunchPeriod('normalNoSoar', 'C').end, '12:50', 'No-SOAR C lunch end');
assertEqual(calendar.getLunchPeriod('lateStart', 'A').start, '11:38', 'Late-start A lunch start');
assertEqual(calendar.getLunchPeriod('lateStart', 'C').end, '13:06', 'Late-start C lunch end');
assertEqual(calendar.getLunchPeriod('halfDay', 'A'), null, 'Half days have no lunch wave');
assertEqual(regular.filter((period) => /^Period /.test(period.name)).length, 7, 'Regular schedule retains seven numbered periods');

const lunchA = calendar.getScheduleWithLunch('normal', 'A');
const lunchB = calendar.getScheduleWithLunch('normal', 'B');
const lunchC = calendar.getScheduleWithLunch('normal', 'C');
const noSoarLunchA = calendar.getScheduleWithLunch('normalNoSoar', 'A');
const noSoarLunchB = calendar.getScheduleWithLunch('normalNoSoar', 'B');
const noSoarLunchC = calendar.getScheduleWithLunch('normalNoSoar', 'C');
const lateLunchA = calendar.getScheduleWithLunch('lateStart', 'A');
const lateLunchB = calendar.getScheduleWithLunch('lateStart', 'B');
const lateLunchC = calendar.getScheduleWithLunch('lateStart', 'C');
const chronological = (schedule) => schedule.slice(0, -1).every((period, index) => period.end <= schedule[index + 1].start);

assert([lunchA, lunchB, lunchC, noSoarLunchA, noSoarLunchB, noSoarLunchC, lateLunchA, lateLunchB, lateLunchC].every(
    (schedule) => schedule.find((period) => period.isLunch)?.name === 'Lunch'
), 'Visible lunch timeline hides the selected wave letter');
assert(lunchA.findIndex((period) => period.isLunch) < lunchA.findIndex((period) => period.periodNum === '5'), 'A lunch appears before fifth period');
assertEqual(lunchA.find((period) => period.periodNum === '5').start, '12:15', 'SOAR A fifth period begins after lunch passing time');
assertEqual(lunchB.filter((period) => period.periodNum === '5').length, 2, 'B lunch splits fifth period into two sections');
assertEqual(lunchB.filter((period) => period.periodNum === '5')[0].segmentLabel, 'Part 1', 'First split section uses the Part 1 label');
assertEqual(lunchB.filter((period) => period.periodNum === '5')[1].start, '12:41', 'SOAR B fifth period resumes after lunch');
assertEqual(lunchB.filter((period) => period.periodNum === '5')[1].segmentLabel, 'Part 2', 'Second split section uses the Part 2 label');
assertEqual(lunchC.filter((period) => period.periodNum === '5').length, 1, 'C lunch has one fifth-period section before lunch');
assertEqual(lunchC.find((period) => period.periodNum === '5').end, '12:37', 'Regular C fifth period ends when lunch begins');
assert(lunchC.findIndex((period) => period.periodNum === '5') < lunchC.findIndex((period) => period.isLunch), 'C lunch appears after fifth period');
assertEqual(noSoarLunchA.find((period) => period.periodNum === '5').start, '11:57', 'No-SOAR A fifth period begins after lunch');
assertEqual(noSoarLunchB.filter((period) => period.periodNum === '5')[1].start, '12:26', 'No-SOAR B fifth period resumes after lunch');
assertEqual(noSoarLunchC.find((period) => period.periodNum === '5').end, '12:25', 'No-SOAR C fifth period ends when lunch begins');
assertEqual(lateLunchA.find((period) => period.periodNum === '5').start, '12:11', 'Late-start A fifth period begins after lunch');
assertEqual(lateLunchB.filter((period) => period.periodNum === '5')[1].start, '12:41', 'Late-start B fifth period resumes after lunch');
assertEqual(lateLunchC.find((period) => period.periodNum === '5').end, '12:38', 'Late-start C fifth period ends when lunch begins');
assert([lunchA, lunchB, lunchC, noSoarLunchA, noSoarLunchB, noSoarLunchC, lateLunchA, lateLunchB, lateLunchC].every(chronological), 'Every lunch timeline is chronological and non-overlapping');

assertEqual(
    calendar.epochForSchoolTime('2026-08-11', '07:40'),
    Date.UTC(2026, 7, 11, 12, 40, 0),
    'CDT conversion'
);
assertEqual(
    calendar.epochForSchoolTime('2026-12-18', '07:40'),
    Date.UTC(2026, 11, 18, 13, 40, 0),
    'CST conversion'
);

const appSource = readFile('script.js');
assert(appSource.includes("localStorage.getItem('showPeriodTimes') !== 'false'"), 'Period times are enabled by default');
assert(appSource.includes("heading: 'Between Classes'"), 'Countdown identifies actual between-class passing time');
assert(appSource.includes("heading: 'School Starts Soon'"), 'Before-school countdown has clear morning wording');
assert(appSource.includes('First bell at ${formatTime12(upcomingPeriod.start)}'), 'Before-school timing identifies the first bell');
assert(appSource.includes("heading: 'School’s Out!'"), 'After-school countdown uses the friendly finished-day wording');
assert(!appSource.includes("nextSummary: 'Up next'"), 'Ambiguous Up next passing-time label is removed');
assert(appSource.includes("currentLabel = 'Between classes'"), 'Today at Indy uses the same between-classes wording');
assert(appSource.includes("fetch(IHS_CALENDAR_DATA_URL, { cache: 'no-store'"), 'Today events request the newly deployed same-origin cache');
assert(appSource.includes("deliveryState: 'saved'") && appSource.includes('IHS_CALENDAR_CACHE_KEY'), 'Today events use an explicitly labeled saved copy when live loading fails');
assert(appSource.includes('This date is outside the downloaded calendar range.'), 'Today events reject dates outside generated coverage');
assert(appSource.includes("noticeBox.hidden = !noticeText"), 'Ordinary days do not show an unnecessary special-day notice');
assert(appSource.includes('event.days.includes(dateKey)'), 'Today events are filtered using Indy’s local calendar date');
assert(appSource.includes('No public IHS events are listed for today.'), 'Today events have a clear empty-day state');
assert(appSource.includes('Check the official calendar.'), 'Today events have an official fallback link');
assert(!appSource.includes('const middleSchoolSchedules'), 'Middle-school schedules removed');
assert(!appSource.includes('const grade5Schedules'), 'Fifth-grade schedules removed');
assert(!appSource.includes('sendScheduleToExtension'), 'Website extension sync removed');
const indexSource = readFile('index.html');
assert(indexSource.includes('indy_schedule_logo_sizes/indy-schedule-logo-16x16-optimized.png'), 'Optimized new logo is used for the small favicon');
assert(indexSource.includes('indy_schedule_logo_sizes/indy-schedule-logo-32x32.png'), 'New 32px logo is used for standard browser icons');
assert(indexSource.includes('indy_schedule_logo_sizes/indy-schedule-logo-128x128.png'), 'New high-resolution logo is used throughout the interface');
assert(!indexSource.includes('src="favicon.svg"'), 'Legacy shield artwork is no longer used in the main interface');
assert(indexSource.includes('id="today-at-indy"'), 'Today at Indy card is available');
assert(indexSource.includes('id="today-toggle"'), 'Today at Indy has a popup trigger');
assert(indexSource.includes('id="today-card-close"'), 'Today at Indy popup has a close control');
assert(indexSource.includes('unofficial page for Independence High School'), 'Today card includes the unofficial-page warning');
assert(indexSource.includes('id="today-lunch-menu"'), 'Today card includes the daily lunch menu');
assert(indexSource.includes('id="today-calendar-events"'), 'Today card includes official IHS calendar events');
assert(indexSource.includes('https://ihs.wcs.edu/calendar'), 'Today events link back to the official IHS calendar');
assert(indexSource.includes('id="tomorrow-summary"'), 'Tomorrow schedule preview is available');
assert(indexSource.includes('class="dashboard-shell"'), 'Main page uses the unified dashboard shell');
assert(indexSource.includes('id="sign-in-button" class="dashboard-account'), 'Account control uses the dashboard-safe container');
assert(indexSource.includes('class="account-label">Sign In</span>'), 'Signed-out account control has a visible Sign In label');
assert(!indexSource.includes('aria-label="Sign in"><i'), 'Signed-out account control does not render the oversized legacy user icon');
assert(indexSource.includes('id="schedule-context"'), 'Countdown has a separate schedule context label');
assert(indexSource.includes('id="countdown-caption"'), 'Countdown explains what the displayed time means');
assert(indexSource.includes('id="period-progress-track"'), 'Countdown includes an integrated period timeline');
assert(indexSource.includes('id="next-period-summary"'), 'Countdown includes the next period summary');
assert(!appSource.includes('timer.id = `Period_Timer`') && appSource.includes("timer.className = 'period-timer'"), 'Generated schedule rows use a reusable class instead of duplicate IDs');
assertEqual((indexSource.match(/googletagmanager\.com\/gtag\/js/g) || []).length, 0, 'Direct Analytics tag cannot run before consent');
assertEqual((indexSource.match(/firebase-analytics-compat\.js/g) || []).length, 1, 'Firebase provides the single consent-controlled Analytics loader');
const authSource = readFile('auth.js');
assert(authSource.includes('dashboard-account-menu'), 'Signed-in account actions use the compact dashboard menu');
assert(authSource.includes("button.innerHTML = '<i class=\"fas fa-circle-notch fa-spin\" aria-hidden=\"true\"></i> Signing out…'"), 'Account menu exposes a working sign-out action with progress feedback');
assert(authSource.includes("document.getElementById('today-card-close')?.click()"), 'Opening the account menu closes Today at Indy so account actions remain reachable');
assert(!authSource.includes('account-visibility') && !authSource.includes('profileHidden'), 'Account control cannot be hidden in a way that strands the sign-out action');
assert(authSource.includes("classList.add('is-signed-in')"), 'Authenticated state switches to the constrained avatar control');
assert(!authSource.includes('aria-label="Sign in with Google"><i'), 'Runtime signed-out control stays text-only');
assert(!authSource.includes('<div class="profile-container"'), 'Legacy oversized profile control is no longer rendered');
assert(indexSource.includes('id="email-auth-form"') && indexSource.includes('id="auth-mode-create"'), 'Account dialog offers email sign-in and account creation');
assert(indexSource.includes('Google sign-in won’t work on school-managed Chromebooks. Use your school email and password above instead.'), 'Google option warns school Chromebook users to use email and password');
assert(indexSource.includes('id="forgot-password"') && indexSource.includes('id="onboarding-account-signin"'), 'Password recovery and Chromebook onboarding login are available');
assert(indexSource.includes('id="onboarding-create-account"') && indexSource.includes('id="onboarding-use-guest"'), 'Welcome screen presents account creation, login, and a secondary guest path');
assert(indexSource.includes('id="onboarding-guest-confirmation"') && indexSource.includes('id="onboarding-guest-cancel"') && indexSource.includes('id="onboarding-guest-confirm"'), 'Guest mode uses a guarded confirmation dialog');
assert(indexSource.includes('On a school-managed Chromebook, guest settings won’t be saved and setup will have to be redone'), 'Guest confirmation warns school-managed Chromebook users about lost settings and repeated setup');
assert(indexSource.includes('After closing Chrome or your school-managed Chromebook, you’ll need to sign in again'), 'Walkthrough reminds managed Chromebook users that account sign-in must be repeated');
assert(authSource.includes('createUserWithEmailAndPassword') && authSource.includes('signInWithEmailAndPassword'), 'Firebase email account creation and sign-in are wired');
assert(authSource.includes('sendPasswordResetEmail'), 'Firebase password-reset email is wired');
assert(authSource.includes('firebase.auth.Auth.Persistence.LOCAL'), 'Authentication requests persistent Firebase sessions when browser policy permits');
assert(authSource.includes('indyAnalyticsConsent_v1: localStorage.getItem'), 'Analytics consent is included in account preference sync');
assert(authSource.includes("window.dispatchEvent(new CustomEvent('indy-account-authenticated'"), 'Successful account authentication returns first-time users to onboarding');
assert(appSource.includes("document.body.appendChild(card)"), 'Today dialog escapes the blurred dashboard stacking context');
const primaryStyles = readFile('styles.css');
const secondaryStyles = readFile('styles2.css');
assert(secondaryStyles.includes('#sign-in-button .account-avatar-initial i') && secondaryStyles.includes('font-size: 12px !important'), 'Fallback profile icon has a tightly scoped dashboard size');
assert(primaryStyles.includes('.onboarding-entry-card .onboarding-entry-icon') && primaryStyles.includes('place-items: center'), 'Welcome account-choice icons remain centered in their tiles');
const designTokens = readFile('design-tokens.css');
const calendarWorkflow = readFile('.github/workflows/update-ihs-calendar.yml');
const calendarGenerator = readFile('tools/update-calendar-events.mjs');
const liveDataValidator = readFile('tools/validate-live-data.mjs');
const firebaseHosting = JSON.parse(readFile('firebase.json'));
const initialCalendarData = JSON.parse(readFile('data/ihs-calendar-events.json'));
assert(calendarWorkflow.includes('cron: "17 */3 * * *"') && calendarWorkflow.includes('workflow_dispatch:'), 'GitHub can refresh IHS calendar data automatically or on demand');
assert(calendarWorkflow.includes('permissions:') && calendarWorkflow.includes('contents: write'), 'Calendar workflow can commit its generated same-origin cache');
assert(calendarWorkflow.includes('npm run validate-live-data'), 'Calendar workflow validates calendar and lunch data before publishing');
assert(calendarWorkflow.includes('FirebaseExtended/action-hosting-deploy@v0') && calendarWorkflow.includes('target: production'), 'Scheduled calendar refresh deploys directly to the production Firebase site');
assert(firebaseHosting.hosting.headers.some((rule) => rule.source === '/data/**' && rule.headers.some((header) => header.key === 'Cache-Control' && header.value.includes('must-revalidate'))), 'Firebase immediately revalidates deployed live-data files');
assert(firebaseHosting.hosting.ignore.includes('assets/special-editions/*-master.png'), 'Firebase excludes lossless edition masters from deployment');
assert(calendarWorkflow.includes("--exclude 'assets/special-editions/*-master.png'"), 'GitHub Pages excludes lossless edition masters from deployment');
assert(calendarGenerator.includes('ical.expandRecurringEvent'), 'Calendar sync expands official recurring events');
assert(calendarGenerator.includes('allDay ? start.toISOString().slice(0, 10)'), 'All-day calendar dates cannot shift across time zones');
assert(calendarGenerator.includes('content_changed=') && calendarGenerator.includes('lastCheckedAt'), 'Calendar generation separates successful checks from substantive content changes');
assert(calendarGenerator.includes('first.id.localeCompare(second.id)'), 'Calendar output is deterministic when events share a start time');
assert(liveDataValidator.includes('Lunch menu has no dated entries.') && liveDataValidator.includes('Calendar events must be an array.'), 'Publication validation covers both live-data sources');
assert(initialCalendarData.source === 'https://ihs.wcs.edu/calendar', 'Initial calendar fallback identifies the official source');
assert(initialCalendarData.schemaVersion === 1 && initialCalendarData.staleAfterHours === 8, 'Calendar fallback declares its schema and freshness threshold');
assert(secondaryStyles.includes('.brand-logo-art') && secondaryStyles.includes('clip-path: inset(0 0 0 3px)'), 'Shared logo treatment clips the source image edge artifact');
assertEqual((indexSource.match(/brand-logo-art/g) || []).length, 6, 'Every visible brand-logo instance, including account and onboarding marks, uses the shared artifact fix');
assert(indexSource.includes('class="settings-form-grid"'), 'Schedule and lunch controls use the responsive settings grid');
assert(indexSource.includes('class="schedule-tools-grid"'), 'Secondary schedule controls share a responsive tools grid');
assert(indexSource.includes('class="settings-group display-options-card"'), 'Display options remain an independent settings card');
assert(indexSource.includes('id="rename-periods-toggle" class="dropdown-toggle schedule-action-row" aria-expanded="false"'), 'Period renaming uses an accessible disclosure control');
assert(indexSource.includes('class="appearance-tools-grid"'), 'Appearance uses the shared compact tools layout');
assert(indexSource.includes('class="about-feature-grid"'), 'About presents features in a responsive card grid');
assert(secondaryStyles.includes('flex-direction: column !important;'), 'Phone Settings stacks navigation above the active panel');
assert(secondaryStyles.includes('overflow-x: auto;\n        overflow-y: hidden;'), 'Phone Settings navigation scrolls horizontally without stretching the page');
assert(indexSource.includes('class="settings-group legal-overview-card"'), 'Privacy and Terms uses the unified full-width card');
assert(indexSource.includes('id="delete-local-data"') && indexSource.includes('id="delete-local-data-confirmation"'), 'Privacy controls provide a guarded local-data deletion action');
assert(authSource.includes('localStorage.clear()') && authSource.includes('initializeLocalDataControls'), 'Local-data deletion clears browser storage through its initialized privacy control');
assert(indexSource.includes('Version 1.2.0') && indexSource.includes('v1.2.0'), 'About and release notes identify the current 1.2.0 version');
assert(indexSource.includes('v1.1.0'), 'The previous live-data release remains in the update history');
assertEqual((indexSource.match(/<div class="wn-entry(?: current-release)?">/g) || []).length, 7, 'What’s New includes the initial release and six focused updates');
assertEqual((indexSource.match(/<div class="wn-entry current-release">/g) || []).length, 1, 'Exactly one update is marked as the current release');
assert(!indexSource.includes('id="bg-image"'), 'Retired background-image upload is removed from Appearance settings');
assert(!indexSource.includes('id="bg-image-drop-area"'), 'Retired background-image drop area is removed');
assert(!['white-box-color', 'white-box-opacity', 'white-box-text-color', 'countdown-color', 'font-color'].some((id) => indexSource.includes(`id="${id}"`)), 'Retired standalone color controls are removed instead of hidden');
assert(!['custom-schedule', 'schedule-name', 'num-periods', 'save-schedule-button'].some((id) => indexSource.includes(`id="${id}"`)), 'Retired custom-schedule editor is removed instead of hidden');
assert(indexSource.includes('id="gradient-preview"'), 'Gradient editor includes a live preview');
assert(indexSource.includes('id="reset-gradient"'), 'Gradient editor can restore the Indy default');
assert(!indexSource.includes('id="gradient-enabled"'), 'Always-on gradient does not show a redundant enable switch');
assertEqual((indexSource.match(/class="palette-option/g) || []).length, 25, 'Appearance offers twenty-four optimized presets and one custom palette');
assertEqual((indexSource.match(/class="edition-option"/g) || []).length, 3, 'Appearance retains three special-edition controls');
assert(['friday-night-lights', 'historic-franklin', 'music-city'].every((id) => indexSource.includes(`data-edition="${id}"`)), 'Every special edition retains an Appearance control');
assert(/data-edition="friday-night-lights"[^>]*hidden/.test(indexSource), 'Friday Night Lights is temporarily hidden from Appearance');
assert(/data-edition="historic-franklin"[^>]*hidden/.test(indexSource), 'Historic Franklin is temporarily hidden from Appearance');
assert(!/data-edition="music-city"[^>]*hidden/.test(indexSource), 'Music City remains available in Appearance');
assert(['midnight', 'dark-plum', 'graphite', 'forest-night'].every((id) => indexSource.includes(`data-palette="${id}"`)), 'Four dedicated dark palettes are available');
assert(['monochrome', 'slate', 'aurora', 'rose-quartz', 'lavender', 'cherry-blossom', 'sunset-sorbet', 'sage-rose'].every((id) => indexSource.includes(`data-palette="${id}"`)), 'Modern, monochrome, and soft-color palette additions are available');
assert(['prism-rush', 'tropical', 'candy-pop', 'daylight', 'cotton-candy', 'lemonade'].every((id) => indexSource.includes(`data-palette="${id}"`)), 'Vivid and light-dashboard palette additions are available');
assert(!indexSource.includes('class="palette-grid-label"'), 'Palette presets appear in one uncategorized collection');
assert(indexSource.includes('id="palette-accent-color"') && indexSource.includes('id="palette-surface-color"'), 'Custom palette exposes all four color roles');
assert(indexSource.includes('id="lunch-wave"'), 'Lunch-wave selector is available');
assert(['A', 'B', 'C'].every((wave) => indexSource.includes(`<option value="${wave}">`)), 'All three lunch-wave options are available');
assert(indexSource.includes('id="onboarding-lunch-wave"'), 'First-run lunch selection is available');
assert(indexSource.includes('Please select your assigned lunch before continuing.'), 'First-run lunch selection is required');
assertEqual((indexSource.match(/class="onboarding-step(?: active)?"/g) || []).length, 5, 'Five-step onboarding flow');
assert(indexSource.includes('indyOnboardingComplete_v2'), 'Onboarding completion is persisted');
assert(indexSource.includes('recoverableSetup') && indexSource.includes('indyOnboardingReplayRequested_v1'), 'Missing onboarding completion self-heals without breaking intentional replay');
assert(authSource.includes('indyOnboardingComplete_v2: localStorage.getItem'), 'Onboarding completion is included in signed-in settings sync');
assert(indexSource.includes('saveAllUserSettings(currentUser.uid)'), 'Completing or repairing onboarding immediately syncs the saved state');
assert(indexSource.includes('await window.authManager.saveAllUserSettings(currentUser.uid)'), 'Onboarding waits for Firestore to save its completion state before opening the dashboard');
assert(indexSource.includes('Replay Welcome Tour'), 'Onboarding can be replayed from settings');
assert(!indexSource.includes('id="timer-shadow"') && !indexSource.includes('id="shadow-settings-content"'), 'Retired timer-shadow controls are removed from Appearance');
assert(indexSource.includes('onboarding-pending'), 'Opaque pre-onboarding wall prevents site flash');
assert(indexSource.includes('onboarding-launching'), 'Onboarding has a branded launch transition');
assert(indexSource.includes('prefers-reduced-motion: reduce'), 'Launch transition respects reduced-motion preferences');
assertEqual((indexSource.match(/type="radio" name="onboarding-lunch"/g) || []).length, 3, 'Onboarding offers three lunch choices');
assert(!indexSource.includes('id="extension-panel"'), 'Extension settings panel removed');
assert(!indexSource.includes('data-target="extension"'), 'Extension navigation removed');
assert(!indexSource.includes('EXTENSION_PING'), 'Extension bridge scripts removed');
assert(indexSource.includes('data-onboarding-analytics') && indexSource.includes('id="onboarding-analytics-decline"'), 'Analytics consent choice is part of onboarding');
assert(!indexSource.includes('id="analytics-consent-banner"'), 'Analytics consent no longer uses a separate floating banner');
assert(indexSource.includes('id="analytics-consent-toggle"'), 'Analytics consent can be changed from Settings');
assert(indexSource.includes("window.setAnalyticsConsent?.(true)") && indexSource.includes("window.setAnalyticsConsent?.(false)"), 'Onboarding saves either analytics choice explicitly');
assert(!indexSource.includes('G-YS6FHHEGFZ'), 'Retired direct Analytics tag is removed');
assert(authSource.includes("analytics_storage: granted ? 'granted' : 'denied'"), 'Analytics storage follows the saved visitor choice');
assert(authSource.includes("ad_storage: 'denied'") && authSource.includes("ad_personalization: 'denied'"), 'Advertising storage and personalization remain disabled');
assert(authSource.includes("this.analytics = null") && authSource.includes("getAnalyticsConsent() === 'granted'"), 'Firebase Analytics initializes only after consent');
const secondaryAppSource = readFile('script2.js');
assert(secondaryAppSource.includes('function initializeSettingsControls()'), 'Settings controls have a top-level initializer');
assert(secondaryAppSource.includes("settingsButton.addEventListener('click'"), 'Settings button has a reliable click binding');
assert(secondaryAppSource.includes("this.setAttribute('aria-expanded', 'true')"), 'Period-name disclosure reports its expanded state');
assert(!secondaryAppSource.includes('function updateTimerShadow') && !secondaryAppSource.includes('function loadShadowSettings'), 'Retired timer-shadow runtime is removed');
assert(!authSource.includes('timerShadowSettings:'), 'Retired timer-shadow setting is no longer synced');
assert(!secondaryAppSource.includes('handleBgImageUpload') && !secondaryAppSource.includes('dropOverlay'), 'Retired background-upload runtime is removed');
assert(!secondaryAppSource.includes("getElementById('gradient-enabled')"), 'Runtime no longer queries the retired gradient switch');
assert(!secondaryAppSource.includes('loadWhiteBoxSettings') && !secondaryAppSource.includes('loadCountdownColor'), 'Retired standalone color runtime is removed');
assert(!authSource.includes('whiteBoxColor:') && !authSource.includes('countdownColor:') && !authSource.includes('customSchedules'), 'Retired appearance and custom-schedule settings are no longer synced');
assert(!appSource.includes("startsWith('customSchedule_')") && !appSource.includes('initializeSavedSchedules'), 'Retired custom-schedule compatibility branches are removed');
assert(!primaryStyles.includes('#bg-image-drop-area') && !secondaryStyles.includes('#bg-image-drop-area'), 'Retired background-upload CSS is removed');
assert(!primaryStyles.includes('#extension-panel') && !secondaryStyles.includes('#extension-panel'), 'Retired extension CSS is removed');
assert(!primaryStyles.includes('.grade-modal') && !primaryStyles.includes('#grade-level-modal'), 'Retired pre-onboarding modal CSS is removed');
assert(secondaryStyles.includes('#whatsnew-panel .whatsnew-tabs') && secondaryStyles.includes('grid-template-columns: 1fr !important'), 'Website Updates fills the full release-note tab bar');
const gradientSource = readFile('gradient.js');
assert(gradientSource.includes('const SPECIAL_EDITIONS = Object.freeze') && gradientSource.includes('selectEdition(editionId)'), 'Palette runtime defines and activates special editions');
assert(gradientSource.includes('this.editionId = null;\n        if (paletteId === \'custom\')'), 'Selecting any regular palette disables the active special edition');
assert(gradientSource.includes('editionId: this.editionId'), 'Special edition selection persists inside synced gradient settings');
assert(!gradientSource.includes("'gradient-stops',"), 'Gradient initialization does not wait for a removed control');
assert(gradientSource.includes("['gradient-start-color', 0]"), 'Primary-color picker is connected to the palette engine');
assert(gradientSource.includes("['palette-surface-color', 3]"), 'Surface-color picker is connected to the palette engine');
assert(gradientSource.includes("setProperty('--page-gradient'"), 'Selected gradient is exposed to the dashboard shell');
assert(!gradientSource.includes('DEFAULT_PRIMARY_COLOR'), 'Page gradient has no hard-coded middle color');
assert(gradientSource.includes('readableTextColor'), 'Palette engine derives readable foreground colors');
assert(secondaryStyles.includes('var(--page-gradient'), 'Dashboard shell displays the selected page gradient');
assert(secondaryStyles.includes('background: rgba(var(--theme-panel-rgb), 0.97)'), 'Schedule uses its readable Secondary-derived panel color');
assert(secondaryStyles.includes('#white-box-heading,') && secondaryStyles.includes('color: var(--theme-on-panel) !important'), 'Palette text overrides retired inline schedule colors');
assert(secondaryStyles.includes('border-color: var(--theme-frame-border) !important'), 'Dashboard uses an opaque derived border instead of exposing a gradient edge');
assert(secondaryStyles.includes('Main-page finishing pass'), 'Main-page visual refinements retain a final cascade layer');
assert(secondaryStyles.includes('.current-period::before') && secondaryStyles.includes('display: none'), 'Redundant countdown inset border is removed');
assert(secondaryStyles.includes('opacity: 0.82 !important') && secondaryStyles.includes('font-size: 10px !important'), 'Small schedule times have stronger contrast and legibility');
assert(secondaryStyles.includes('rgba(var(--theme-dashboard-accent-rgb), 0.34)'), 'Progress fill receives a restrained palette-aware accent glow');
assert(secondaryStyles.includes('#schedule .period.is-current') && secondaryStyles.includes('transform: none !important'), 'Current schedule row stays aligned with neighboring rows');
assert(secondaryStyles.includes('var(--page-gradient) !important') && secondaryStyles.includes('rgba(var(--color-black-rgb), 0.46)'), 'Selected Settings item follows the active palette gradient');
assert(!primaryStyles.includes('.nav-item.active.nav-item'), 'Legacy active-nav specificity override is removed from the base stylesheet');
assert(secondaryStyles.includes('Complete palette coverage for Settings'), 'Specialized Settings panels use the final palette-aware cascade layer');
assert(['#legal-panel', '#whatsnew-panel', '#contact-panel'].every((selector) => secondaryStyles.includes(selector)), 'Legal, What’s New, and Contact have explicit palette coverage');
assert(secondaryStyles.includes('button:not(.whatsnew-tab):not(.palette-option)'), 'Palette cards are excluded from the global action-button treatment');
assert(secondaryStyles.includes('#settings-sidebar #schedule-panel .settings-field label'), 'Schedule field text uses explicit palette-aware roles');
assert(!primaryStyles.includes('#settings-sidebar #schedule-panel *'), 'Schedule icons are not trapped by a legacy whole-panel text color');
assert(indexSource.indexOf('design-tokens.css') < indexSource.indexOf('styles.css'), 'Authoritative design tokens load before component styles');
assert(designTokens.includes('--theme-primary:') && designTokens.includes('--theme-settings-card:'), 'Design tokens provide palette and derived component roles');
assert(designTokens.includes('--space-4:') && designTokens.includes('--radius-card:') && designTokens.includes('--shadow-md:'), 'Design tokens provide shared spacing, radius, and elevation scales');
assert(!/--theme-primary\s*:/.test(primaryStyles) && !/--theme-primary\s*:/.test(secondaryStyles), 'Component stylesheets do not redeclare the global palette');
const canonicalPaletteLayer = secondaryStyles.slice(secondaryStyles.indexOf('Final palette precedence layer'));
assert(!/#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i.test(canonicalPaletteLayer), 'The active palette cascade contains no fixed color literals');
assert(!primaryStyles.includes('FINAL SOFT LIGHT MODE') && !secondaryStyles.includes('Palette roles and whole-interface application'), 'Superseded palette override stacks are removed');
assert(!primaryStyles.includes('.theme-toggle') && !secondaryStyles.includes('.theme-toggle'), 'Retired theme-toggle CSS is removed instead of hidden');
assert(!['profile-container', 'profile-button', 'logout-button', 'hide-profile-button'].some((selector) => primaryStyles.includes(selector) || secondaryStyles.includes(selector)), 'Retired profile-control CSS is removed');
assertEqual((primaryStyles.match(/Progress Bar Styles/g) || []).length, 1, 'The duplicated progress component block is consolidated');
assertEqual((primaryStyles.match(/@media \(max-width: 600px\)/g) || []).length, 1, 'Repeated base 600px media rules are consolidated');
assert(['Dashboard components', 'Settings shell and shared components', 'Today at Indy popover', 'Settings pages: Schedule'].every((section) => secondaryStyles.includes(section)), 'Canonical component CSS is organized into named sections');
assert(!primaryStyles.includes('.nav-item.active::before') && !secondaryStyles.includes('.nav-item.active::before'), 'Selected Settings navigation has no leaking legacy accent pseudo-element');
assert(secondaryStyles.includes('grid-template-columns: repeat(2, minmax(0, 1fr))') && secondaryStyles.includes('#settings-sidebar #schedule-panel .schedule-tools-grid'), 'Schedule utility cards use equal, shrink-safe columns');
assert(secondaryStyles.includes('#settings-sidebar #contact-panel .contact-btn') && secondaryStyles.includes('max-width: 100%'), 'Contact email action is constrained to its card');
assert(!primaryStyles.includes('.settings-sidebar div'), 'Settings components are not distorted by a global div margin');
assert(secondaryStyles.includes('flex: 0 1 47%') && secondaryStyles.includes('max-width: 230px'), 'Typography selector leaves room for its control copy');
assertEqual((secondaryStyles.match(/\.\w+-tools-grid > \.settings-group \{/g) || []).length, 2, 'Schedule and Appearance expose canonical utility-card grid rules');
assertEqual((secondaryStyles.match(/width: 100% !important;\n    max-width: none !important;\n    height: 100%;/g) || []).length, 2, 'Schedule and Appearance utility cards fully span their grid tracks');

const gradientElements = {};
function mockGradientElement(value = '') {
    const classes = {};
    return {
        value,
        checked: true,
        textContent: '',
        hidden: false,
        dataset: {},
        style: { setProperty(name, nextValue) { this[name] = nextValue; } },
        listeners: {},
        classList: {
            toggle(name, force) { classes[name] = force; },
            remove(name) { delete classes[name]; },
            contains(name) { return !!classes[name]; }
        },
        setAttribute() {},
        addEventListener(type, listener) { this.listeners[type] = listener; }
    };
}
gradientElements['gradient-angle'] = mockGradientElement('90');
gradientElements['gradient-start-color'] = mockGradientElement('#000035');
gradientElements['gradient-end-color'] = mockGradientElement('#c4ad62');
gradientElements['palette-accent-color'] = mockGradientElement('#c4ad62');
gradientElements['palette-surface-color'] = mockGradientElement('#ffffff');
gradientElements['gradient-start-hex'] = mockGradientElement();
gradientElements['gradient-end-hex'] = mockGradientElement();
gradientElements['palette-accent-hex'] = mockGradientElement();
gradientElements['palette-surface-hex'] = mockGradientElement();
gradientElements['gradient-settings'] = mockGradientElement();
gradientElements['gradient-preview'] = mockGradientElement();
gradientElements['reset-gradient'] = mockGradientElement();
const mockPaletteButtons = ['indy', 'ocean', 'dark-teal', 'earth', 'neon', 'pastel', 'midnight', 'dark-plum', 'graphite', 'forest-night', 'monochrome', 'slate', 'aurora', 'rose-quartz', 'lavender', 'cherry-blossom', 'sunset-sorbet', 'sage-rose', 'prism-rush', 'tropical', 'candy-pop', 'daylight', 'cotton-candy', 'lemonade', 'custom'].map((id) => {
    const button = mockGradientElement();
    button.dataset.palette = id;
    return button;
});
const mockCustomSwatches = [0, 1, 2, 3].map(() => mockGradientElement());
const mockStorage = { bgImage: 'legacy-image' };
globalThis.localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(mockStorage, key) ? mockStorage[key] : null; },
    setItem(key, value) { mockStorage[key] = String(value); },
    removeItem(key) { delete mockStorage[key]; }
};
globalThis.document = {
    body: { style: {} },
    documentElement: {
        style: { setProperty(name, value) { this[name] = value; } },
        classList: { toggle() {} },
        dataset: {}
    },
    getElementById(id) { return gradientElements[id] || null; },
    querySelector(selector) {
        return selector === '#gradient-angle + .range-value' ? mockGradientElement() : null;
    },
    querySelectorAll(selector) {
        if (selector === '.palette-option') return mockPaletteButtons;
        if (selector === '#custom-palette-swatches i') return mockCustomSwatches;
        return [];
    }
};
globalThis.window = globalThis;
load('gradient.js');
assertEqual(localStorage.getItem('bgImage'), null, 'Gradient migration removes a legacy uploaded background');
gradientElements['gradient-start-color'].listeners.input({ target: { value: '#123456' } });
assert(document.body.style.background.includes('#123456 0%'), 'Changing the start picker updates the page background immediately');
assert(document.documentElement.style['--page-gradient'].includes('#123456 0%'), 'Changing the picker updates the dashboard gradient variable');
assertEqual((document.body.style.background.match(/#/g) || []).length, 2, 'Rendered page gradient contains exactly two color stops');
assertEqual(window.gradientManager.paletteId, 'custom', 'Editing a color activates the Custom palette');
mockPaletteButtons.find((button) => button.dataset.palette === 'ocean').listeners.click();
assertEqual(window.gradientManager.paletteId, 'ocean', 'Clicking a preset applies that palette');
assertEqual(window.gradientManager.colors.join(','), '#112D4E,#3F72AF,#DBE2EF,#F9F7F7', 'Ocean preset applies all four source colors');
assert(document.documentElement.style['--theme-on-surface'], 'Palette application derives a surface text color');
function testLuminance(hex) {
    const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function testContrast(first, second) {
    const values = [testLuminance(first), testLuminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
}
const presetContrastIsSafe = Object.keys(window.IndyPalettes).every((paletteId) => {
    window.gradientManager.selectPalette(paletteId);
    return ['primary', 'secondary', 'accent', 'surface'].every((role, index) => {
        const foreground = document.documentElement.style[`--theme-on-${role}`];
        return testContrast(window.gradientManager.colors[index], foreground) >= 4.5;
    }) && testContrast(
        document.documentElement.style['--theme-panel'],
        document.documentElement.style['--theme-on-panel']
    ) >= 4.5;
});
assert(presetContrastIsSafe, 'Every preset and its toned schedule surface meet normal-text contrast');
assert(Object.keys(window.IndyPalettes).filter((paletteId) => {
    window.gradientManager.selectPalette(paletteId);
    return document.documentElement.dataset.dashboardTone === 'dark';
}).every((paletteId) => {
    window.gradientManager.selectPalette(paletteId);
    return testContrast(document.documentElement.style['--theme-panel'], '#FFFFFF') >= 7;
}), 'Dark dashboard palettes keep a strongly contrasted schedule panel');
assert(['pastel', 'daylight', 'cotton-candy', 'lemonade'].every((paletteId) => {
    window.gradientManager.selectPalette(paletteId);
    return document.documentElement.dataset.dashboardTone === 'light'
        && testLuminance(document.documentElement.style['--theme-panel']) > 0.5
        && testContrast(
            document.documentElement.style['--theme-panel'],
            document.documentElement.style['--theme-on-panel']
        ) >= 4.5;
}), 'Pale presets render a genuinely light dashboard and readable light schedule panel');
assert(['midnight', 'dark-plum', 'graphite', 'forest-night'].every((paletteId) => (
    testLuminance(window.IndyPalettes[paletteId].colors[3]) < 0.2
)), 'Every dedicated dark palette uses a genuinely dark card surface');
assert(Object.keys(window.IndyPalettes).every((paletteId) => {
    window.gradientManager.selectPalette(paletteId);
    return testContrast(
        document.documentElement.style['--theme-ui-accent'],
        document.documentElement.style['--theme-settings-card']
    ) >= 3;
}), 'Every preset derives a visible UI accent against its rendered Settings card');
assert(Object.keys(window.IndyPalettes).every((paletteId) => {
    window.gradientManager.selectPalette(paletteId);
    return testContrast(
        document.documentElement.style['--theme-dashboard-accent'],
        document.documentElement.style['--theme-dashboard-base']
    ) >= 3 && testContrast(
        document.documentElement.style['--theme-panel-accent'],
        document.documentElement.style['--theme-panel']
    ) >= 3;
}), 'Every preset derives readable dashboard and schedule accents');
assert(Object.keys(window.IndyPalettes).every((paletteId) => {
    window.gradientManager.selectPalette(paletteId);
    return ['settings-canvas', 'settings-card', 'settings-inset', 'settings-action'].every((role) => (
        testContrast(
            document.documentElement.style[`--theme-${role}`],
            document.documentElement.style[`--theme-on-${role}`]
        ) >= 4.5
    ));
}), 'Every preset derives readable Settings canvas, card, inset, and action roles');
assert(Object.keys(window.IndyPalettes).every((paletteId) => {
    window.gradientManager.selectPalette(paletteId);
    return document.documentElement.style['--theme-settings-canvas'] !== document.documentElement.style['--theme-settings-card']
        && document.documentElement.style['--theme-settings-inset'] !== document.documentElement.style['--theme-settings-card'];
}), 'Every preset keeps Settings cards visibly layered from their canvas and inset controls');
window.gradientManager.loadExternalSettings({ paletteId: 'custom', colors: ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'], angle: 90 });
assertEqual(document.documentElement.style['--theme-ui-accent'], '#111827', 'All-light custom palettes shift UI accents to dark text');
window.gradientManager.loadExternalSettings({ paletteId: 'custom', colors: ['#000000', '#000000', '#000000', '#000000'], angle: 90 });
assertEqual(document.documentElement.style['--theme-ui-accent'], '#FFFFFF', 'All-dark custom palettes shift UI accents to light text');
assert(secondaryStyles.includes('Eliminate legacy fixed text colors'), 'Settings text follows palette-aware foreground colors');
assert(secondaryStyles.includes(':root[data-dashboard-tone="light"] .dashboard-shell'), 'Light palettes have a dedicated readable main-page treatment');

print(`Passed ${passed} checks.`);
