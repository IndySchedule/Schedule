// Global variables
let activeStop = null;
// Add this at the start of the file
function waitForAuth() {
    return new Promise((resolve) => {
        const checkAuth = () => {
            if (window.authManager) {
                resolve(window.authManager);
            } else {
                setTimeout(checkAuth, 50);
            }
        };
        checkAuth();
    });
}

// Add a check for auth manager availability
function getAuthManager() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.authManager) {
                resolve(window.authManager);
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
}

// Settings Management
function toggleSettingsSidebar() {  
    const sidebar = document.getElementById("settings-sidebar");
    if (!sidebar) return;
    sidebar.classList.toggle("open");
    const isOpen = sidebar.classList.contains("open");
    document.getElementById('settings-button')?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) window.trackAnalyticsEvent?.('settings_open');
    
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

// Add missing helper function
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
}

// Modify your loadSettings function
async function loadSettings() {
    try {
        await waitForAuth();
        const firestoreSettings = await loadUserSettings();
        
    // Initialize show period times checkbox from Firestore or localStorage
    const storedShowTimes = localStorage.getItem('showPeriodTimes');
    const syncedShowTimes = firestoreSettings?.showPeriodTimes;
    const showTimesSetting = syncedShowTimes == null
        ? storedShowTimes !== 'false'
        : syncedShowTimes === true || syncedShowTimes === 'true';
    localStorage.setItem('showPeriodTimes', showTimesSetting ? 'true' : 'false');
    const showTimesCheckbox = document.getElementById('show-period-times');
    if (showTimesCheckbox) showTimesCheckbox.checked = showTimesSetting;

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
    const fontFamily = document.getElementById('font-family').value;
    document.body.style.fontFamily = fontFamily;
    localStorage.setItem('fontFamily', fontFamily);
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
        buttonText.textContent = auth.isAuthenticated ? 'Sign Out' : 'Sign In';
    }
    if (headerButtonText) {
        headerButtonText.textContent = auth.isAuthenticated ? 'Sign Out' : 'Sign In';
    }
}

// Add this to your initialization code or DOM content loaded event
document.addEventListener('DOMContentLoaded', () => {
    updateAuthButtonText();
});

// Add this function to handle saving settings
async function saveSettings() {
    if (window.authManager?.currentUser) {
        await window.authManager.saveAllUserSettings(window.authManager.currentUser.uid);
    }
}
