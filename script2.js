// Global variables
let activeStop = null;
// Add this at the start of the file
function waitForAuth() {
    return Promise.resolve(window.authManager || null);
}

// Add a check for auth manager availability
function getAuthManager() {
    return Promise.resolve(window.authManager || null);
}

// Settings Management
function toggleSettingsSidebar() {  
    const sidebar = document.getElementById("settings-sidebar");
    if (!sidebar) return;
    sidebar.classList.toggle("open");
    const isOpen = sidebar.classList.contains("open");
    sidebar.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    document.getElementById('settings-button')?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) {
        document.getElementById('today-card-close')?.click();
        window.trackAnalyticsEvent?.('settings_open');
        window.IndyDialogManager?.open(sidebar, {
            trigger: document.getElementById('settings-button'),
            initialFocus: sidebar.querySelector('.close-settings'),
            onRequestClose: toggleSettingsSidebar
        });
    } else {
        window.IndyDialogManager?.close(sidebar);
    }
    
    // Save settings when closing the sidebar
    if (!isOpen) {
        saveSettings();
    }
}

function initializeSettingsControls() {
    const settingsButton = document.getElementById('settings-button');
    const closeButtons = document.querySelectorAll('.close-settings, .settings-close, #settings-close');

    if (settingsButton && settingsButton.dataset.settingsBound !== 'true') {
        settingsButton.dataset.settingsBound = 'true';
        settingsButton.setAttribute('aria-controls', 'settings-sidebar');
        settingsButton.setAttribute('aria-expanded', 'false');
        settingsButton.addEventListener('click', () => {
            if (typeof updateScheduleDropdown === 'function') updateScheduleDropdown();
            toggleSettingsSidebar();
        });
    }

    closeButtons.forEach((button) => {
        if (button.dataset.settingsBound === 'true') return;
        button.dataset.settingsBound = 'true';
        button.addEventListener('click', toggleSettingsSidebar);
    });

    document.addEventListener('keydown', (event) => {
        const sidebar = document.getElementById('settings-sidebar');
        if (event.key === 'Escape' && sidebar?.classList.contains('open')) toggleSettingsSidebar();
    });
}

document.addEventListener('DOMContentLoaded', initializeSettingsControls);

let deferredInstallPrompt = null;

function updateInstallAppControl(available) {
    const card = document.getElementById('install-app-card');
    if (card) card.hidden = !available;
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallAppControl(true);
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallAppControl(false);
    window.trackAnalyticsEvent?.('pwa_installed');
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('install-app-button')?.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        updateInstallAppControl(false);
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').catch((error) => {
                console.warn('Offline support could not be started.', error);
            });
        }, { once: true });
    }
});

const DEFAULT_INTERFACE_FONT = 'Inter';
const INTERFACE_FONTS = Object.freeze({
    'Arial': { stack: 'Arial, sans-serif' },
    'Helvetica': { stack: 'Helvetica, Arial, sans-serif' },
    "'Open Sans'": { stack: '"Open Sans", Arial, sans-serif', query: 'Open+Sans:wght@400;500;600;700' },
    'Roboto': { stack: 'Roboto, Arial, sans-serif', query: 'Roboto:wght@400;500;700' },
    "'Source Sans Pro'": { stack: '"Source Sans 3", "Source Sans Pro", Arial, sans-serif', query: 'Source+Sans+3:wght@400;500;600;700' },
    "'SF Pro Text'": { stack: '"SF Pro Text", Inter, "Segoe UI", sans-serif' },
    'Inter': { stack: 'Inter, "Segoe UI", sans-serif' },
    'Montserrat': { stack: 'Montserrat, Arial, sans-serif', query: 'Montserrat:wght@400;500;600;700' },
    "'Segoe UI'": { stack: '"Segoe UI", Arial, sans-serif' }
});
const INTERFACE_FONT_ALIASES = Object.freeze({
    'arial': 'Arial',
    'helvetica': 'Helvetica',
    'open sans': "'Open Sans'",
    'roboto': 'Roboto',
    'source sans pro': "'Source Sans Pro'",
    'source sans 3': "'Source Sans Pro'",
    'sf pro': "'SF Pro Text'",
    'sf pro text': "'SF Pro Text'",
    'inter': 'Inter',
    'montserrat': 'Montserrat',
    'segoe ui': "'Segoe UI'"
});

function normalizeInterfaceFont(fontFamily) {
    if (typeof fontFamily !== 'string') return DEFAULT_INTERFACE_FONT;
    const firstFamily = fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase();
    return INTERFACE_FONT_ALIASES[firstFamily] || DEFAULT_INTERFACE_FONT;
}

function applyInterfaceFont(fontFamily) {
    const canonicalFont = normalizeInterfaceFont(fontFamily);
    const font = INTERFACE_FONTS[canonicalFont];
    if (font.query) {
        const familyQuery = font.query;
        const fontId = `indy-font-${familyQuery.split(':')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        if (!document.getElementById(fontId)) {
            const link = document.createElement('link');
            link.id = fontId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${familyQuery}&display=swap`;
            document.head.appendChild(link);
        }
    }
    document.documentElement.style.setProperty('--interface-font-family', font.stack);
    document.documentElement.dataset.interfaceFont = canonicalFont.replaceAll("'", '');
    if (document.body) document.body.style.fontFamily = 'var(--interface-font-family)';
    const selector = document.getElementById('font-family');
    if (selector) selector.value = canonicalFont;
    localStorage.setItem('fontFamily', canonicalFont);
    return canonicalFont;
}
window.applyInterfaceFont = applyInterfaceFont;
window.normalizeInterfaceFont = normalizeInterfaceFont;

function initializeOptionalAuthFallback() {
    if (window.authManager) return;
    const trigger = document.querySelector('#sign-in-button .account-trigger');
    const modal = document.getElementById('login-modal');
    const close = document.getElementById('login-close');
    if (!trigger || !modal) return;
    trigger.addEventListener('click', () => {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('show');
        const error = document.getElementById('login-error');
        if (error) {
            error.textContent = 'Account services are unavailable right now. Your schedule and local settings still work.';
            error.style.display = 'block';
        }
        modal.querySelectorAll('input, button:not(#login-close)').forEach((control) => { control.disabled = true; });
        window.IndyDialogManager?.open(modal, {
            trigger,
            initialFocus: close,
            onRequestClose: () => close?.click()
        });
    });
    close?.addEventListener('click', () => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        window.IndyDialogManager?.close(modal);
        window.setTimeout(() => { modal.style.display = 'none'; }, 300);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeOptionalAuthFallback();
    applyInterfaceFont(localStorage.getItem('fontFamily'));
});

// Add missing helper function
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
}

// Modify your loadSettings function
async function loadSettings(firestoreSettings = null) {
    try {
    const syncedFont = firestoreSettings?.fontFamily;
    applyInterfaceFont(syncedFont || localStorage.getItem('fontFamily'));

    // Initialize show period times checkbox from Firestore or localStorage
    const storedShowTimes = localStorage.getItem('showPeriodTimes');
    const syncedShowTimes = firestoreSettings?.showPeriodTimes;
    const showTimesSetting = syncedShowTimes == null
        ? storedShowTimes !== 'false'
        : syncedShowTimes === true || syncedShowTimes === 'true';
    localStorage.setItem('showPeriodTimes', showTimesSetting ? 'true' : 'false');
    const showTimesCheckbox = document.getElementById('show-period-times');
    if (showTimesCheckbox) showTimesCheckbox.checked = showTimesSetting;

    // Firestore may have supplied a dated schedule override after the initial
    // dashboard render. Apply it immediately on this device.
    if (typeof getEffectiveScheduleKey === 'function' && typeof activateSchedule === 'function') {
        activateSchedule(getEffectiveScheduleKey(new Date()));
        if (typeof refreshScheduleOverrideUI === 'function') refreshScheduleOverrideUI();
        if (typeof updateTodayAtIndy === 'function') updateTodayAtIndy();
    }

    // Load other settings with null checks
        // Timer shadows were retired; clear older local/synced values and any
        // inline style left by a previous version.
        localStorage.removeItem("timerShadowSettings");
        document.getElementById('current-period-time')?.style.removeProperty('text-shadow');
        loadProgressBarSettings();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Toggle handler for showing/hiding period times next to names
function toggleShowPeriodTimes(enabled) {
    try {
        localStorage.setItem('showPeriodTimes', enabled ? 'true' : 'false');
        // re-render schedule
        if (typeof updateScheduleDisplay === 'function') updateScheduleDisplay();
        // Persist to Firestore as part of saveSettings if desired
        if (typeof saveSettings === 'function') saveSettings();
    } catch (e) {
        console.error('Failed to toggle showPeriodTimes', e);
    }
}

// Replace this function in script2.js
function toggleDropdown(contentId, toggleId) {
    const content = document.getElementById(contentId);
    const toggle = document.getElementById(toggleId);
    if (!content || !toggle) {
        console.error('Dropdown elements not found:', { contentId, toggleId });
        return;
    }

    // First close any other open dropdowns (but do not auto-close the rename-periods dropdown)
    document.querySelectorAll('.dropdown-content.show').forEach(dropdown => {
        if (dropdown.id === 'rename-periods-content') return; // keep rename dropdown open unless its own toggle is used
        if (dropdown.id !== contentId) {
            dropdown.classList.remove('show');
            const otherToggle = document.getElementById(dropdown.id.replace('-content', '-toggle'));
            if (otherToggle) {
                otherToggle.classList.remove('active');
            }
        }
    });

    // Now toggle the clicked dropdown
    content.classList.toggle('show');
    toggle.classList.toggle('active');

    // Special handling for rename periods dropdown
    if (contentId === 'rename-periods-content' && content.classList.contains('show')) {
        populateRenamePeriods();
    }
}

function closeOtherDropdowns(exceptContent) {
    document.querySelectorAll('.dropdown-content.show').forEach(content => {
        if (content !== exceptContent) {
            content.classList.remove('show');
            const toggle = content.previousElementSibling;
            if (toggle && toggle.classList.contains('dropdown-toggle')) {
                toggle.classList.remove('active');
            }
        }
    });
}

// Event Listeners
document.addEventListener("DOMContentLoaded", function() {
    console.debug('DOM Content Loaded');

    loadSettings();
    // Ensure gradient direction control is initialized
    if (typeof loadGradientDirection === 'function') {
        loadGradientDirection();
    }
    // Ensure dropdown toggle handlers are attached
    if (typeof setupDropdownListeners === 'function') {
        setupDropdownListeners();
    }
    
    // Background uploads were retired; ensure legacy data cannot mask the gradient.
    localStorage.removeItem('bgImage');
    
    // Add click handler for rename periods toggle
    const renamePeriodsToggle = document.getElementById('rename-periods-toggle');
    if (renamePeriodsToggle) {
        renamePeriodsToggle.addEventListener('click', function() {
            const content = document.getElementById('rename-periods-content');
            const isOpen = content.classList.contains('show');
            
            // Close all dropdowns first
            document.querySelectorAll('.dropdown-content').forEach(el => {
                el.classList.remove('show');
            });
            document.querySelectorAll('.dropdown-toggle').forEach(el => {
                el.classList.remove('active');
                el.setAttribute('aria-expanded', 'false');
            });
            
            // Toggle current dropdown
            if (!isOpen) {
                content.classList.add('show');
                this.classList.add('active');
                this.setAttribute('aria-expanded', 'true');
                populateRenamePeriods();
            }
        });
    }

    // Load saved theme preference
    // Force light mode — this app is light-only now
    try {
        localStorage.setItem('theme', 'light');
    } catch (e) {}
    const sidebar = document.getElementById('settings-sidebar');
    if (sidebar) sidebar.classList.add('light-mode');
    document.body.classList.add('light-mode');
    try {
        const icon = document.querySelector('.theme-toggle i');
        const text = document.querySelector('.theme-toggle-text');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
        if (text) text.textContent = 'Light Mode';
    } catch (e) {}

    // Add event listeners for progress bar inputs
    document.getElementById('progress-bar-color')?.addEventListener('input', updateProgressBarStyle);
    document.getElementById('progress-bar-opacity')?.addEventListener('input', updateProgressBarStyle);
    
    // Initialize progress bar if enabled
    if (localStorage.getItem('progressBarEnabled') === 'true') {
        const checkbox = document.getElementById('progress-bar');
        if (checkbox) {
            checkbox.checked = true;
            createProgressBar();
            updateProgressBarStyle();
        }
    }

    updateAuthButtonText();
});

// Initialize gradient direction select control from saved settings
function loadGradientDirection() {
    try {
        const saved = JSON.parse(localStorage.getItem('gradientSettings'));
        const angle = saved?.angle ?? 90;
        const select = document.getElementById('gradientDirection');
        if (select) select.value = String(angle);
    } catch (err) {
        console.error('Error loading gradient direction:', err);
    }
}

// Update gradient direction handler exposed globally for inline onchange handlers
function updateGradientDirection(angle) {
    try {
        const parsed = parseInt(angle, 10);
        if (!Number.isFinite(parsed) || !window.gradientManager) return;
        window.gradientManager.angle = parsed;
        window.gradientManager.applyGradient();
        window.gradientManager.saveSettings();
        window.gradientManager.updateUI();
    } catch (err) {
        console.error('Error updating gradient direction:', err);
    }
}

// Expose globally for inline HTML onchange handlers
window.loadGradientDirection = loadGradientDirection;
window.updateGradientDirection = updateGradientDirection;

// Attach click listeners to dropdown toggles and manage dropdown visibility
function setupDropdownListeners() {
    try {
        // Delegate: add listener to document to catch dynamically added toggles too
        document.addEventListener('click', function (e) {
            const toggle = e.target.closest('.dropdown-toggle');
            if (!toggle) return;

            // Prevent default actions
            e.preventDefault();

            const content = toggle.nextElementSibling;
            if (!content || !content.classList.contains('dropdown-content')) return;

            const isOpen = content.classList.contains('show');

            // Close all other dropdowns
            document.querySelectorAll('.dropdown-content.show').forEach(el => {
                if (el !== content) el.classList.remove('show');
            });
            document.querySelectorAll('.dropdown-toggle.active').forEach(el => {
                if (el !== toggle) el.classList.remove('active');
            });

            // Toggle current
            if (isOpen) {
                content.classList.remove('show');
                toggle.classList.remove('active');
            } else {
                content.classList.add('show');
                toggle.classList.add('active');
            }
        });

        // Close dropdowns when clicking outside, but keep the rename-periods dropdown open
        document.addEventListener('click', function (e) {
            // If the click is inside a toggle or a dropdown content, do nothing
            if (e.target.closest('.dropdown-toggle') || e.target.closest('.dropdown-content')) return;

            document.querySelectorAll('.dropdown-content.show').forEach(el => {
                // Keep the rename periods dropdown open unless its toggle is explicitly clicked or settings are closed
                if (el.id === 'rename-periods-content') return;
                el.classList.remove('show');
                try {
                    const toggleId = el.id.replace('-content', '-toggle');
                    const toggleEl = document.getElementById(toggleId);
                    if (toggleEl) toggleEl.classList.remove('active');
                } catch (err) {
                    // ignore
                }
            });
        });
    } catch (err) {
        console.error('Error setting up dropdown listeners:', err);
    }
}

// Expose globally for callers/tests
window.setupDropdownListeners = setupDropdownListeners;

// Add a delegated click handler to reliably catch dropdown toggle clicks
document.addEventListener('DOMContentLoaded', function() {
    try {
        const panelsRoot = document.querySelector('.settings-panels') || document.getElementById('settings-sidebar');

        const handleToggleClick = (e) => {
            const toggle = e.target.closest('.dropdown-toggle');
            if (!toggle) return;
            // Derive IDs: "xxx-toggle" -> "xxx-content"
            const toggleId = toggle.id || toggle.getAttribute('data-toggle-id') || '';
            const contentId = toggleId ? toggleId.replace('-toggle', '-content') : (toggle.dataset.target ? `${toggle.dataset.target}-content` : null);
            if (!contentId) {
                console.warn('Dropdown toggle click: could not derive content id for', toggle);
                return;
            }
            console.debug('Dropdown toggle clicked:', { toggleId, contentId });
            // Close other dropdowns and toggle this one
            const contentEl = document.getElementById(contentId);
            closeOtherDropdowns(contentEl);
            toggleDropdown(contentId, toggleId || toggle.dataset.target || toggle);
        };

        if (panelsRoot) {
            panelsRoot.addEventListener('click', handleToggleClick);
        } else {
            // Fallback: global delegation if panels root not present
            document.body.addEventListener('click', handleToggleClick);
        }
    } catch (err) {
        console.error('Error installing dropdown delegation:', err);
    }
});

// New gradient functionality

// Progress Bar Functions
function toggleProgressBar() {
    const checkbox = document.getElementById('progress-bar');
    const settings = document.getElementById('progress-bar-settings');
    
    if (checkbox.checked) {
        settings.style.display = 'block';
        createProgressBar();
        updateProgressBarStyle();
    } else {
        settings.style.display = 'none';
        removeProgressBar();
    }
    
    // Save preference
    localStorage.setItem('progressBarEnabled', checkbox.checked);
    saveSettings();
}

function createProgressBar() {
    removeProgressBar(); // Remove any existing progress bar first
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-overlay';
    const progressTrack = document.getElementById('period-progress-track');
    if (progressTrack) {
        progressTrack.hidden = false;
        progressTrack.appendChild(progressBar);
    } else {
        document.body.insertBefore(progressBar, document.body.firstChild);
    }
    
    // Get saved values or use defaults
    let color = localStorage.getItem('progressBarColor');
    let opacity = localStorage.getItem('progressBarOpacity');
    if (!color) {
        color = '#000000';
        localStorage.setItem('progressBarColor', color);
    }
    if (!opacity) {
        opacity = '20';
        localStorage.setItem('progressBarOpacity', opacity);
    }
    
    // Update input elements with saved values
    const colorInput = document.getElementById('progress-bar-color');
    const opacityInput = document.getElementById('progress-bar-opacity');
    
    if (colorInput) colorInput.value = color;
    if (opacityInput) opacityInput.value = opacity;
    
    progressBar.style.backgroundColor = `rgba(${hexToRgb(color)}, ${opacity / 100})`;
    
    // Start the update loop (TimerManager will call updateProgressBar each second if enabled)
    updateProgressBar();
    if (window.TimerManager && typeof window.TimerManager.setProgress === 'function') {
        window.TimerManager.setProgress(true);
    } else {
        // Fallback to legacy interval when TimerManager is not present
        if (window.progressInterval) clearInterval(window.progressInterval);
        window.progressInterval = setInterval(updateProgressBar, 1000);
    }
}

function updateProgressBarStyle() {
    const progressBar = document.querySelector('.progress-overlay');
    if (!progressBar) return;
    
    const color = document.getElementById('progress-bar-color').value;
    const opacity = document.getElementById('progress-bar-opacity').value;
    
    // Save the values immediately
    localStorage.setItem('progressBarColor', color);
    localStorage.setItem('progressBarOpacity', opacity);
    
    progressBar.style.backgroundColor = `rgba(${hexToRgb(color)}, ${opacity / 100})`;
    
    // Update opacity display
    const opacityDisplay = document.querySelector('#progress-bar-opacity + .range-value');
    if (opacityDisplay) {
        opacityDisplay.textContent = `${opacity}%`;
    }
    
    saveSettings();
}

function updateProgressBar() {
    const progressBar = document.querySelector('.progress-overlay');
    if (!progressBar) return;
    
    const now = new Date();
    if (window.IndyCalendar?.getDayType(now) === 'noSchool') {
        progressBar.style.width = '0%';
        return;
    }
    const currentTimeInSeconds = window.IndyCalendar?.secondsSinceMidnight(now)
        ?? (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
    const progressSchedule = typeof getTimelineSchedule === 'function'
        ? getTimelineSchedule(currentScheduleName, currentSchedule)
        : currentSchedule;
    
    // Find current period
    let currentPeriod = progressSchedule.find(period => {
        const startTime = getTimeInSeconds(period.start);
        const endTime = getTimeInSeconds(period.end);
        return currentTimeInSeconds >= startTime && currentTimeInSeconds < endTime;
    });

    if (currentPeriod) {
        // We're in a period
        const startTime = getTimeInSeconds(currentPeriod.start);
        const endTime = getTimeInSeconds(currentPeriod.end);
        const totalDuration = endTime - startTime;
        const elapsed = currentTimeInSeconds - startTime;
        const progress = (elapsed / totalDuration) * 100;
        progressBar.style.width = `${progress}%`;
        return;
    }

    // Find the next period
    let nextPeriod = progressSchedule.find(period => 
        getTimeInSeconds(period.start) > currentTimeInSeconds
    );

    // If there's no next period, we've reached the end of the day
    if (!nextPeriod) {
        // Use the first period of tomorrow
        nextPeriod = progressSchedule[0];

        // Calculate progress through the overnight period
        const lastPeriodEnd = getTimeInSeconds(progressSchedule[progressSchedule.length - 1].end);
        const nextDayStart = getTimeInSeconds(nextPeriod.start) + (24 * 3600);
        const totalDuration = nextDayStart - lastPeriodEnd;
        // When after midnight, currentTimeInSeconds is small (e.g. 1800). Add 24h to compute elapsed since lastPeriodEnd.
        let elapsed = (currentTimeInSeconds + (24 * 3600)) - lastPeriodEnd;
        // Prevent division by zero and clamp values
        let progress = 0;
        if (totalDuration > 0) progress = (elapsed / totalDuration) * 100;
        // Clamp between 0 and 100
        progress = Math.max(0, Math.min(100, progress));

        progressBar.style.width = `${progress}%`;
        return;
    }

    // We're in between periods
    const previousPeriod = [...progressSchedule]
        .reverse()
        .find(period => getTimeInSeconds(period.end) <= currentTimeInSeconds);

    if (previousPeriod) {
        const freeStart = getTimeInSeconds(previousPeriod.end);
        const freeEnd = getTimeInSeconds(nextPeriod.start);
        const totalDuration = freeEnd - freeStart;
        const elapsed = currentTimeInSeconds - freeStart;
    let progress = 0;
    if (totalDuration > 0) progress = (elapsed / totalDuration) * 100;
    progress = Math.max(0, Math.min(100, progress));
    progressBar.style.width = `${progress}%`;
    } else {
        // Before first period of the day
        const firstPeriodStart = getTimeInSeconds(nextPeriod.start);
        const totalDuration = firstPeriodStart;
        const elapsed = currentTimeInSeconds;
    let progress = 0;
    if (totalDuration > 0) progress = (elapsed / totalDuration) * 100;
    progress = Math.max(0, Math.min(100, progress));
    progressBar.style.width = `${progress}%`;
    }
}

// Add to the loadSettings function
function loadProgressBarSettings() {
    // Set defaults: enabled true, color black, opacity 20
    let enabled = localStorage.getItem('progressBarEnabled');
    let color = localStorage.getItem('progressBarColor');
    let opacity = localStorage.getItem('progressBarOpacity');

    // If not set, use defaults and save them
    if (enabled === null) {
        enabled = true;
        localStorage.setItem('progressBarEnabled', 'true');
    } else {
        enabled = enabled === 'true';
    }
    if (!color) {
        color = '#000000';
        localStorage.setItem('progressBarColor', color);
    }
    if (!opacity) {
        opacity = '10';
        localStorage.setItem('progressBarOpacity', opacity);
    }

    const checkbox = document.getElementById('progress-bar');
    const colorInput = document.getElementById('progress-bar-color');
    const opacityInput = document.getElementById('progress-bar-opacity');
    const settings = document.getElementById('progress-bar-settings');
    
    if (checkbox && colorInput && opacityInput) {
        checkbox.checked = enabled;
        colorInput.value = color;
        opacityInput.value = opacity;
        settings.style.display = enabled ? 'block' : 'none';
        
        // Update opacity display
        const opacityDisplay = document.querySelector('#progress-bar-opacity + .range-value');
        if (opacityDisplay) {
            opacityDisplay.textContent = `${opacity}%`;
        }
        
        if (enabled) {
            createProgressBar();
        }
    }
}


// Modify the existing startCountdown function to include progress bar updates
function startCountdown() {
    // If TimerManager is present, delegate to it
    if (window.TimerManager && typeof window.TimerManager.start === 'function') {
        window.TimerManager.start();
        return window.TimerManager.getIntervalId ? window.TimerManager.getIntervalId() : null;
    }
    // Legacy fallback
    updateCountdowns();
    updateProgressBar();
    return setInterval(() => {
        updateCountdowns();
        updateProgressBar();
    }, 1000);
}

function updateFont() {
    const selector = document.getElementById('font-family');
    if (!selector) return;
    applyInterfaceFont(selector.value);
    saveSettings();
}

function toggleTheme() {
    // Theme toggle is disabled — site is forced to light mode.
    try { localStorage.setItem('theme', 'light'); } catch (e) {}
    const sidebar = document.getElementById('settings-sidebar');
    if (sidebar) sidebar.classList.add('light-mode');
    document.body.classList.add('light-mode');
}

// Update the theme loading code
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const sidebar = document.getElementById('settings-sidebar');
    const body = document.body;
    const icon = document.querySelector('.theme-toggle i');
    const text = document.querySelector('.theme-toggle-text');
    
    // Force light mode regardless of saved setting
    try { localStorage.setItem('theme', 'light'); } catch (e) {}
    if (sidebar) sidebar.classList.add('light-mode');
    body.classList.add('light-mode');
    if (icon) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
    if (text) text.textContent = 'Light Mode';
});

// ...existing code...


// Keep the custom-palette hex labels in sync with their color controls.
document.addEventListener('DOMContentLoaded', () => {
    try {
        const startColor = document.getElementById('gradient-start-color');
        const endColor = document.getElementById('gradient-end-color');
        const startHex = document.getElementById('gradient-start-hex');
        const endHex = document.getElementById('gradient-end-hex');

        function formatHex(el, out) {
            if (!el || !out) return;
            out.textContent = el.value ? el.value.toUpperCase() : el.value;
        }

        if (startColor && startHex) {
            startColor.addEventListener('input', () => formatHex(startColor, startHex));
            formatHex(startColor, startHex);
        }
        if (endColor && endHex) {
            endColor.addEventListener('input', () => formatHex(endColor, endHex));
            formatHex(endColor, endHex);
        }

    } catch (err) {
        console.error('Appearance UI bindings failed', err);
    }
});

// ...existing code...

function removeProgressBar() {
    const progressBar = document.querySelector('.progress-overlay');
    if (progressBar) {
        progressBar.remove();
    }
    const progressTrack = document.getElementById('period-progress-track');
    if (progressTrack) progressTrack.hidden = true;
    // If TimerManager exists, disable progress updates via it; otherwise clear legacy interval
    if (window.TimerManager && typeof window.TimerManager.setProgress === 'function') {
        window.TimerManager.setProgress(false);
    } else {
        if (window.progressInterval) {
            clearInterval(window.progressInterval);
            window.progressInterval = null;
        }
    }
}

async function handleAuthButton() {
    const auth = await getAuthManager();
    if (!auth) return;
    if (auth.isAuthenticated) {
        auth.logout();
    } else {
        auth.showLoginModal();
    }
}

// Modify your updateAuthButtonText function
async function updateAuthButtonText() {
    const auth = await getAuthManager();
    const buttonText = document.getElementById('auth-button-text');
    const headerButtonText = document.getElementById('header-auth-text');
    
    if (buttonText) {
        buttonText.textContent = auth?.isAuthenticated ? 'Sign Out' : 'Sign In';
    }
    if (headerButtonText) {
        headerButtonText.textContent = auth?.isAuthenticated ? 'Sign Out' : 'Sign In';
    }
}

// Add this to your initialization code or DOM content loaded event
document.addEventListener('DOMContentLoaded', () => {
    updateAuthButtonText();
});

// Add this function to handle saving settings
async function saveSettings() {
    if (!window.authManager?.currentUser) {
        window.updateSettingsSyncStatus?.('local');
        return true;
    }
    return window.authManager.scheduleUserSettingsSave();
}
