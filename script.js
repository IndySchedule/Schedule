// Add this at the start of the file
async function initializeAuth() {
    await new Promise((resolve) => {
        const checkAuth = () => {
            if (window.authManager) {
                resolve();
            } else {
                setTimeout(checkAuth, 50);
            }
        };
        checkAuth();
    });
}

// Independence High School schedules
const schedules = JSON.parse(JSON.stringify(window.IndyCalendar.SCHEDULES));

const scheduleDisplayNames = {
    normal: 'Regular',
    normalNoSoar: 'Regular (No SOAR)',
    lateStart: 'Late Start',
    halfDay: 'Half Day'
};

function getScheduleDisplayName(key) {
    return scheduleDisplayNames[key] || key;
}

let currentSchedule = schedules.normal;
let currentScheduleName = 'normal';
const LUNCH_WAVE_KEY = 'lunchWave';

// Clear school-specific selections left by the previous build.
const INDY_SCHEDULE_MIGRATION_KEY = 'indyScheduleMigration_v1';
if (localStorage.getItem(INDY_SCHEDULE_MIGRATION_KEY) !== 'complete') {
    ['currentScheduleName', 'periodRenames', 'globalPeriodNames'].forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(INDY_SCHEDULE_MIGRATION_KEY, 'complete');
}

// Modify your DOMContentLoaded handler
document.addEventListener("DOMContentLoaded", async function() {
    await initializeAuth();
    // Remove the auth check that was showing the modal
    initializeApp();
    
    // Add login form handler
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('login-error');
        const loginButton = document.getElementById('login-button');

        try {
            loginButton.disabled = true;
            loginButton.textContent = 'Signing in...';
            
            const success = await window.authManager.login(username, password);
            if (success) {
                window.authManager.hideLoginModal();
                initializeApp(); // Initialize app after successful login
            } else {
                errorElement.textContent = 'Invalid username or password';
            }
        } catch (error) {
            errorElement.textContent = 'An error occurred during sign in';
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Sign In';
        }
    });


    initializeSettingsPanels();
    initializeWhatsNewTabs();
    // Ensure schedule dropdown reflects current grade after settings panels initialize
    try { updateScheduleDropdown(); } catch (e) { console.debug('updateScheduleDropdown post-init call failed', e); }
    // Bind inline handlers safely (keeps existing onclick attributes but also ensures listeners exist)
    if (typeof bindInlineHandlers === 'function') bindInlineHandlers();
});

// Migration: fix legacy '[object Object]' saved values for globalPeriodNames
// Run early so subsequent code reads a valid JSON string
(function migrateGlobalPeriodNames() {
    try {
        const raw = localStorage.getItem('globalPeriodNames');
        if (!raw) return;
        // If it's the specific broken sentinel string or it's not valid JSON, try to recover
        if (raw === '[object Object]') {
            // Try to recover from periodRenames if available
            try {
                const pr = JSON.parse(localStorage.getItem('periodRenames') || '{}');
                localStorage.setItem('globalPeriodNames', JSON.stringify(pr || {}));
                console.info('Migrated legacy globalPeriodNames from periodRenames');
                return;
            } catch (e) {
                // fallback to empty object
                localStorage.setItem('globalPeriodNames', JSON.stringify({}));
                console.info('Replaced legacy globalPeriodNames with empty object');
                return;
            }
        }

        // If not exact sentinel, check if JSON.parse fails; if so, try to coerce
        try {
            JSON.parse(raw);
        } catch (e) {
            // Attempt to coerce by checking if it looks like an object string (e.g., '[object Object]')
            if (raw.indexOf('[object') !== -1) {
                localStorage.setItem('globalPeriodNames', JSON.stringify({}));
                console.info('Normalized malformed globalPeriodNames to {}');
            } else {
                // Last resort: leave it alone — it may be a deliberate string value
            }
        }
    } catch (e) {
        console.warn('Error migrating globalPeriodNames', e);
    }
})();

// Ensure single timer loop via TimerManager
if (window.TimerManager && window.TimerManager.isRunning && window.TimerManager.isRunning()) {
    // already running
} else if (window.TimerManager) {
    window.TimerManager.start();
}

function initializeApp() {
    if (window.__indyAppInitialized) return;
    window.__indyAppInitialized = true;
    // Ensure DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeAppLogic();
        });
    } else {
        initializeAppLogic();
    }
}

function initializeAppLogic() {
    try {
        initializeSavedSchedules();
        const scheduleKey = window.IndyCalendar?.getScheduleKey(new Date()) || 'normal';
        switchSchedule(scheduleKey);
        updateScheduleDisplay();
        initializeLunchWaveControl();
        updateTodayAtIndy();
        if (window.TimerManager) window.TimerManager.restart();
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Schedule management functions
function getActiveSchedules() {
    return schedules;
}

function getLunchWave() {
    const wave = (localStorage.getItem(LUNCH_WAVE_KEY) || '').toUpperCase();
    return ['A', 'B', 'C'].includes(wave) ? wave : '';
}

function getSelectedLunchPeriod(scheduleName = currentScheduleName) {
    const wave = getLunchWave();
    return window.IndyCalendar?.getLunchPeriod(scheduleName, wave) || null;
}

function getTimelineSchedule(scheduleName = currentScheduleName, fallback = currentSchedule) {
    const calendar = window.IndyCalendar;
    if (!calendar?.SCHEDULES?.[scheduleName] || typeof calendar.getScheduleWithLunch !== 'function') {
        return fallback;
    }
    return calendar.getScheduleWithLunch(scheduleName, getLunchWave()) || fallback;
}

function setLunchWave(value) {
    const wave = (value || '').toUpperCase();
    if (['A', 'B', 'C'].includes(wave)) {
        localStorage.setItem(LUNCH_WAVE_KEY, wave);
    } else {
        localStorage.removeItem(LUNCH_WAVE_KEY);
    }
    updateScheduleDisplay();
    updateCountdowns();
    if (typeof saveSettings === 'function') saveSettings();
}

function initializeLunchWaveControl() {
    const select = document.getElementById('lunch-wave');
    if (select) select.value = getLunchWave();
}
window.setLunchWave = setLunchWave;

// Helper: convert 'HH:MM' to seconds since midnight
function getTimeInSeconds(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60;
}

// Helper: format 'HH:MM' (24-hour) to 12-hour time with AM/PM
function formatTime12(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return timeStr || '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let h = parseInt(parts[0], 10);
    const m = parts[1].padStart(2, '0');
    if (isNaN(h)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${period}`;
}

// Helper: format 'HH:MM' to 12-hour hour without AM/PM (e.g., '13:10' -> '1:10')
function formatHour12NoSuffix(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return timeStr || '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let h = parseInt(parts[0], 10);
    const m = parts[1].padStart(2, '0');
    if (isNaN(h)) return timeStr;
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m}`;
}

function getTimelinePeriodLabel(period) {
    if (!period) return '—';
    if (period.isLunch) return 'Lunch';
    const match = period.name?.match(/^Period\s+(\d+)$/i);
    if (!match) return period.name || '—';
    const periodNum = match[1];
    const label = getGlobalPeriodNames()[periodNum] || getPeriodRenames()[periodNum] || period.name;
    return period.segmentLabel ? `${label} · ${period.segmentLabel}` : label;
}

const IHS_CALENDAR_DATA_URL = 'data/ihs-calendar-events.json';
const IHS_CALENDAR_PAGE_URL = 'https://ihs.wcs.edu/calendar';
let ihsCalendarDataPromise;
let renderedCalendarDateKey = '';

function loadIhsCalendarData() {
    if (!ihsCalendarDataPromise) {
        ihsCalendarDataPromise = fetch(IHS_CALENDAR_DATA_URL, { cache: 'no-cache' })
            .then((response) => {
                if (!response.ok) throw new Error(`Calendar data returned ${response.status}`);
                return response.json();
            })
            .then((data) => {
                if (!data?.ready || !Array.isArray(data.events)) throw new Error('Calendar sync has not run yet');
                return data;
            });
    }
    return ihsCalendarDataPromise;
}

function formatCalendarEventTime(event) {
    if (event.allDay) return 'All day';
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit'
    });
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (Number.isNaN(start.getTime())) return 'Time not listed';
    return Number.isNaN(end.getTime())
        ? formatter.format(start)
        : `${formatter.format(start)}–${formatter.format(end)}`;
}

function renderIhsCalendarEvents(dateKey) {
    const container = document.getElementById('today-calendar-events');
    if (!container || renderedCalendarDateKey === dateKey) return;
    renderedCalendarDateKey = dateKey;
    container.textContent = 'Loading events…';

    loadIhsCalendarData().then((data) => {
        const todaysEvents = data.events
            .filter((event) => Array.isArray(event.days) && event.days.includes(dateKey))
            .slice(0, 4);
        container.replaceChildren();
        if (!todaysEvents.length) {
            container.textContent = 'No public IHS events are listed for today.';
            return;
        }

        const list = document.createElement('ul');
        todaysEvents.forEach((event) => {
            const item = document.createElement('li');
            const details = document.createElement('div');
            const title = document.createElement('strong');
            const time = document.createElement('span');
            title.textContent = event.title;
            time.textContent = formatCalendarEventTime(event);
            details.append(title, time);
            item.appendChild(details);
            if (event.location) {
                const location = document.createElement('small');
                location.textContent = event.location;
                item.appendChild(location);
            }
            list.appendChild(item);
        });
        container.appendChild(list);
    }).catch(() => {
        container.replaceChildren();
        const message = document.createElement('span');
        const link = document.createElement('a');
        message.textContent = 'Events are unavailable. ';
        link.href = IHS_CALENDAR_PAGE_URL;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Check the official calendar.';
        container.append(message, link);
    });
}

function updateTodayAtIndy(now = new Date()) {
    const card = document.getElementById('today-at-indy');
    const calendar = window.IndyCalendar;
    if (!card || !calendar) return;

    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };
    const dateKey = calendar.dateKey(now);
    renderIhsCalendarEvents(dateKey);
    const dayType = calendar.getDayType(dateKey);
    const scheduleKey = calendar.getScheduleKey(dateKey);
    const schedule = calendar.getScheduleWithLunch(scheduleKey, getLunchWave()) || calendar.SCHEDULES[scheduleKey] || [];
    const scheduleLabels = {
        normal: 'Regular',
        normalNoSoar: 'Regular · No SOAR',
        lateStart: 'Late Start',
        halfDay: 'Half Day'
    };
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: calendar.TIME_ZONE,
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    setText('today-date', dateFormatter.format(now));
    setText('today-schedule', dayType === 'noSchool' ? 'No School' : (scheduleLabels[scheduleKey] || 'Regular'));
    setText('today-dismissal', dayType === 'noSchool' || !schedule.length
        ? '—'
        : formatTime12(schedule[schedule.length - 1].end));

    const currentSeconds = calendar.secondsSinceMidnight(now);
    const currentPeriod = dayType === 'noSchool' ? null : schedule.find((period) => {
        const start = getTimeInSeconds(period.start);
        const end = getTimeInSeconds(period.end);
        return currentSeconds >= start && currentSeconds < end;
    });
    const nextPeriod = dayType === 'noSchool' ? null : schedule.find(
        (period) => getTimeInSeconds(period.start) > currentSeconds
    );
    const firstStart = schedule[0] ? getTimeInSeconds(schedule[0].start) : null;
    const lastEnd = schedule.length ? getTimeInSeconds(schedule[schedule.length - 1].end) : null;

    let currentLabel = getTimelinePeriodLabel(currentPeriod);
    if (dayType === 'noSchool') currentLabel = 'No school';
    else if (!currentPeriod && firstStart != null && currentSeconds < firstStart) currentLabel = 'Before school';
    else if (!currentPeriod && lastEnd != null && currentSeconds >= lastEnd) currentLabel = 'School finished';
    else if (!currentPeriod) currentLabel = 'Between classes';
    setText('today-current', currentLabel);
    setText('today-next', getTimelinePeriodLabel(nextPeriod));

    const lunch = calendar.getLunchPeriod(scheduleKey, getLunchWave());
    setText('today-lunch-time', dayType !== 'noSchool' && lunch
        ? `${formatTime12(lunch.start)}–${formatTime12(lunch.end)}`
        : '');

    const noticeText = dayType === 'noSchool'
        ? 'No school today.'
        : dayType === 'halfDay'
            ? 'Half day today · Dismissal at 11:15 AM.'
            : dayType === 'lateStart'
                ? 'Late start today · First period begins at 8:25 AM.'
                : scheduleKey === 'normalNoSoar'
                    ? 'Regular schedule · No SOAR today.'
                    : 'Regular schedule · SOAR meets today.';
    const notice = document.querySelector('#today-notice span');
    if (notice) notice.textContent = noticeText;

    const menuContainer = document.getElementById('today-lunch-menu');
    if (menuContainer) {
        menuContainer.replaceChildren();
        const menuService = window.IndyLunchMenu;
        const items = menuService?.getMenu(dateKey);
        if (dayType === 'noSchool') {
            menuContainer.textContent = 'No school today.';
        } else if (dayType === 'halfDay') {
            menuContainer.textContent = 'No cafeteria lunch on the half-day schedule.';
        } else if (items?.length) {
            const list = document.createElement('ul');
            items.forEach((item) => {
                const row = document.createElement('li');
                row.textContent = item;
                list.appendChild(row);
            });
            menuContainer.appendChild(list);
            if (menuService?.DAILY_OPTIONS) {
                const dailyOptions = document.createElement('p');
                dailyOptions.className = 'today-daily-options';
                dailyOptions.textContent = menuService.DAILY_OPTIONS;
                menuContainer.appendChild(dailyOptions);
            }
        } else {
            const message = document.createElement('span');
            message.textContent = 'A menu has not been uploaded for this date. ';
            const link = document.createElement('a');
            link.href = menuService?.OFFICIAL_MENU_URL || 'https://www.wcs.edu/about-us/menus-nutrition';
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = 'Check the official WCS menus and nutrition page.';
            menuContainer.append(message, link);
        }
    }

    const tomorrowKey = calendar.addDays(dateKey, 1);
    const tomorrowType = calendar.getDayType(tomorrowKey);
    if (tomorrowType === 'noSchool') {
        setText('tomorrow-summary', 'No school');
    } else {
        const tomorrowScheduleKey = calendar.getScheduleKey(tomorrowKey);
        const tomorrowSchedule = calendar.SCHEDULES[tomorrowScheduleKey] || [];
        const tomorrowFirst = tomorrowSchedule.find((period) => period.name === 'Period 1');
        const tomorrowName = scheduleLabels[tomorrowScheduleKey] || 'Regular';
        setText('tomorrow-summary', tomorrowFirst
            ? `${tomorrowName} · First bell ${formatTime12(tomorrowFirst.start)}`
            : tomorrowName);
    }
}

function setTodayPopupOpen(open) {
    const card = document.getElementById('today-at-indy');
    const backdrop = document.getElementById('today-card-backdrop');
    const toggle = document.getElementById('today-toggle');
    if (!card || !backdrop || !toggle) return;

    const shouldOpen = !!open;
    card.hidden = !shouldOpen;
    backdrop.hidden = !shouldOpen;
    card.classList.toggle('open', shouldOpen);
    document.body.classList.toggle('today-popup-open', shouldOpen);
    toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if (shouldOpen) {
        updateTodayAtIndy();
        document.getElementById('today-card-close')?.focus();
    } else {
        toggle.focus();
    }
}

function initializeTodayPopup() {
    const toggle = document.getElementById('today-toggle');
    const close = document.getElementById('today-card-close');
    const backdrop = document.getElementById('today-card-backdrop');
    const card = document.getElementById('today-at-indy');
    if (!toggle || toggle.dataset.bound === 'true') return;
    // Keep the dialog above the backdrop instead of inside the dashboard's
    // backdrop-filter stacking context, which would blur the dialog itself.
    if (card?.parentElement !== document.body) document.body.appendChild(card);
    toggle.dataset.bound = 'true';
    toggle.addEventListener('click', () => setTodayPopupOpen(true));
    close?.addEventListener('click', () => setTodayPopupOpen(false));
    backdrop?.addEventListener('click', () => setTodayPopupOpen(false));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !document.getElementById('today-at-indy')?.hidden) {
            setTodayPopupOpen(false);
        }
    });
}

document.addEventListener('DOMContentLoaded', initializeTodayPopup);

// Helper: get period renames from localStorage
function getPeriodRenames() {
    return JSON.parse(localStorage.getItem('periodRenames') || '{}');
}
function setPeriodRename(periodNum, newName) {
    const renames = getPeriodRenames();
    renames[periodNum] = newName;
    localStorage.setItem('periodRenames', JSON.stringify(renames));
}

// Helper: get global period names as an object
function getGlobalPeriodNames() {
    return JSON.parse(localStorage.getItem('globalPeriodNames') || '{}');
}

// Add periodNum to all periods in all schedules
function addPeriodNumsToSchedules() {
    [schedules].forEach(schedObj => {
        Object.values(schedObj).forEach(schedule => {
            let sequentialCounter = 1;
            schedule.forEach(period => {
                // Prefer explicit "Period N" numbers embedded in the name
                const m = (period && period.name) ? period.name.match(/^Period\s+(\d+)/i) : null;
                if (m && m[1]) {
                    period.periodNum = String(m[1]);
                    // keep sequentialCounter in sync (next unused)
                    sequentialCounter = Math.max(sequentialCounter, parseInt(m[1], 10) + 1);
                } else if (period && /^Period\b/i.test(period.name)) {
                    // fallback: if name starts with "Period" but no number, assign next sequential
                    period.periodNum = String(sequentialCounter++);
                } else {
                    // not a numbered period
                    period.periodNum = undefined;
                }
            });
        });
    });
}
addPeriodNumsToSchedules();

// Central TimerManager: single main interval that updates countdowns and (optionally) progress bar.
// This avoids duplicate intervals and race conditions between countdown and progress updates.
window.TimerManager = (function() {
    let mainInterval = null;
    let progressEnabled = (localStorage.getItem('progressBarEnabled') === 'true');

    function tick() {
        try {
            if (typeof updateCountdowns === 'function') updateCountdowns();
        } catch (e) { console.warn('TimerManager: updateCountdowns failed', e); }
        try {
            if (progressEnabled && typeof updateProgressBar === 'function') updateProgressBar();
        } catch (e) { console.warn('TimerManager: updateProgressBar failed', e); }
    }

    function start() {
        if (mainInterval) return mainInterval;
        tick();
        mainInterval = setInterval(tick, 1000);
        return mainInterval;
    }

    function stop() {
        if (mainInterval) {
            clearInterval(mainInterval);
            mainInterval = null;
        }
    }

    function restart() {
        stop();
        return start();
    }

    function setProgress(flag) {
        progressEnabled = !!flag;
        localStorage.setItem('progressBarEnabled', progressEnabled ? 'true' : 'false');
        // If enabling progress ensure the main loop is running so progress updates occur
        if (progressEnabled) start();
    }

    function isRunning() { return !!mainInterval; }
    function getIntervalId() { return mainInterval; }

    return { start, stop, restart, setProgress, isRunning, getIntervalId };
})();

// Apply renames to a schedule
function applyRenamesToSchedule(schedule) {
    const renames = getPeriodRenames();
    schedule.forEach(period => {
        if (period.periodNum && renames[period.periodNum]) {
            period.name = renames[period.periodNum];
        }
    });
}

// Update switchSchedule to apply renames
function switchSchedule(scheduleName) {
    if (!scheduleName) return;
    try {
        let schedule;
        if (scheduleName.startsWith('customSchedule_')) {
            const savedSchedule = localStorage.getItem(scheduleName);
            if (savedSchedule) {
                schedule = JSON.parse(savedSchedule);
            } else {
                console.error(`Custom schedule ${scheduleName} not found`);
                return;
            }
        } else {
            const activeSchedules = getActiveSchedules();
            if (activeSchedules[scheduleName]) {
                schedule = JSON.parse(JSON.stringify(activeSchedules[scheduleName]));
            } else {
                console.error(`Schedule ${scheduleName} not found`);
                return;
            }
        }
        applyRenamesToSchedule(schedule);
        currentSchedule = schedule;
        currentScheduleName = scheduleName;
        localStorage.setItem('currentScheduleName', scheduleName);
        const displayName = scheduleName.startsWith('customSchedule_') 
            ? scheduleName.replace('customSchedule_', '')
            : getScheduleDisplayName(scheduleName);
        const headingText = `${displayName} Schedule ▸ ${schedule[0].name}`;
        document.getElementById("countdown-heading").innerText = headingText;
        const dropdown = document.getElementById("schedule-dropdown");
        if (dropdown) dropdown.value = scheduleName;
        updateScheduleDisplay();
        updateCountdowns();
    console.debug(`Switched to schedule: ${scheduleName}`);
            if (typeof window.refreshDevtoolsOverlay === 'function') window.refreshDevtoolsOverlay();
    } catch (error) {
        console.error('Error switching schedule:', error);
        currentSchedule = schedules[scheduleName] || schedules.normal;
    }
}

// Replace duplicate renamePeriod implementations with one authoritative function
function renamePeriod(periodNumber, newName) {
    if (!periodNumber) return;
    const periodNumStr = String(periodNumber);

    // Do NOT mutate canonical built-in schedules. Keep built-ins unchanged and
    // rely on rename maps (periodRenames/globalPeriodNames) and applyRenamesToSchedule
    // when rendering or switching schedules. This avoids side-effects that break
    // lookups that rely on original names.

    // Update custom schedules stored in localStorage
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('customSchedule_')) {
            try {
                const customSchedule = JSON.parse(localStorage.getItem(key) || '[]');
                let modified = false;
                customSchedule.forEach(period => {
                    if (String(period.periodNum) === periodNumStr) {
                        period.name = newName;
                        modified = true;
                    }
                });
                if (modified) {
                    localStorage.setItem(key, JSON.stringify(customSchedule));
                }
            } catch (e) {
                console.warn('Invalid custom schedule in localStorage for key', key);
            }
        }
    });

    // Persist rename maps
    const globalNames = getGlobalPeriodNames();
    const renames = getPeriodRenames();

    // Use the canonical default name ("Period N") as the baseline for when to remove a mapping.
    // This avoids comparing against in-memory schedules which may have already been mutated
    // earlier in this function and would therefore incorrectly equal the newName.
    const canonicalDefault = `Period ${periodNumber}`;

    if (!newName || !newName.trim() || newName.trim() === canonicalDefault) {
        delete globalNames[periodNumStr];
        delete renames[periodNumStr];
    } else {
        globalNames[periodNumStr] = newName;
        renames[periodNumStr] = newName;
    }

    localStorage.setItem('globalPeriodNames', JSON.stringify(globalNames));
    localStorage.setItem('periodRenames', JSON.stringify(renames));

    // If the current schedule is one of the built-ins, recreate a fresh copy and apply renames
    const activeSchedules = getActiveSchedules();
    if (activeSchedules[currentScheduleName]) {
        // Copy from canonical source to avoid previous in-memory mutations
        currentSchedule = JSON.parse(JSON.stringify(activeSchedules[currentScheduleName]));
        applyRenamesToSchedule(currentSchedule);
    } else {
        // If custom schedule is active, reload it from storage (if present)
        if (currentScheduleName && currentScheduleName.startsWith('customSchedule_')) {
            const saved = localStorage.getItem(currentScheduleName);
            if (saved) currentSchedule = JSON.parse(saved);
        }
        applyRenamesToSchedule(currentSchedule);
    }

    // Update inputs/UI if present
    const inputBox = document.getElementById(`period-${periodNumStr}`);
    if (inputBox) inputBox.value = newName;

    // Refresh schedule display and countdown
    updateScheduleDisplay();
    updateCountdowns();

    // Restart centralized timer loop to ensure visual consistency
    if (window.TimerManager && typeof window.TimerManager.restart === 'function') {
        window.TimerManager.restart();
    } else {
        // Fallback to legacy startCountdown if TimerManager isn't present
        if (typeof startCountdown === 'function') {
            startCountdown();
        }
    }

    // Persist the change to settings if applicable
    if (typeof saveSettings === 'function') saveSettings();

    console.debug(`Renamed period ${periodNumStr} => "${newName}"`);
    if (typeof window.refreshDevtoolsOverlay === 'function') window.refreshDevtoolsOverlay();
}
window.renamePeriod = renamePeriod; // ensure globally accessible


// Replace populateRenamePeriods implementation with one that uses periodNum keys
function populateRenamePeriods() {
    const content = document.getElementById("rename-periods-content");
    if (!content) return;
    content.innerHTML = '';

    const globalNames = getGlobalPeriodNames();
    const renames = getPeriodRenames();
    // Use the schedules for the currently selected grade level so periodNum indices match
    const activeSchedules = getActiveSchedules();
    const originalSchedule = activeSchedules[currentScheduleName] || currentSchedule || activeSchedules['normal'];

    // Iterate original schedule and add inputs for numbered periods only
    originalSchedule.forEach(origPeriod => {
        const pn = origPeriod && origPeriod.periodNum;
        if (!pn) return;

        // Skip non-user-editable types by name
        const skipIf = ['Passing', 'Lunch'];
        if (skipIf.some(s => (origPeriod.name || '').includes(s))) return;

        const periodNumber = String(pn);
        const defaultName = `Period ${periodNumber}`;
        const globalName = globalNames[periodNumber];
        const renameName = renames[periodNumber];
        const inputValue = (globalName && globalName.trim()) ? globalName
            : (renameName && renameName.trim()) ? renameName
            : (origPeriod.name && origPeriod.name.trim()) ? origPeriod.name
            : defaultName;

        const div = document.createElement('div');
        div.className = 'rename-period';

        const label = document.createElement('label');
        label.htmlFor = `period-${periodNumber}`;
        label.textContent = `Period ${periodNumber}:`;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `period-${periodNumber}`;
        input.value = inputValue;
        input.onchange = (e) => {
            // Use global renamePeriod
            renamePeriod(periodNumber, e.target.value);
        };

        div.appendChild(label);
        div.appendChild(input);
        content.appendChild(div);
    });
}
window.populateRenamePeriods = populateRenamePeriods;

// Initialize console capture globally so logs from page load are preserved
(function initGlobalDevConsole(){
    if (window.__devConsoleGlobalInit) return;
    window.__devConsoleGlobalInit = true;
    window.__devConsoleBuffer = window.__devConsoleBuffer || [];
    window.__origConsole = window.__origConsole || {};
    window.__devConsolePauseCapture = window.__devConsolePauseCapture || false;
    ['log','info','warn','error','debug'].forEach(level => {
        try {
            window.__origConsole[level] = console[level].bind(console);
            console[level] = function(...args){
                try {
                    if (!window.__devConsolePauseCapture) {
                        window.__devConsoleBuffer.push({ level, args, time: new Date().toLocaleTimeString() });
                        if (window.__devConsoleBuffer.length > 1000) window.__devConsoleBuffer.shift();
                    }
                } catch (e) { }
                try { window.__origConsole[level](...args); } catch (e) { }
            };
        } catch (e) { }
    });
})();

// --- DEVTOOLS secret debug overlay ---
// Shows a small overlay only when the user types the sequence 'DEVTOOLS'.
(() => {
    const sequence = '/dev';
    let buffer = '';
    function ensureDevtoolsStyles() {
        if (document.getElementById('devtools-style')) return;
        const style = document.createElement('style');
        style.id = 'devtools-style';
        style.textContent = `
        #devtools-debug-overlay::-webkit-scrollbar,
        #devtools-debug-content::-webkit-scrollbar,
        #devtools-console-content::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        #devtools-debug-overlay::-webkit-scrollbar-thumb,
        #devtools-debug-content::-webkit-scrollbar-thumb,
        #devtools-console-content::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, rgba(196,173,98,0.9), rgba(0,0,53,0.85));
            border-radius: 999px;
            border: 2px solid rgba(7,10,26,0.8);
        }
        #devtools-debug-overlay::-webkit-scrollbar-track,
        #devtools-debug-content::-webkit-scrollbar-track,
        #devtools-console-content::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05);
            border-radius: 999px;
        }
        `;
        document.head.appendChild(style);
    }

    function toggleDevtoolsHud() {
        const existing = document.getElementById('devtools-hud');
        if (existing) {
            if (existing._raf) cancelAnimationFrame(existing._raf);
            if (existing._timer) clearInterval(existing._timer);
            if (existing._pingTimer) clearInterval(existing._pingTimer);
            if (existing._driftInterval) clearInterval(existing._driftInterval);
            existing.remove();
            try { localStorage.setItem('devtoolsHudEnabled', 'false'); } catch (e) {}
            return;
        }

        const hud = document.createElement('div');
        hud.id = 'devtools-hud';
        hud.style.position = 'fixed';
        hud.style.top = '12px';
        hud.style.left = '12px';
        hud.style.zIndex = 2147483645;
        hud.style.minWidth = '220px';
        hud.style.padding = '14px 16px';
        hud.style.borderRadius = '14px';
        hud.style.background = 'linear-gradient(155deg, rgba(0,0,53,0.9), rgba(12,16,32,0.94))';
        hud.style.border = 'none';
        hud.style.boxShadow = '0 14px 36px rgba(0,0,0,0.62), 0 0 0 1px rgba(0,0,53,0.45), inset 0 1px 0 rgba(255,255,255,0.08)';
        hud.style.color = '#fff';
        hud.style.fontFamily = 'Inter, "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif';
        hud.style.fontSize = '12px';
        hud.style.pointerEvents = 'none';

        const title = document.createElement('div');
        title.textContent = 'Live Stats';
        title.style.fontWeight = '800';
        title.style.letterSpacing = '0.08em';
        title.style.marginBottom = '10px';
        title.style.fontSize = '12px';
        title.style.textTransform = 'uppercase';
        title.style.color = '#f5e7c0';
        title.style.textShadow = '0 0 10px rgba(196,173,98,0.45)';
        hud.appendChild(title);

        const row = (label) => {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.justifyContent = 'space-between';
            wrap.style.gap = '10px';
            wrap.style.marginBottom = '4px';
            wrap.style.opacity = '0.9';
            const l = document.createElement('span');
            l.textContent = label;
            l.style.color = '#d9e2ff';
            const v = document.createElement('span');
            v.style.fontWeight = '700';
            v.style.color = '#f8f4e8';
            v.style.textAlign = 'right';
            wrap.appendChild(l);
            wrap.appendChild(v);
            hud.appendChild(wrap);
            return v;
        };

        const fpsVal = row('FPS');
        const authVal = row('Auth');
        const schedVal = row('Schedule');
        const timerVal = row('Timer');
        const memVal = row('Memory');
        const lagVal = row('Latency');
        const driftVal = row('Timer Drift');
        const onlineVal = row('Online Status');
        const pingVal = row('Ping');

        let fps = 0;
        let last = performance.now();
        const tick = (now) => {
            const delta = now - last;
            last = now;
            const instant = 1000 / (delta || 1);
            fps = fps * 0.9 + instant * 0.1;
            fpsVal.textContent = `${fps.toFixed(1)}`;
            hud._raf = requestAnimationFrame(tick);
        };
        hud._raf = requestAnimationFrame(tick);

        let driftMs = 0;
        let lastDrift = performance.now();
        hud._driftInterval = setInterval(() => {
            const now = performance.now();
            driftMs = Math.abs((now - lastDrift) - 1000);
            lastDrift = now;
        }, 1000);

        const updateHud = async () => {
            const authUser = window.authManager?.currentUser?.email || 'signed out';
            const schedule = typeof currentScheduleName !== 'undefined' ? currentScheduleName : '(unknown)';
            const timerRunning = !!(window.TimerManager && window.TimerManager.isRunning && window.TimerManager.isRunning());
            authVal.textContent = authUser;
            schedVal.textContent = schedule;
            timerVal.textContent = timerRunning ? 'running' : 'idle';
            if (performance && performance.memory) {
                const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
                const mb = (usedJSHeapSize / 1048576).toFixed(1);
                const total = (totalJSHeapSize / 1048576).toFixed(1);
                memVal.textContent = `${mb} / ${total} MB`;
            } else {
                memVal.textContent = 'n/a';
            }
            const start = performance.now();
            await Promise.resolve();
            const now = performance.now();
            lagVal.textContent = `${Math.max(0, now - start).toFixed(1)} ms`;
            driftVal.textContent = `${driftMs.toFixed(1)} ms`;
            const online = navigator.onLine ? 'Online' : 'Offline';
            onlineVal.textContent = online;
            onlineVal.style.color = navigator.onLine ? '#8ff7d8' : '#ffdede';
        };
        updateHud();
        hud._timer = setInterval(updateHud, 1000);

        // Ping updater
        const pingEndpoint = window.location.href;
        const updatePing = async () => {
            const t0 = performance.now();
            try {
                await fetch(pingEndpoint, { method: 'HEAD', cache: 'no-store' });
                const dur = performance.now() - t0;
                pingVal.textContent = `${dur.toFixed(0)} ms`;
            } catch (e) {
                pingVal.textContent = 'fail';
            }
        };
        updatePing();
        hud._pingTimer = setInterval(updatePing, 10000);

        document.body.appendChild(hud);
        try { localStorage.setItem('devtoolsHudEnabled', 'true'); } catch (e) {}
    }

    function showDebugOverlay() {
    if (document.getElementById('devtools-debug-overlay')) return;
    ensureDevtoolsStyles();
    // create backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'devtools-debug-backdrop';
    backdrop.style.position = 'fixed';
    backdrop.style.inset = '0';
    backdrop.style.zIndex = 2147483646;
    backdrop.style.background = 'radial-gradient(circle at 20% 20%, rgba(0,0,53,0.18), transparent 35%), radial-gradient(circle at 80% 0%, rgba(196,173,98,0.18), transparent 40%), rgba(7,10,26,0.6)';
    document.body.appendChild(backdrop);

    const overlay = document.createElement('div');
    overlay.id = 'devtools-debug-overlay';
    overlay.style.position = 'fixed';
        overlay.style.left = '50%';
        overlay.style.top = '50%';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.zIndex = 2147483647;
        overlay.style.background = 'linear-gradient(135deg, rgba(7,10,26,0.92), rgba(8,17,44,0.9))';
        overlay.style.color = '#E8ECF7';
        overlay.style.padding = '16px 18px';
        overlay.style.borderRadius = '18px';
        overlay.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace';
        overlay.style.maxWidth = '760px';
        overlay.style.maxHeight = '80vh';
        overlay.style.boxShadow = '0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)';
        overlay.style.backdropFilter = 'blur(12px) saturate(140%)';
        overlay.style.border = '1px solid rgba(255,255,255,0.08)';
        overlay.style.overflow = 'hidden';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
    overlay.style.pointerEvents = 'auto';
        // Restore saved position/size if available
        try {
            const saved = JSON.parse(localStorage.getItem('devtoolsOverlayPlacement') || '{}');
            if (saved.top !== undefined) { overlay.style.top = `${saved.top}px`; overlay.style.transform = 'none'; }
            if (saved.left !== undefined) { overlay.style.left = `${saved.left}px`; overlay.style.transform = 'none'; }
            if (saved.width !== undefined) overlay.style.width = `${saved.width}px`;
            if (saved.height !== undefined) overlay.style.height = `${saved.height}px`;
        } catch (e) {}

        // Header with title, tabs and button group so buttons don't overlap the title
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.gap = '12px';
        header.style.marginBottom = '12px';

        const leftGroup = document.createElement('div');
        leftGroup.style.display = 'flex';
        leftGroup.style.flexDirection = 'column';

        const title = document.createElement('div');
        title.style.fontWeight = '800';
        title.style.letterSpacing = '0.02em';
        title.style.fontSize = '16px';
        title.textContent = 'Dev Tools';
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.gap = '8px';

        const errorBadge = document.createElement('span');
        errorBadge.id = 'devtools-error-badge';
        errorBadge.style.display = 'inline-flex';
        errorBadge.style.alignItems = 'center';
        errorBadge.style.justifyContent = 'center';
        errorBadge.style.minWidth = '22px';
        errorBadge.style.padding = '2px 7px';
        errorBadge.style.borderRadius = '999px';
        errorBadge.style.background = 'rgba(255,107,107,0.25)';
        errorBadge.style.color = '#ffdede';
        errorBadge.style.fontSize = '11px';
        errorBadge.style.fontWeight = '800';
        errorBadge.style.border = '1px solid rgba(255,255,255,0.12)';
        errorBadge.textContent = '0';
        errorBadge.title = 'Errors in console';
        title.appendChild(errorBadge);

        const stateLine = document.createElement('div');
        stateLine.style.display = 'flex';
        stateLine.style.flexWrap = 'wrap';
        stateLine.style.gap = '10px';
        stateLine.style.marginTop = '6px';
        stateLine.style.fontSize = '12px';
        stateLine.style.opacity = '0.9';
        function computeStateLine() {
            const schedule = typeof currentScheduleName !== 'undefined' ? currentScheduleName : '(unknown schedule)';
            const authUser = window.authManager?.currentUser?.email || (window.authManager?.currentUser?.displayName || 'signed out');
            const timerRunning = !!(window.TimerManager && window.TimerManager.isRunning && window.TimerManager.isRunning());
            const toastOn = typeof isToastIconEnabled === 'function'
                ? isToastIconEnabled()
                : (localStorage.getItem('toastIconEnabled') === 'true');
            stateLine.innerHTML = `
                <span>Schedule: <strong>${schedule}</strong></span>
                <span>Auth: <strong>${authUser}</strong></span>
                <span>Timer: <strong>${timerRunning ? 'running' : 'idle'}</strong></span>
                <span>Toast icon: <strong>${toastOn ? 'on' : 'off'}</strong></span>
            `;
        }
        computeStateLine();

        // Tabs: Debug | Console
        const tabs = document.createElement('div');
        tabs.style.display = 'flex';
        tabs.style.gap = '8px';
        tabs.style.marginTop = '10px';

        const debugTab = document.createElement('button');
        debugTab.textContent = 'Local Storage';
        debugTab.setAttribute('role','tab');
        debugTab.setAttribute('aria-pressed','true');
        debugTab.tabIndex = 0;
        debugTab.style.cursor = 'pointer';
        debugTab.style.padding = '10px 16px';
        debugTab.style.borderRadius = '999px';
        debugTab.style.background = 'linear-gradient(120deg, rgba(196,173,98,0.28), rgba(0,0,53,0.35))';
        debugTab.style.border = '1px solid rgba(255,255,255,0.18)';
        debugTab.style.color = '#E8ECF7';
        debugTab.style.fontWeight = '700';
        debugTab.style.minWidth = '80px';
        debugTab.style.textAlign = 'center';
        debugTab.dataset.tab = 'debug';

        const consoleTab = document.createElement('button');
        consoleTab.textContent = 'Console';
        consoleTab.setAttribute('role','tab');
        consoleTab.setAttribute('aria-pressed','false');
        consoleTab.tabIndex = 0;
        consoleTab.style.cursor = 'pointer';
        consoleTab.style.padding = '10px 16px';
        consoleTab.style.borderRadius = '999px';
        consoleTab.style.background = 'transparent';
        consoleTab.style.border = '1px solid rgba(255,255,255,0.08)';
        consoleTab.style.color = 'rgba(232,236,247,0.88)';
        consoleTab.style.fontWeight = '700';
        consoleTab.style.minWidth = '80px';
        consoleTab.style.textAlign = 'center';
        consoleTab.dataset.tab = 'console';

        tabs.appendChild(debugTab);
        tabs.appendChild(consoleTab);

        leftGroup.appendChild(title);
        leftGroup.appendChild(stateLine);
        leftGroup.appendChild(tabs);

        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '8px';
        btnGroup.style.flexWrap = 'wrap';

        const toastToggleBtn = document.createElement('button');
        toastToggleBtn.style.cursor = 'pointer';
        toastToggleBtn.style.padding = '10px 12px';
        toastToggleBtn.style.borderRadius = '10px';
        toastToggleBtn.style.border = '1px solid rgba(255,255,255,0.12)';
        toastToggleBtn.style.background = 'rgba(246,214,140,0.14)';
        toastToggleBtn.style.color = '#ffe7a4';
        toastToggleBtn.style.fontWeight = '700';
        function syncToastToggleLabel() {
            const enabled = typeof isToastIconEnabled === 'function'
                ? isToastIconEnabled()
                : (localStorage.getItem('toastIconEnabled') === 'true');
            toastToggleBtn.textContent = enabled ? 'Toast icon: on (click to disable)' : 'Toast icon: off (click to enable)';
        }
        syncToastToggleLabel();
        toastToggleBtn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            try {
                const currentlyOn = typeof isToastIconEnabled === 'function'
                    ? isToastIconEnabled()
                    : (localStorage.getItem('toastIconEnabled') === 'true');
                const next = !currentlyOn;
                localStorage.setItem('toastIconEnabled', String(next));
                if (typeof updateToastIcon === 'function') updateToastIcon();
                if (window.authManager?.currentUser) {
                    await window.authManager.saveAllUserSettings(window.authManager.currentUser.uid);
                }
                const status = document.getElementById('devtools-clean-status');
                if (status) status.textContent = `Toast icon ${next ? 'enabled' : 'disabled'} for this browser/user.`;
                syncToastToggleLabel();
                computeStateLine();
            } catch (e) {
                console.error('Failed to toggle toast icon', e);
                toastToggleBtn.textContent = 'Toggle failed';
                setTimeout(syncToastToggleLabel, 1600);
            }
        });

        const simulateScheduleBtn = document.createElement('button');
        simulateScheduleBtn.textContent = 'Simulate schedule change';
        simulateScheduleBtn.style.cursor = 'pointer';
        simulateScheduleBtn.style.padding = '10px 12px';
        simulateScheduleBtn.style.borderRadius = '10px';
        simulateScheduleBtn.style.border = '1px solid rgba(255,255,255,0.12)';
        simulateScheduleBtn.style.background = 'rgba(158,234,212,0.14)';
        simulateScheduleBtn.style.color = '#c4ad62';
        simulateScheduleBtn.style.fontWeight = '700';
        simulateScheduleBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            try {
                const active = typeof getActiveSchedules === 'function' ? getActiveSchedules() : schedules;
                const keys = Object.keys(active || {});
                if (!keys.length) throw new Error('No schedules available');
                const currentIdx = Math.max(0, keys.indexOf(currentScheduleName));
                const nextKey = keys[(currentIdx + 1) % keys.length];
                if (typeof switchSchedule === 'function') switchSchedule(nextKey);
                const status = document.getElementById('devtools-clean-status');
                if (status) status.textContent = `Simulated switch to "${nextKey}".`;
                computeStateLine();
            } catch (e) {
                console.error('Failed to simulate schedule change', e);
                simulateScheduleBtn.textContent = 'Sim failed';
                setTimeout(() => { simulateScheduleBtn.textContent = 'Simulate schedule change'; }, 1600);
            }
        });

        const hudBtn = document.createElement('button');
        hudBtn.textContent = 'Live HUD';
        hudBtn.style.cursor = 'pointer';
        hudBtn.style.padding = '10px 12px';
        hudBtn.style.borderRadius = '10px';
        hudBtn.style.border = 'none';
        hudBtn.style.background = 'rgba(255,255,255,0.14)';
        hudBtn.style.color = '#fff';
        hudBtn.style.fontWeight = '700';
        hudBtn.style.fontFamily = 'Inter, "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif';
        const syncHudBtnLabel = () => {
            const on = document.getElementById('devtools-hud');
            hudBtn.textContent = on ? 'Hide HUD' : 'Live HUD';
        };
        hudBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            toggleDevtoolsHud();
            syncHudBtnLabel();
        });
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.padding = '10px 12px';
        closeBtn.style.borderRadius = '10px';
        closeBtn.style.border = '1px solid rgba(255,255,255,0.12)';
        closeBtn.style.background = 'rgba(255,255,255,0.08)';
        closeBtn.style.color = '#E8ECF7';
        closeBtn.addEventListener('click', (ev) => { ev.stopPropagation(); overlay.remove(); const bd = document.getElementById('devtools-debug-backdrop'); if (bd) bd.remove(); });
        
        // Add Clear localStorage button (with snapshot so Undo can restore)
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear localStorage';
        clearBtn.style.cursor = 'pointer';
        clearBtn.style.marginLeft = '8px';
        clearBtn.style.padding = '10px 12px';
        clearBtn.style.borderRadius = '10px';
        clearBtn.style.border = '1px solid rgba(255,255,255,0.12)';
        clearBtn.style.background = 'rgba(255,107,107,0.14)';
        clearBtn.style.color = '#ffdede';
        clearBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
        const ok = confirm('Clear all localStorage? This will remove all saved settings. Continue?');
            if (!ok) return;
            try {
                // take a snapshot so undoNormalization can restore
                if (typeof takeNormalizationSnapshot === 'function') takeNormalizationSnapshot();
                localStorage.clear();
                refreshDebugOverlay();
                const status = document.getElementById('devtools-clean-status');
                if (status) status.textContent = 'localStorage cleared for this browser.';
            } catch (e) {
                console.error('Failed to clear localStorage', e);
                alert('Failed to clear localStorage (see console)');
            }
        });
        btnGroup.appendChild(toastToggleBtn);
        btnGroup.appendChild(simulateScheduleBtn);
        btnGroup.appendChild(hudBtn);
        btnGroup.appendChild(clearBtn);
        btnGroup.appendChild(closeBtn);

        header.appendChild(leftGroup);
        header.appendChild(btnGroup);
        overlay.appendChild(header);

        // Draggable overlay (header as drag handle)
        (function enableDrag() {
            let dragging = false;
            let startX = 0, startY = 0, startLeft = 0, startTop = 0;
            header.style.cursor = 'move';
            header.addEventListener('mousedown', (e) => {
                dragging = true;
                startX = e.clientX; startY = e.clientY;
                const rect = overlay.getBoundingClientRect();
                startLeft = rect.left; startTop = rect.top;
                document.body.style.userSelect = 'none';
            });
            window.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                overlay.style.left = `${startLeft + dx}px`;
                overlay.style.top = `${startTop + dy}px`;
                overlay.style.right = '';
                overlay.style.bottom = '';
            });
            window.addEventListener('mouseup', () => {
                if (!dragging) return;
                dragging = false;
                document.body.style.userSelect = '';
                try {
                    const rect = overlay.getBoundingClientRect();
                    localStorage.setItem('devtoolsOverlayPlacement', JSON.stringify({
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                    }));
                } catch (e) {}
            });
        })();

        // Resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.right = '6px';
        resizeHandle.style.bottom = '6px';
        resizeHandle.style.width = '16px';
        resizeHandle.style.height = '16px';
        resizeHandle.style.borderRight = '2px solid rgba(255,255,255,0.3)';
        resizeHandle.style.borderBottom = '2px solid rgba(255,255,255,0.3)';
        resizeHandle.style.cursor = 'nwse-resize';
        overlay.appendChild(resizeHandle);
        (function enableResize() {
            let resizing = false;
            let startX = 0, startY = 0, startW = 0, startH = 0;
            resizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                resizing = true;
                const rect = overlay.getBoundingClientRect();
                startX = e.clientX; startY = e.clientY;
                startW = rect.width; startH = rect.height;
                document.body.style.userSelect = 'none';
            });
            window.addEventListener('mousemove', (e) => {
                if (!resizing) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                overlay.style.width = `${Math.max(420, startW + dx)}px`;
                overlay.style.height = `${Math.max(300, startH + dy)}px`;
            });
            window.addEventListener('mouseup', () => {
                if (!resizing) return;
                resizing = false;
                document.body.style.userSelect = '';
                try {
                    const rect = overlay.getBoundingClientRect();
                    localStorage.setItem('devtoolsOverlayPlacement', JSON.stringify({
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                    }));
                } catch (e) {}
            });
        })();

    const status = document.createElement('div');
    status.id = 'devtools-clean-status';
    status.style.marginTop = '10px';
    status.style.fontSize = '12px';
    status.style.opacity = '0.9';
    status.style.padding = '8px 10px';
    status.style.borderRadius = '10px';
    status.style.background = 'rgba(255,255,255,0.06)';
    overlay.appendChild(status);

    // Debug JSON content
    const debugContent = document.createElement('div');
    debugContent.id = 'devtools-debug-content';
    debugContent.style.whiteSpace = 'normal';
    debugContent.style.marginTop = '14px';
    debugContent.style.display = 'block';
    debugContent.style.fontSize = '13px';
    debugContent.style.lineHeight = '1.45';
    debugContent.style.maxHeight = 'calc(80vh - 230px)';
    debugContent.style.overflow = 'auto';
    debugContent.style.padding = '14px';
    debugContent.style.borderRadius = '12px';
    debugContent.style.background = 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.04))';
    debugContent.style.border = '1px solid rgba(255,255,255,0.06)';
    debugContent.style.display = 'grid';
    debugContent.style.gridTemplateColumns = '1.2fr 1.8fr';
    debugContent.style.columnGap = '12px';
    debugContent.style.rowGap = '6px';
    debugContent.style.alignItems = 'start';
    overlay.appendChild(debugContent);

    // Console content (hidden by default)
    const consoleContent = document.createElement('div');
    consoleContent.id = 'devtools-console-content';
    consoleContent.style.marginTop = '12px';
    consoleContent.style.display = 'none';
    consoleContent.style.maxHeight = 'calc(80vh - 230px)';
    consoleContent.style.overflow = 'auto';
    consoleContent.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace';
    consoleContent.style.fontSize = '13px';
    consoleContent.style.lineHeight = '1.4';
    consoleContent.style.background = 'rgba(4,7,18,0.6)';
    consoleContent.style.padding = '10px';
    consoleContent.style.borderRadius = '12px';
    consoleContent.style.border = '1px solid rgba(255,255,255,0.06)';
    overlay.appendChild(consoleContent);

    // Small console controls
    const consoleControls = document.createElement('div');
    consoleControls.style.display = 'none';
    consoleControls.style.gap = '8px';
    consoleControls.style.marginTop = '10px';
    consoleControls.style.justifyContent = 'flex-end';

    const filterSelect = document.createElement('select');
    filterSelect.style.borderRadius = '999px';
    filterSelect.style.padding = '8px 12px';
    filterSelect.style.border = '1px solid rgba(255,255,255,0.12)';
    filterSelect.style.background = 'rgba(255,255,255,0.06)';
    filterSelect.style.color = '#E8ECF7';
    ['all','error','warn','info','debug','log'].forEach(level => {
        const opt = document.createElement('option');
        opt.value = level;
        opt.textContent = `Show ${level}`;
        filterSelect.appendChild(opt);
    });
    filterSelect.value = window.__devConsoleFilterLevel || 'all';
    filterSelect.addEventListener('change', (ev) => {
        window.__devConsoleFilterLevel = ev.target.value;
        refreshConsoleOverlay();
    });

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search logs…';
    searchInput.style.padding = '8px 12px';
    searchInput.style.borderRadius = '10px';
    searchInput.style.border = '1px solid rgba(255,255,255,0.12)';
    searchInput.style.background = 'rgba(255,255,255,0.06)';
    searchInput.style.color = '#E8ECF7';
    searchInput.value = window.__devConsoleSearch || '';
    searchInput.addEventListener('input', (ev) => {
        window.__devConsoleSearch = ev.target.value;
        refreshConsoleOverlay();
    });

    const preserveToggle = document.createElement('button');
    preserveToggle.textContent = window.__devConsolePreserve ? 'Preserve log: on' : 'Preserve log: off';
    preserveToggle.style.cursor = 'pointer';
    preserveToggle.style.padding = '8px 12px';
    preserveToggle.style.borderRadius = '999px';
    preserveToggle.style.border = '1px solid rgba(255,255,255,0.12)';
    preserveToggle.style.background = 'rgba(255,255,255,0.06)';
    preserveToggle.style.color = '#E8ECF7';
    preserveToggle.addEventListener('click', (ev) => {
        ev.stopPropagation();
        window.__devConsolePreserve = !window.__devConsolePreserve;
        preserveToggle.textContent = window.__devConsolePreserve ? 'Preserve log: on' : 'Preserve log: off';
    });

    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = window.__devConsolePauseCapture ? 'Resume capture' : 'Pause capture';
    pauseBtn.style.cursor = 'pointer';
    pauseBtn.style.padding = '8px 12px';
    pauseBtn.style.borderRadius = '999px';
    pauseBtn.style.border = '1px solid rgba(255,255,255,0.12)';
    pauseBtn.style.background = 'rgba(255,255,255,0.06)';
    pauseBtn.style.color = '#E8ECF7';
    pauseBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        window.__devConsolePauseCapture = !window.__devConsolePauseCapture;
        pauseBtn.textContent = window.__devConsolePauseCapture ? 'Resume capture' : 'Pause capture';
        refreshConsoleOverlay();
    });

    const clearConsoleBtn = document.createElement('button');
    clearConsoleBtn.textContent = 'Clear Console';
    clearConsoleBtn.style.cursor = 'pointer';
    clearConsoleBtn.style.padding = '8px 12px';
    clearConsoleBtn.style.borderRadius = '999px';
    clearConsoleBtn.style.border = '1px solid rgba(255,255,255,0.12)';
    clearConsoleBtn.style.background = 'rgba(255,255,255,0.06)';
    clearConsoleBtn.style.color = '#E8ECF7';
    clearConsoleBtn.addEventListener('click', (ev) => { ev.stopPropagation(); window.__devConsoleBuffer = []; refreshConsoleOverlay(); });

    const copyLatestErrorBtn = document.createElement('button');
    copyLatestErrorBtn.textContent = 'Copy latest error';
    copyLatestErrorBtn.style.cursor = 'pointer';
    copyLatestErrorBtn.style.padding = '8px 12px';
    copyLatestErrorBtn.style.borderRadius = '999px';
    copyLatestErrorBtn.style.border = '1px solid rgba(255,255,255,0.12)';
    copyLatestErrorBtn.style.background = 'rgba(255,107,107,0.18)';
    copyLatestErrorBtn.style.color = '#ffdede';
    copyLatestErrorBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        try {
            const latestError = [...(window.__devConsoleBuffer || [])].reverse().find(l => l.level === 'error');
            if (!latestError) { alert('No errors logged yet'); return; }
            const text = `[${latestError.time}] ERROR: ${latestError.args.map(a=> {
                try { return typeof a==='object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
            }).join(' ')}`;
            navigator.clipboard.writeText(text);
            alert('Copied latest error');
        } catch (e) {
            alert('Copy failed');
        }
    });

    const copyConsoleBtn = document.createElement('button');
    copyConsoleBtn.textContent = 'Copy Logs';
    copyConsoleBtn.style.cursor = 'pointer';
    copyConsoleBtn.style.padding = '8px 12px';
    copyConsoleBtn.style.borderRadius = '999px';
    copyConsoleBtn.style.border = '1px solid rgba(255,255,255,0.12)';
    copyConsoleBtn.style.background = 'rgba(196,173,98,0.12)';
    copyConsoleBtn.style.color = '#f8f3e3';
    copyConsoleBtn.addEventListener('click', (ev) => { ev.stopPropagation(); try { const text = window.__devConsoleBuffer.map(l=>`[${l.time}] ${l.level.toUpperCase()}: ${l.args.map(a=> (typeof a==='object'?JSON.stringify(a):String(a))).join(' ')}\n`).join(''); navigator.clipboard.writeText(text); alert('Copied console logs to clipboard'); } catch(e){ alert('Copy failed'); } });

    const downloadConsoleBtn = document.createElement('button');
    downloadConsoleBtn.textContent = 'Download JSON';
    downloadConsoleBtn.style.cursor = 'pointer';
    downloadConsoleBtn.style.padding = '8px 12px';
    downloadConsoleBtn.style.borderRadius = '999px';
    downloadConsoleBtn.style.border = '1px solid rgba(255,255,255,0.12)';
    downloadConsoleBtn.style.background = 'rgba(158,234,212,0.12)';
    downloadConsoleBtn.style.color = '#d2fff2';
    downloadConsoleBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        try {
            const blob = new Blob([JSON.stringify(window.__devConsoleBuffer || [], null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `devtools-logs-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) { alert('Download failed'); }
    });

    const copySettingsBtn = document.createElement('button');
    copySettingsBtn.textContent = 'Copy settings';
    copySettingsBtn.style.cursor = 'pointer';
    copySettingsBtn.style.padding = '8px 12px';
    copySettingsBtn.style.borderRadius = '999px';
    copySettingsBtn.style.border = '1px solid rgba(255,255,255,0.12)';
    copySettingsBtn.style.background = 'rgba(78,227,186,0.12)';
    copySettingsBtn.style.color = '#8ff7d8';
    copySettingsBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        try {
            const kv = {};
            Object.keys(localStorage).sort().forEach(k => kv[k] = localStorage.getItem(k));
            navigator.clipboard.writeText(JSON.stringify(kv, null, 2));
            const status = document.getElementById('devtools-clean-status');
            if (status) status.textContent = 'Copied settings to clipboard';
        } catch (e) { alert('Copy failed'); }
    });

    consoleControls.appendChild(filterSelect);
    consoleControls.appendChild(searchInput);
    consoleControls.appendChild(preserveToggle);
    consoleControls.appendChild(pauseBtn);
    consoleControls.appendChild(copyLatestErrorBtn);
    consoleControls.appendChild(copyConsoleBtn);
    consoleControls.appendChild(downloadConsoleBtn);
    consoleControls.appendChild(copySettingsBtn);
    consoleControls.appendChild(clearConsoleBtn);
    overlay.appendChild(consoleControls);

        document.body.appendChild(overlay);
        // clicking backdrop closes overlay too
    backdrop.addEventListener('click', () => { overlay.remove(); backdrop.remove(); });
        refreshDebugOverlay();
        refreshConsoleOverlay();

        // Tab switching with accessible styles and aria states
        function setActiveTab(tabName) {
            if (tabName === 'debug') {
                debugTab.style.background = 'linear-gradient(120deg, rgba(196,173,98,0.28), rgba(0,0,53,0.35))';
                debugTab.style.border = '1px solid rgba(255,255,255,0.2)';
                debugTab.setAttribute('aria-pressed','true');
                consoleTab.style.background = 'transparent';
                consoleTab.style.border = '1px solid rgba(255,255,255,0.08)';
                consoleTab.setAttribute('aria-pressed','false');
                debugContent.style.display = 'block';
                consoleContent.style.display = 'none';
                consoleControls.style.display = 'none';
            } else {
        consoleTab.style.background = 'linear-gradient(120deg, rgba(196,173,98,0.28), rgba(0,0,53,0.35))';
        consoleTab.style.border = '1px solid rgba(255,255,255,0.2)';
        consoleTab.setAttribute('aria-pressed','true');
        debugTab.style.background = 'transparent';
                debugTab.style.border = '1px solid rgba(255,255,255,0.08)';
                debugTab.setAttribute('aria-pressed','false');
                debugContent.style.display = 'none';
                consoleContent.style.display = 'block';
                consoleControls.style.display = 'flex';
                refreshConsoleOverlay();
            }
            // maintain focus outline for keyboard users
            try { (tabName === 'debug' ? debugTab : consoleTab).focus(); } catch(e){}
        }

        debugTab.addEventListener('click', (ev) => { ev.stopPropagation(); setActiveTab('debug'); });
        consoleTab.addEventListener('click', (ev) => { ev.stopPropagation(); setActiveTab('console'); });

        // Keyboard support: Enter or Space toggles tabs
        debugTab.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setActiveTab('debug'); } });
        consoleTab.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setActiveTab('console'); } });

        // Initialize default active tab
        setActiveTab('debug');
    }

    function refreshDebugOverlay() {
        const content = document.getElementById('devtools-debug-content');
        if (!content) return;
        content.innerHTML = '';
        const keys = Object.keys(localStorage).sort();
        const hdrKey = document.createElement('div');
        hdrKey.textContent = `Key (${keys.length})`;
        hdrKey.style.fontWeight = '800';
        hdrKey.style.letterSpacing = '0.02em';
        hdrKey.style.textTransform = 'uppercase';
        hdrKey.style.color = '#f5e7c0';
        hdrKey.style.padding = '8px 10px';
        hdrKey.style.borderRadius = '10px';
        hdrKey.style.background = 'rgba(255,255,255,0.08)';
        hdrKey.style.border = '1px solid rgba(255,255,255,0.12)';
        const hdrVal = document.createElement('div');
        hdrVal.textContent = `Value — ${new Date().toLocaleTimeString()}`;
        hdrVal.style.fontWeight = '800';
        hdrVal.style.letterSpacing = '0.02em';
        hdrVal.style.textTransform = 'uppercase';
        hdrVal.style.color = '#f5e7c0';
        hdrVal.style.padding = '8px 10px';
        hdrVal.style.borderRadius = '10px';
        hdrVal.style.background = 'rgba(255,255,255,0.08)';
        hdrVal.style.border = '1px solid rgba(255,255,255,0.12)';
        content.appendChild(hdrKey);
        content.appendChild(hdrVal);

        keys.forEach((k, idx) => {
            const raw = localStorage.getItem(k);
            let parsed = raw;
            try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
            const keyCell = document.createElement('div');
            keyCell.textContent = k;
            keyCell.style.padding = '6px 10px';
            keyCell.style.borderRadius = '8px';
            keyCell.style.background = idx % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.06)';
            keyCell.style.border = '1px solid rgba(255,255,255,0.12)';
            keyCell.style.wordBreak = 'break-word';

            const valCell = document.createElement('div');
            valCell.style.padding = '6px 10px';
            valCell.style.borderRadius = '8px';
            valCell.style.background = idx % 2 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.05)';
            valCell.style.border = '1px solid rgba(255,255,255,0.1)';
            valCell.style.whiteSpace = 'pre-wrap';
            valCell.style.wordBreak = 'break-word';
            valCell.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace';
            valCell.style.position = 'relative';
            valCell.style.setProperty('--pencil-color', 'rgba(196,173,98,0.9)');
            const fullText = (typeof parsed === 'object' && parsed !== null)
                ? JSON.stringify(parsed, null, 2)
                : String(parsed);
            const shouldCollapse = fullText.length > 1000;
            const collapsedText = shouldCollapse ? `${fullText.slice(0, 1000)} …` : fullText;
            const valText = document.createElement('span');
            valText.textContent = collapsedText;
            valText.dataset.full = fullText;
            valText.dataset.collapsed = collapsedText;
            valText.style.display = 'block';
            valCell.appendChild(valText);

            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.gap = '6px';
            controls.style.flexWrap = 'wrap';
            controls.style.marginTop = '6px';

            const editBtn = document.createElement('button');
            editBtn.innerHTML = '✎';
            editBtn.title = 'Edit value';
            editBtn.style.position = 'absolute';
            editBtn.style.top = '6px';
            editBtn.style.left = '6px';
            editBtn.style.padding = '4px 6px';
            editBtn.style.borderRadius = '8px';
            editBtn.style.border = '1px solid rgba(255,255,255,0.14)';
            editBtn.style.background = 'rgba(255,255,255,0.14)';
            editBtn.style.color = '#f8f8ff';
            editBtn.style.cursor = 'pointer';
            editBtn.style.opacity = '0';
            editBtn.style.transition = 'opacity 120ms ease';
            const iconSpan = document.createElement('span');
            iconSpan.textContent = '✎';
            iconSpan.style.display = 'inline-block';
            iconSpan.style.transform = 'rotate(-25deg)';
            editBtn.innerHTML = '';
            editBtn.appendChild(iconSpan);
            valCell.addEventListener('mouseenter', () => { editBtn.style.opacity = '1'; });
            valCell.addEventListener('mouseleave', () => { editBtn.style.opacity = '0'; });
            editBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (valCell.querySelector('textarea')) {
                    const existing = valCell.querySelector('textarea');
                    existing.focus();
                    return;
                }
                const editor = document.createElement('textarea');
                editor.value = valText.dataset.full;
                editor.style.width = '100%';
                editor.style.boxSizing = 'border-box';
                editor.style.marginTop = '28px';
                editor.style.padding = '8px';
                editor.style.borderRadius = '8px';
                editor.style.border = '1px solid rgba(255,255,255,0.18)';
                editor.style.background = 'rgba(0,0,53,0.55)';
                editor.style.color = '#f0f4ff';
                editor.rows = Math.min(10, Math.max(4, Math.ceil(valText.dataset.full.length / 80)));

                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Save';
                saveBtn.style.marginTop = '6px';
                saveBtn.style.marginRight = '6px';
                saveBtn.style.padding = '6px 10px';
                saveBtn.style.borderRadius = '8px';
                saveBtn.style.border = '1px solid rgba(255,255,255,0.18)';
                saveBtn.style.background = 'rgba(196,173,98,0.2)';
                saveBtn.style.color = '#f5e7c0';
                saveBtn.style.cursor = 'pointer';

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Cancel';
                cancelBtn.style.marginTop = '6px';
                cancelBtn.style.padding = '6px 10px';
                cancelBtn.style.borderRadius = '8px';
                cancelBtn.style.border = '1px solid rgba(255,255,255,0.14)';
                cancelBtn.style.background = 'rgba(255,255,255,0.08)';
                cancelBtn.style.color = '#e8ecf7';
                cancelBtn.style.cursor = 'pointer';

                const actionRow = document.createElement('div');
                actionRow.style.display = 'flex';
                actionRow.style.gap = '6px';
                actionRow.appendChild(saveBtn);
                actionRow.appendChild(cancelBtn);

                const applyText = (nextVal) => {
                    const isLong = nextVal.length > 1000;
                    valText.dataset.full = nextVal;
                    valText.dataset.collapsed = isLong ? `${nextVal.slice(0, 1000)} …` : nextVal;
                    valText.textContent = isLong ? valText.dataset.collapsed : nextVal;
                };

                saveBtn.addEventListener('click', async (e2) => {
                    e2.stopPropagation();
                    try {
                        localStorage.setItem(k, editor.value);
                        applyText(editor.value);
                        if (window.authManager?.currentUser) {
                            try { await window.authManager.saveAllUserSettings(window.authManager.currentUser.uid); } catch (e) { console.warn('Firestore sync failed', e); }
                        }
                        refreshDebugOverlay();
                    } catch (e) {
                        alert('Save failed (see console)');
                        console.error('Failed to save localStorage key', k, e);
                    }
                });
                cancelBtn.addEventListener('click', (e2) => {
                    e2.stopPropagation();
                    editor.remove();
                    actionRow.remove();
                });

                valCell.appendChild(editor);
                valCell.appendChild(actionRow);
                editor.focus();
            });
            valCell.appendChild(editBtn);

            if (shouldCollapse) {
                const toggle = document.createElement('button');
                toggle.textContent = 'Expand';
                toggle.style.padding = '4px 8px';
                toggle.style.borderRadius = '8px';
                toggle.style.border = '1px solid rgba(255,255,255,0.12)';
                toggle.style.background = 'rgba(196,173,98,0.12)';
                toggle.style.color = '#f5e7c0';
                toggle.style.cursor = 'pointer';
                toggle.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const expanded = toggle.textContent === 'Collapse';
                    if (expanded) {
                        valText.textContent = valText.dataset.collapsed;
                        toggle.textContent = 'Expand';
                    } else {
                        valText.textContent = valText.dataset.full;
                        toggle.textContent = 'Collapse';
                    }
                });
                controls.appendChild(toggle);
            }

            valCell.appendChild(controls);

            content.appendChild(keyCell);
            content.appendChild(valCell);
        });
    }

    // Console capture and rendering
    function ensureConsoleCapture() {
        if (!window.__devConsoleBuffer) window.__devConsoleBuffer = [];
        if (window.__devConsoleCaptured) return;
        window.__devConsoleCaptured = true;
        window.__originalConsole = window.__originalConsole || {};
        window.__devConsolePauseCapture = window.__devConsolePauseCapture || false;
        ['log','info','warn','error','debug'].forEach(level => {
            try {
                window.__originalConsole[level] = console[level].bind(console);
                console[level] = function(...args){
                    try {
                        if (!window.__devConsolePauseCapture) {
                            window.__devConsoleBuffer.push({ level, args, time: new Date().toLocaleTimeString() });
                            if (!window.__devConsolePreserve && window.__devConsoleBuffer.length>1000) window.__devConsoleBuffer.shift();
                        }
                    } catch(e){}
                    try { window.__originalConsole[level](...args); } catch(e){}
                };
            } catch(e){}
        });
    }

    function refreshConsoleOverlay() {
        ensureConsoleCapture();
        const c = document.getElementById('devtools-console-content');
        if (!c) return;
        c.innerHTML = '';
        const buf = window.__devConsoleBuffer || [];
        const filter = window.__devConsoleFilterLevel || 'all';
        const search = (window.__devConsoleSearch || '').toLowerCase();
        const filtered = buf.filter(entry => {
            if (filter !== 'all' && entry.level !== filter) return false;
            if (!search) return true;
            const haystack = entry.args.map(a => {
                try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (e) { return String(a); }
            }).join(' ').toLowerCase();
            return haystack.includes(search);
        });
        if (window.__devConsolePauseCapture) {
            const pausedNote = document.createElement('div');
            pausedNote.textContent = 'Console capture paused';
            pausedNote.style.padding = '8px 10px';
            pausedNote.style.border = '1px dashed rgba(255,255,255,0.25)';
            pausedNote.style.borderRadius = '10px';
            pausedNote.style.marginBottom = '8px';
            pausedNote.style.color = '#ffdede';
            c.appendChild(pausedNote);
        }
        filtered.slice().reverse().forEach((entry, idx) => {
            const row = document.createElement('div');
            row.style.padding = '8px 10px';
            row.style.borderRadius = '10px';
            row.style.marginBottom = '6px';
            row.style.border = '1px solid rgba(255,255,255,0.05)';
            row.style.background = idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)';
            const time = document.createElement('span'); time.style.opacity = '0.6'; time.textContent = `[${entry.time}] `;
            const lvl = document.createElement('span'); lvl.textContent = entry.level.toUpperCase() + ': ';
            if (entry.level === 'error') lvl.style.color = '#ff7676';
            if (entry.level === 'warn') lvl.style.color = '#fbbf77';
            if (entry.level === 'info') lvl.style.color = '#7ad0ff';
            if (entry.level === 'debug') lvl.style.color = '#9eead4';
            const msg = document.createElement('span');
            try { msg.textContent = entry.args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '); } catch(e){ msg.textContent = String(entry.args); }
            row.appendChild(time); row.appendChild(lvl); row.appendChild(msg);
            c.appendChild(row);
        });
        // Update error badge
        try {
            const badge = document.getElementById('devtools-error-badge');
            if (badge) {
                const errorCount = buf.filter(e => e.level === 'error').length;
                badge.textContent = errorCount;
                badge.style.opacity = errorCount ? '1' : '0.55';
                badge.style.background = errorCount ? 'rgba(255,107,107,0.25)' : 'rgba(255,255,255,0.08)';
                badge.style.color = errorCount ? '#ffdede' : '#d1d5e7';
            }
        } catch (e) {}
        // expose a window hook so external code (or tests) can refresh the console view
        try { window.__refreshDevConsoleOverlay = refreshConsoleOverlay; } catch (e) { }
    }

    // Normalization helper: attempt to fix malformed localStorage values
    function normalizeLocalStorage() {
        const fixedKeys = [];
        try {
            Object.keys(localStorage).forEach(k => {
                try {
                    const raw = localStorage.getItem(k);
                    if (raw === null) return;

                    // Fix literal '[object Object]'
                    if (raw === '[object Object]') {
                        // For known keys, prefer sensible defaults
                        if (k === 'globalPeriodNames' || k === 'periodRenames') {
                            localStorage.setItem(k, JSON.stringify({}));
                        } else if (k.startsWith('customSchedule_')) {
                            localStorage.setItem(k, JSON.stringify([]));
                        } else {
                            localStorage.setItem(k, JSON.stringify(null));
                        }
                        fixedKeys.push(k);
                        return;
                    }

                    // For periodRenames/globalPeriodNames, ensure valid JSON
                    if (k === 'periodRenames' || k === 'globalPeriodNames') {
                        try {
                            JSON.parse(raw);
                        } catch (e) {
                            // Could be a stringified object via toString(); try best-effort fallback
                            // If there's another sensible source, copy it (e.g., periodRenames -> globalPeriodNames)
                            if (k === 'globalPeriodNames') {
                                const prRaw = localStorage.getItem('periodRenames');
                                try {
                                    const pr = prRaw ? JSON.parse(prRaw) : {};
                                    localStorage.setItem(k, JSON.stringify(pr || {}));
                                    fixedKeys.push(k);
                                    return;
                                } catch (e2) {
                                    // fallback to empty object
                                    localStorage.setItem(k, JSON.stringify({}));
                                    fixedKeys.push(k);
                                    return;
                                }
                            }
                            // For periodRenames fallback to empty object
                            localStorage.setItem(k, JSON.stringify({}));
                            fixedKeys.push(k);
                            return;
                        }
                    }

                    // For custom schedules, ensure arrays
                    if (k.startsWith('customSchedule_')) {
                        try {
                            const val = JSON.parse(raw);
                            if (!Array.isArray(val)) {
                                // coerce to array if possible
                                localStorage.setItem(k, JSON.stringify(Array.isArray(val) ? val : []));
                                fixedKeys.push(k);
                            }
                        } catch (e) {
                            // replace with empty array
                            localStorage.setItem(k, JSON.stringify([]));
                            fixedKeys.push(k);
                            return;
                        }
                    }
                } catch (e) {
                    // ignore per-key errors
                }
            });
        } catch (e) {
            console.warn('normalizeLocalStorage error', e);
        }
        return { fixedKeys };
    }

    window.normalizeLocalStorage = normalizeLocalStorage;

    // Keep a short-term undo snapshot for normalization
    let _lastNormalizationSnapshot = null;

    function takeNormalizationSnapshot() {
        _lastNormalizationSnapshot = {};
        Object.keys(localStorage).forEach(k => { _lastNormalizationSnapshot[k] = localStorage.getItem(k); });
    }

    function undoNormalization() {
        if (!_lastNormalizationSnapshot) return { restored: 0 };
        Object.keys(_lastNormalizationSnapshot).forEach(k => {
            try { localStorage.setItem(k, _lastNormalizationSnapshot[k]); } catch (e) {}
        });
        const count = Object.keys(_lastNormalizationSnapshot).length;
        _lastNormalizationSnapshot = null;
        refreshDebugOverlay();
        return { restored: count };
    }
    window.undoNormalization = undoNormalization;

    // Attach commonly used inline handlers to DOM elements (safer than relying on inline attributes only)
    function bindInlineHandlers() {
        const closeSettingsBtns = document.querySelectorAll('.close-settings, .settings-close, #settings-close, .close-settings');
        closeSettingsBtns.forEach(btn => {
            if (!btn._bound) {
                btn.addEventListener('click', () => { if (typeof toggleSettingsSidebar === 'function') toggleSettingsSidebar(); else location.reload(); });
                btn._bound = true;
            }
        });

        const removeBg = document.getElementById('remove-bg-button');
        if (removeBg && !removeBg._bound) {
            removeBg.addEventListener('click', () => { if (typeof removeBackground === 'function') removeBackground(); });
            removeBg._bound = true;
        }

        const progressCheckbox = document.getElementById('progress-bar');
        if (progressCheckbox && !progressCheckbox._bound) {
            progressCheckbox.addEventListener('change', () => { if (typeof toggleProgressBar === 'function') toggleProgressBar(); });
            progressCheckbox._bound = true;
        }

        const scheduleDropdown = document.getElementById('schedule-dropdown');
        if (scheduleDropdown && !scheduleDropdown._bound) {
            scheduleDropdown.addEventListener('change', (e) => { if (typeof switchSchedule === 'function') switchSchedule(e.target.value); });
            scheduleDropdown._bound = true;
        }

        // Save custom schedule button
        const saveScheduleBtn = document.getElementById('save-schedule-button');
        if (saveScheduleBtn && !saveScheduleBtn._bound) {
            saveScheduleBtn.addEventListener('click', () => { if (typeof saveCustomSchedule === 'function') saveCustomSchedule(); });
            saveScheduleBtn._bound = true;
        }

        const settingsButton = document.getElementById('settings-button');
        if (settingsButton && !settingsButton._bound) {
            settingsButton.addEventListener('click', () => {
                try { updateScheduleDropdown(); } catch (e) { /* ignore */ }
                if (typeof toggleSettingsSidebar === 'function') toggleSettingsSidebar();
            });
            settingsButton._bound = true;
        }

    }

    // Enhance overlay close behavior and add Undo button
    const originalShowDebugOverlay = window.refreshDevtoolsOverlay;
    // We'll override show function by adding backdrop/ESC handling when overlay is created
    const _origShow = null; // placeholder

    // Monkey-patch showDebugOverlay to add ESC/backdrop and Undo UI (we cannot directly access inner closure functions here, so rely on DOM hookups)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('devtools-debug-overlay');
            const backdrop = document.getElementById('devtools-debug-backdrop');
            if (overlay) overlay.remove();
            if (backdrop) backdrop.remove();
        }
    });

    // Click outside overlay to close (also remove backdrop)
    document.addEventListener('click', (e) => {
        const overlay = document.getElementById('devtools-debug-overlay');
        if (!overlay) return;
        const isInside = overlay.contains(e.target);
        if (!isInside) {
            const backdrop = document.getElementById('devtools-debug-backdrop');
            overlay.remove();
            if (backdrop) backdrop.remove();
        }
    });

    // Add undo button wiring: add listener to overlay when present
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true, subtree: true });

    // Keyboard listener for sequence (now '/dev')
    window.addEventListener('keydown', (e) => {
        // Accept single-character keys (including '/' and letters). Normalize to lowercase for comparison.
        const k = e.key && e.key.length === 1 ? e.key.toLowerCase() : null;
        if (!k) return;
        buffer += k;
        if (buffer.length > sequence.length) buffer = buffer.slice(buffer.length - sequence.length);
        if (buffer === sequence) {
            showDebugOverlay();
            buffer = '';
        }
    });

    // Keyboard shortcut: Ctrl/Cmd + Shift + D toggles overlay
    window.addEventListener('keydown', (e) => {
        const isToggleShortcut = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key?.toLowerCase() === 'd');
        if (!isToggleShortcut) return;
        e.preventDefault();
        const overlay = document.getElementById('devtools-debug-overlay');
        const backdrop = document.getElementById('devtools-debug-backdrop');
        if (overlay) {
            overlay.remove();
            if (backdrop) backdrop.remove();
        } else {
            showDebugOverlay();
        }
    });

    // Auto-show HUD if previously enabled
    document.addEventListener('DOMContentLoaded', () => {
        try {
            if (localStorage.getItem('devtoolsHudEnabled') === 'true') {
                setTimeout(() => {
                    toggleDevtoolsHud();
                }, 50);
            }
        } catch (e) {}
    });

    // Expose refresh function for overlay
    window.refreshDevtoolsOverlay = refreshDebugOverlay;
})();

// Remove any block like this:
//
// if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
//     chrome.runtime.sendMessage("clghadjfdfgihdkemlipfndoelebcipg", {
//         type: 'UPDATE_GRADIENT',
//         settings: { angle: settings.angle, stops: settings.stops }
//     }, function(response) {
//         // Handle response if needed
//     });
// }

function updateScheduleDisplay() {
    const scheduleContainer = document.getElementById("schedule");
    if (!scheduleContainer) return;
    scheduleContainer.innerHTML = "";
    // Times are enabled by default and stay hidden only after an explicit opt-out.
    const showTimes = localStorage.getItem('showPeriodTimes') !== 'false';
    const globalNames = getGlobalPeriodNames();
    const renames = getPeriodRenames();
    // Keep custom display names matched to the canonical active schedule.
    const activeSchedules = getActiveSchedules();
    const originalSchedule = activeSchedules[currentScheduleName] || currentSchedule;
    const displaySchedule = getTimelineSchedule(currentScheduleName, currentSchedule);
    displaySchedule.forEach((period) => {
        if (period.name !== "Passing") {
            // Find the canonical original period by periodNum first (more robust),
            // otherwise fall back to the schedule index.
            let origPeriod = null;
            let displayName = period.name;
            if (period.isLunch) {
                origPeriod = period;
            } else if (period && period.periodNum) {
                origPeriod = originalSchedule.find(p => String(p.periodNum) === String(period.periodNum));
            }
            if (!origPeriod) {
                origPeriod = originalSchedule.find(p => p.name === period.name) || period;
            }
            if (origPeriod && origPeriod.periodNum) {
                const periodNum = origPeriod.periodNum;
                const globalName = globalNames[periodNum];
                const renameName = renames[periodNum];
                if (globalName && globalName.trim()) {
                    displayName = globalName;
                } else if (renameName && renameName.trim()) {
                    displayName = renameName;
                } else {
                    displayName = origPeriod.name;
                }
            }
            if (period.segmentLabel) displayName = `${displayName} · ${period.segmentLabel}`;
            const periodDiv = document.createElement("div");
            periodDiv.className = period.isLunch ? "period lunch-period" : "period";
            periodDiv.dataset.start = period.start || '';
            periodDiv.dataset.end = period.end || '';
            const label = document.createElement("label");
            label.innerText = `${displayName}`;
            if (showTimes && period.start && period.end) {
                const timesSpan = document.createElement('span');
                timesSpan.className = 'period-times';
                timesSpan.style.marginLeft = '8px';
                timesSpan.style.fontSize = '0.9em';
                timesSpan.style.opacity = '0.85';
                // Show times with 12-hour hour (no AM/PM) so hours never exceed 12
                const startFormatted = formatHour12NoSuffix(period.start);
                const endFormatted = formatHour12NoSuffix(period.end);
                timesSpan.innerText = `${startFormatted} - ${endFormatted}`;
                label.appendChild(timesSpan);
            }
            const timer = document.createElement("span");
            timer.id = `Period_Timer`;
            periodDiv.appendChild(label);
            periodDiv.appendChild(timer);
            scheduleContainer.appendChild(periodDiv);
        }
    });
    const scheduleSummary = document.getElementById('schedule-day-summary');
    if (scheduleSummary) {
        const labels = {
            normal: 'Regular · SOAR',
            normalNoSoar: 'Regular · No SOAR',
            lateStart: 'Late Start',
            halfDay: 'Half Day'
        };
        scheduleSummary.textContent = labels[currentScheduleName] || 'Automatic Indy bells';
    }
    updateCountdowns();
}

function updateScheduleRowStates(currentSeconds, dayType) {
    const rows = Array.from(document.querySelectorAll('#schedule .period'));
    rows.forEach((row) => row.classList.remove('is-current', 'is-next', 'is-complete'));
    if (dayType === 'noSchool') return;

    rows.forEach((row) => {
        const start = getTimeInSeconds(row.dataset.start);
        const end = getTimeInSeconds(row.dataset.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return;
        if (currentSeconds >= end) row.classList.add('is-complete');
    });
    const currentRow = rows.find((row) => currentSeconds >= getTimeInSeconds(row.dataset.start)
        && currentSeconds < getTimeInSeconds(row.dataset.end));
    const nextRow = rows.find((row) => getTimeInSeconds(row.dataset.start) > currentSeconds);
    currentRow?.classList.add('is-current');
    nextRow?.classList.add('is-next');
}

// Update the browser tab title with current period and remaining time
function updateTabTitle(periodDisplayName, timeText) {
    try {
        if (!periodDisplayName || !timeText) return;
        document.title = `${periodDisplayName} | ${timeText}`;
    } catch (e) {
        // silent
    }
}


function updateCountdowns() {
    const now = new Date();
    const calendar = window.IndyCalendar;
    const dayType = calendar?.getDayType(now) || 'regular';
    const automaticScheduleName = calendar?.getScheduleKey(now) || 'normal';

    if (dayType !== 'noSchool' && currentScheduleName !== automaticScheduleName) {
        currentScheduleName = automaticScheduleName;
        currentSchedule = schedules[automaticScheduleName] || schedules.normal;
        updateScheduleDisplay();
    }

    updateTodayAtIndy(now);

    const currentTimeInSeconds = calendar?.secondsSinceMidnight(now)
        ?? (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
    const timerElement = document.getElementById('current-period-time');
    const headingElement = document.getElementById('countdown-heading');
    if (!timerElement || !headingElement) return;
    const contextElement = document.getElementById('schedule-context');
    const captionElement = document.getElementById('countdown-caption');
    const periodWindowElement = document.getElementById('period-window');
    const nextSummaryElement = document.getElementById('next-period-summary');
    const setHeroText = ({ context, heading, caption, periodWindow, nextSummary }) => {
        if (contextElement) contextElement.textContent = context;
        headingElement.textContent = heading;
        if (captionElement) captionElement.textContent = caption;
        if (periodWindowElement) periodWindowElement.textContent = periodWindow;
        if (nextSummaryElement) nextSummaryElement.textContent = nextSummary;
    };

    const displayNames = {
        normal: 'Regular Schedule',
        normalNoSoar: 'Regular Schedule',
        lateStart: 'Late-Start Schedule',
        halfDay: 'Half-Day Schedule'
    };
    const headerName = displayNames[currentScheduleName] || 'Regular Schedule';
    const displayPeriodName = (period) => {
        return period ? getTimelinePeriodLabel(period) : '';
    };
    const formatDuration = (totalSeconds) => {
        const safe = Math.max(0, totalSeconds);
        const hours = Math.floor(safe / 3600);
        const minutes = Math.floor((safe % 3600) / 60);
        const seconds = safe % 60;
        return hours > 0
            ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const timelineSchedule = getTimelineSchedule(automaticScheduleName, currentSchedule);
    const currentPeriod = dayType === 'noSchool' ? null : timelineSchedule.find((period) => {
        const start = getTimeInSeconds(period.start);
        const end = getTimeInSeconds(period.end);
        return currentTimeInSeconds >= start && currentTimeInSeconds < end;
    });
    const upcomingPeriod = dayType === 'noSchool' ? null : timelineSchedule.find(
        (period) => getTimeInSeconds(period.start) > currentTimeInSeconds
    );
    updateScheduleRowStates(currentTimeInSeconds, dayType);

    if (currentPeriod) {
        const periodName = displayPeriodName(currentPeriod);
        const timeText = formatDuration(getTimeInSeconds(currentPeriod.end) - currentTimeInSeconds);
        const nextText = upcomingPeriod
            ? `Next: ${displayPeriodName(upcomingPeriod)} at ${formatTime12(upcomingPeriod.start)}`
            : 'Final block of the day';
        setHeroText({
            context: headerName,
            heading: periodName,
            caption: 'remaining',
            periodWindow: `${formatTime12(currentPeriod.start)}–${formatTime12(currentPeriod.end)}`,
            nextSummary: nextText
        });
        timerElement.textContent = timeText;
        updateTabTitle(periodName, timeText);
        return;
    }

    if (upcomingPeriod) {
        const periodName = displayPeriodName(upcomingPeriod);
        const timeText = formatDuration(getTimeInSeconds(upcomingPeriod.start) - currentTimeInSeconds);
        const previousPeriod = [...timelineSchedule].reverse().find(
            (period) => getTimeInSeconds(period.end) <= currentTimeInSeconds
        );
        const firstStart = getTimeInSeconds(timelineSchedule[0]?.start);
        const lastEnd = getTimeInSeconds(timelineSchedule[timelineSchedule.length - 1]?.end);
        const isPassingPeriod = Boolean(previousPeriod)
            && currentTimeInSeconds >= firstStart
            && currentTimeInSeconds < lastEnd;

        setHeroText(isPassingPeriod ? {
            context: headerName,
            heading: 'Between Classes',
            caption: `until ${periodName}`,
            periodWindow: `${formatTime12(previousPeriod.end)}–${formatTime12(upcomingPeriod.start)}`,
            nextSummary: `Next: ${periodName} at ${formatTime12(upcomingPeriod.start)}`
        } : {
            context: headerName,
            heading: 'School Starts Soon',
            caption: `until ${periodName}`,
            periodWindow: `First bell at ${formatTime12(upcomingPeriod.start)}`,
            nextSummary: `${periodName} begins the day`
        });
        timerElement.textContent = timeText;
        updateTabTitle(isPassingPeriod ? 'Between Classes' : 'School Starts Soon', timeText);
        return;
    }

    const todayKey = calendar?.dateKey(now);
    const nextDateKey = calendar?.getNextInstructionalDateKey(todayKey);
    if (!calendar || !nextDateKey) {
        setHeroText({
            context: 'Indy Schedule',
            heading: 'School Year Complete',
            caption: 'enjoy your break',
            periodWindow: '—',
            nextSummary: 'No upcoming school day'
        });
        timerElement.textContent = '00:00';
        updateTabTitle('School Year Complete', '00:00');
        return;
    }

    const nextScheduleName = calendar.getScheduleKey(nextDateKey);
    const nextSchedule = schedules[nextScheduleName] || schedules.normal;
    const period1 = nextSchedule.find((period) => period.name === 'Period 1');
    const targetEpoch = calendar.epochForSchoolTime(nextDateKey, period1.start);
    const secondsLeft = Math.floor((targetEpoch - now.getTime()) / 1000);
    const timeText = formatDuration(secondsLeft);
    const nextLabel = displayPeriodName(period1);

    const nextScheduleLabel = displayNames[nextScheduleName] || 'Regular Schedule';
    setHeroText(dayType === 'noSchool' ? {
        context: 'No School Today',
        heading: 'Next School Day',
        caption: `until ${nextLabel}`,
        periodWindow: `Starts ${formatTime12(period1.start)}`,
        nextSummary: nextScheduleLabel
    } : {
        context: headerName,
        heading: 'School’s Out!',
        caption: 'until the next school day',
        periodWindow: `Dismissed ${formatTime12(timelineSchedule[timelineSchedule.length - 1]?.end)}`,
        nextSummary: `${nextScheduleLabel} · ${formatTime12(period1.start)}`
    });
    timerElement.textContent = timeText;
    updateTabTitle(dayType === 'noSchool' ? 'No School' : 'Free', timeText);
}

// Add this helper to populate the schedule dropdown based on selected grade level
function updateScheduleDropdown() {
    const dropdown = document.getElementById('schedule-dropdown');
    if (!dropdown) return;

    // Remove existing options
    dropdown.innerHTML = '';

    const activeSchedules = getActiveSchedules();
    Object.keys(activeSchedules).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = getScheduleDisplayName(key);
        dropdown.appendChild(opt);
    });

    // Try to keep the previously selected schedule
    const selected = localStorage.getItem('currentScheduleName') || currentScheduleName || 'normal';
    if (activeSchedules[selected]) {
        dropdown.value = selected;
    } else {
        dropdown.value = Object.keys(activeSchedules)[0] || 'normal';
    }
}

// No-op initializer for saved schedules to satisfy callers that expect it
function initializeSavedSchedules() {
    // Intentionally minimal: custom schedule migration/loading is handled elsewhere.
    // Kept as a defined function so initializeAppLogic() doesn't throw.
    return;
}




// Add this function at an appropriate location in the file:
function initializeSettingsPanels() {
    if (document.documentElement.dataset.settingsPanelsInitialized === 'true') return;
    document.documentElement.dataset.settingsPanelsInitialized = 'true';
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all nav items and panels
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('active'));
            // Add active class to the clicked item
            item.classList.add('active');
            // Show the corresponding panel based on data-target attribute
            const target = item.getAttribute("data-target");
            const panel = document.getElementById(`${target}-panel`);
                        if (panel) {
                panel.classList.add('active');
            }
        });
    });
}

function initializeWhatsNewTabs() {
    try {
        const tabButtons = Array.from(document.querySelectorAll('.whatsnew-tab'));
        const logs = Array.from(document.querySelectorAll('.whatsnew-log'));
        if (!tabButtons.length || !logs.length) return;

        const activate = (targetId) => {
            logs.forEach(log => {
                const isActive = log.id === targetId;
                log.hidden = !isActive;
                log.classList.toggle('active', isActive);
            });

            tabButtons.forEach(btn => {
                const isActive = btn.dataset.wnTarget === targetId;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        };

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => activate(btn.dataset.wnTarget));
        });

        const defaultTab = tabButtons.find(btn => btn.dataset.wnTarget === 'whatsnew-website') || tabButtons[0];
        if (defaultTab) activate(defaultTab.dataset.wnTarget);
    } catch (e) {
        console.error('initializeWhatsNewTabs failed', e);
    }
}

(function() {
    function setRangeFill(input) {
        const min = Number(input.min || 0);
        const max = Number(input.max || 100);
        const val = Number(input.value || 0);
        const pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
        input.style.setProperty('--range-fill', `${Math.max(0, Math.min(100, pct))}%`);
    }
    function initSliderRows() {
        const inputs = Array.from(document.querySelectorAll('.slider-row input[type="range"]'));
        const refreshAll = () => inputs.forEach(setRangeFill);
        inputs.forEach(input => {
            setRangeFill(input);
            input.addEventListener('input', () => setRangeFill(input));
        });
        // Re-run shortly after load so programmatic value updates are reflected
        setTimeout(refreshAll, 120);
        setTimeout(refreshAll, 520);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSliderRows);
    } else {
        initSliderRows();
    }
})();



// { 
// 	// Removed duplicate implementations of renamePeriod(...) and populateRenamePeriods(...)
// 	// The authoritative implementations are defined earlier in this file and exported to window:
// 	//   window.renamePeriod and window.populateRenamePeriods
// 	// Replace the duplicated blocks with safe delegates to avoid clobbering or runtime errors.

// 	// Compatibility wrapper: if legacy callers call the global functions before the authoritative ones exist,
// 	// delegate to the authoritative implementations when available.
// 	if (!window.renamePeriod) {
// 		window.renamePeriod = function(periodNumber, newName) {
// 			console.warn('renamePeriod called before initialization. Ignoring.');
// 		};
// 	}
// 	if (!window.populateRenamePeriods) {
// 		window.populateRenamePeriods = function() {
// 			console.warn('populateRenamePeriods called before initialization. Ignoring.');
// 		};
// 	}

// 	// Provide an index-to-periodNum helper for any callers that still pass an index.
// 	// This does not overwrite the authoritative renamePeriod.
// 	if (!window.renamePeriodIndexSafe) {
// 		window.renamePeriodIndexSafe = function(indexOrPeriodNum, newName) {
// 			let periodNum = indexOrPeriodNum;
// 			// If passed an index, try map to periodNum from original schedules or currentSchedule
// 			if (!/^\d+$/.test(String(periodNum))) {
// 				const idx = parseInt(indexOrPeriodNum, 10);
// 				if (!isNaN(idx)) {
// 					// Prefer currentSchedule mapping, fallback to original schedule mapping
// 					const candidate = (Array.isArray(currentSchedule) && currentSchedule[idx]) ? currentSchedule[idx] : (schedules[currentScheduleName] || schedules.normal)[idx];
// 					periodNum = candidate?.periodNum || (candidate?.name && candidate.name.split(' ')[1]);
// 				}
// 			}
// 			if (!periodNum) {
// 				console.warn('renamePeriodIndexSafe: cannot determine period number for', indexOrPeriodNum);
// 				return;
// 			}
// 			if (typeof window.renamePeriod === 'function') {
// 				return window.renamePeriod(String(periodNum), newName);
// 			}
// 		};
// 	}
// }
