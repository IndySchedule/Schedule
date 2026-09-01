// Remove imports and use global Firebase object
const firebaseConfig = {
    apiKey: "AIzaSyDRa4lGMmm8sqxLpeGARGHjKRCxZ0ODUJs",
    authDomain: "indyschedule-1.firebaseapp.com",
    projectId: "indyschedule-1",
    storageBucket: "indyschedule-1.firebasestorage.app",
    messagingSenderId: "615676548709",
    appId: "1:615676548709:web:6de8ebb4b7cf469af5188c",
    measurementId: "G-Q8H5WCQK3T"
};

const ANALYTICS_CONSENT_KEY = 'indyAnalyticsConsent_v1';
const SETTINGS_SCHEMA_VERSION = 2;
const SETTINGS_CLIENT_ID_KEY = 'indySettingsClientId_v1';
const SETTINGS_KEYS = Object.freeze([
    'toastIconEnabled', 'fontFamily', 'theme', 'showPeriodTimes', 'lunchWave',
    'progressBarEnabled', 'progressBarColor', 'progressBarOpacity',
    'gradientSettings', 'currentScheduleName', 'indyScheduleOverride_v1',
    'indyOnboardingComplete_v2', 'indyAnalyticsConsent_v1',
    'indyReleaseNotice_v1_3_5', 'sawUpdateNotice', 'periodRenames',
    'globalPeriodNames'
]);

function stableSettingsValue(value) {
    if (Array.isArray(value)) return value.map(stableSettingsValue);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = stableSettingsValue(value[key]);
            return result;
        }, {});
    }
    return value;
}

function settingsValuesEqual(first, second) {
    return JSON.stringify(stableSettingsValue(first)) === JSON.stringify(stableSettingsValue(second));
}

function sanitizeNameMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entries = Object.entries(value).slice(0, 100);
    return entries.reduce((result, [key, name]) => {
        if (typeof key === 'string' && key.length <= 80 && typeof name === 'string' && name.length <= 100) {
            result[key] = name;
        }
        return result;
    }, {});
}

function sanitizeBooleanSetting(value) {
    if (value === true || value === 'true' || value === '1') return 'true';
    if (value === false || value === 'false' || value === '0') return 'false';
    return null;
}

function sanitizeSettingValue(key, value) {
    if (value === null && key === 'indyScheduleOverride_v1') return null;
    if (value === null || typeof value === 'undefined') return undefined;

    if (['toastIconEnabled', 'showPeriodTimes', 'progressBarEnabled',
        'indyOnboardingComplete_v2', 'indyReleaseNotice_v1_3_5', 'sawUpdateNotice'].includes(key)) {
        return sanitizeBooleanSetting(value) ?? undefined;
    }
    if (key === 'fontFamily') return typeof value === 'string' && value.length <= 80 ? value : undefined;
    if (key === 'theme') return typeof value === 'string' && value.length <= 24 ? value : undefined;
    if (key === 'lunchWave') return ['A', 'B', 'C'].includes(String(value).toUpperCase()) ? String(value).toUpperCase() : undefined;
    if (key === 'progressBarColor') return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : undefined;
    if (key === 'progressBarOpacity') {
        const opacity = Number(value);
        return Number.isFinite(opacity) && opacity >= 0 && opacity <= 100 ? String(opacity) : undefined;
    }
    if (key === 'currentScheduleName') {
        return ['normal', 'normalNoSoar', 'lateStart', 'halfDay'].includes(value) ? value : undefined;
    }
    if (key === 'indyAnalyticsConsent_v1') return ['granted', 'denied'].includes(value) ? value : undefined;
    if (key === 'periodRenames' || key === 'globalPeriodNames') return sanitizeNameMap(value) ?? undefined;
    if (key === 'indyScheduleOverride_v1') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
        const date = typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : null;
        const schedule = ['normal', 'normalNoSoar', 'lateStart', 'halfDay'].includes(value.schedule) ? value.schedule : null;
        return date && schedule ? { date, schedule } : undefined;
    }
    if (key === 'gradientSettings') {
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
            const serialized = JSON.stringify(parsed);
            return serialized.length <= 6000 ? serialized : undefined;
        } catch (error) {
            return undefined;
        }
    }
    return undefined;
}

function sanitizeUserSettings(settings = {}) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
    return SETTINGS_KEYS.reduce((result, key) => {
        if (!Object.prototype.hasOwnProperty.call(settings, key)) return result;
        const sanitized = sanitizeSettingValue(key, settings[key]);
        if (typeof sanitized !== 'undefined') result[key] = sanitized;
        return result;
    }, {});
}

function collectLocalUserSettings() {
    const settings = {
        toastIconEnabled: localStorage.getItem(TOAST_ICON_KEY),
        fontFamily: localStorage.getItem('fontFamily'),
        theme: localStorage.getItem('theme'),
        showPeriodTimes: localStorage.getItem('showPeriodTimes'),
        lunchWave: localStorage.getItem('lunchWave'),
        progressBarEnabled: localStorage.getItem('progressBarEnabled'),
        progressBarColor: localStorage.getItem('progressBarColor'),
        progressBarOpacity: localStorage.getItem('progressBarOpacity'),
        gradientSettings: localStorage.getItem('gradientSettings'),
        currentScheduleName: localStorage.getItem('currentScheduleName'),
        indyScheduleOverride_v1: null,
        indyOnboardingComplete_v2: localStorage.getItem('indyOnboardingComplete_v2'),
        indyAnalyticsConsent_v1: localStorage.getItem(ANALYTICS_CONSENT_KEY),
        indyReleaseNotice_v1_3_5: localStorage.getItem('indyReleaseNotice_v1_3_5'),
        sawUpdateNotice: localStorage.getItem('sawUpdateNotice')
    };

    try {
        const scheduleOverride = localStorage.getItem('indyScheduleOverride_v1');
        if (scheduleOverride) settings.indyScheduleOverride_v1 = JSON.parse(scheduleOverride);
    } catch (error) {
        console.warn('Could not parse the saved schedule override.', error);
    }
    ['periodRenames', 'globalPeriodNames'].forEach((key) => {
        try {
            const value = localStorage.getItem(key);
            if (value && value !== '[object Object]') settings[key] = JSON.parse(value);
        } catch (error) {
            console.warn(`Could not parse ${key}.`, error);
        }
    });
    return sanitizeUserSettings(settings);
}

function getSettingsClientId() {
    const existing = localStorage.getItem(SETTINGS_CLIENT_ID_KEY);
    if (existing && /^[a-z0-9-]{8,128}$/i.test(existing)) return existing;
    const generated = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `client-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(SETTINGS_CLIENT_ID_KEY, generated);
    return generated;
}

function updateSettingsSyncStatus(state = 'local') {
    const status = document.getElementById('settings-sync-status');
    if (!status) return;
    const detail = document.getElementById('settings-sync-detail');
    const labels = {
        local: 'Saved on this device',
        loading: 'Restoring settings…',
        saving: 'Saving…',
        saved: 'Saved to your account',
        error: 'Cloud save failed'
    };
    status.dataset.state = state;
    status.textContent = labels[state] || labels.local;
    if (detail) {
        const revision = Number(window.authManager?._lastSyncedRevision || 0);
        const suffix = revision > 0 ? ` Sync revision ${revision}.` : '';
        detail.textContent = state === 'saved'
            ? `Your preferences are saved to your account and this browser.${suffix}`
            : state === 'saving'
                ? 'Your latest preference change is being saved to your account.'
                : state === 'loading'
                    ? 'Your account preferences are being restored on this device.'
                    : state === 'error'
                        ? 'We could not save to your account. Your local preferences are still available.'
                        : 'Your preferences are stored in this browser.';
    }
}
window.updateSettingsSyncStatus = updateSettingsSyncStatus;

function getAnalyticsConsent() {
    try {
        const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
        return value === 'granted' || value === 'denied' ? value : null;
    } catch (error) {
        return null;
    }
}

window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function() { window.dataLayer.push(arguments); };

function updateGoogleConsent(granted, command = 'default') {
    window.gtag('consent', command, {
        analytics_storage: granted ? 'granted' : 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
    });
}

updateGoogleConsent(getAnalyticsConsent() === 'granted');

function ensureAnalytics() {
    if (!window.authManager || typeof firebase?.analytics !== 'function') return null;
    if (!window.authManager.analytics) {
        window.authManager.analytics = firebase.analytics();
    }
    return window.authManager.analytics;
}

function updateAnalyticsConsentUI() {
    const consent = getAnalyticsConsent();
    const toggle = document.getElementById('analytics-consent-toggle');
    const status = document.getElementById('analytics-consent-status');
    if (toggle) toggle.checked = consent === 'granted';
    if (status) {
        status.textContent = consent === 'granted'
            ? 'Visitor analytics are enabled.'
            : 'Visitor analytics are disabled.';
    }
}

function setAnalyticsConsent(granted) {
    try {
        localStorage.setItem(ANALYTICS_CONSENT_KEY, granted ? 'granted' : 'denied');
    } catch (error) {
        console.warn('Could not save Analytics preference.', error);
    }

    updateGoogleConsent(granted, 'update');
    if (granted) {
        const analytics = ensureAnalytics();
        analytics?.setAnalyticsCollectionEnabled(true);
        analytics?.logEvent('analytics_consent_granted');
    } else if (window.authManager?.analytics) {
        window.authManager.analytics.setAnalyticsCollectionEnabled(false);
    }
    updateAnalyticsConsentUI();
    const currentUser = window.authManager?.currentUser;
    if (currentUser) window.authManager.saveAllUserSettings(currentUser.uid).catch(() => {});
}

window.trackAnalyticsEvent = function(eventName, parameters = {}) {
    if (getAnalyticsConsent() !== 'granted') return;
    ensureAnalytics()?.logEvent(eventName, parameters);
};

function initializeAnalyticsConsentUI() {
    document.getElementById('analytics-consent-toggle')?.addEventListener('change', (event) => {
        setAnalyticsConsent(event.target.checked);
    });
    updateAnalyticsConsentUI();
}

function initializeLocalDataControls() {
    const openButton = document.getElementById('delete-local-data');
    const confirmation = document.getElementById('delete-local-data-confirmation');
    const cancelButton = document.getElementById('cancel-delete-local-data');
    const confirmButton = document.getElementById('confirm-delete-local-data');
    const status = document.getElementById('delete-local-data-status');
    if (!openButton || !confirmation || !cancelButton || !confirmButton) return;

    const setConfirmationOpen = (isOpen) => {
        confirmation.hidden = !isOpen;
        openButton.setAttribute('aria-expanded', String(isOpen));
        openButton.hidden = isOpen;
        if (status) status.textContent = '';
        if (isOpen) cancelButton.focus();
        else openButton.focus();
    };

    openButton.addEventListener('click', () => setConfirmationOpen(true));
    cancelButton.addEventListener('click', () => setConfirmationOpen(false));

    confirmButton.addEventListener('click', () => {
        confirmButton.disabled = true;
        cancelButton.disabled = true;
        confirmButton.innerHTML = '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Deleting…';

        try {
            // Stop optional measurement before removing its saved consent.
            updateGoogleConsent(false, 'update');
            window.authManager?.analytics?.setAnalyticsCollectionEnabled(false);
            localStorage.clear();
            confirmation.hidden = true;
            if (status) status.textContent = 'Stored browser data deleted. Restarting Indy Schedule…';
            window.setTimeout(() => window.location.reload(), 650);
        } catch (error) {
            console.error('Could not delete locally stored Indy Schedule data.', error);
            confirmButton.disabled = false;
            cancelButton.disabled = false;
            confirmButton.innerHTML = '<i class="fas fa-trash" aria-hidden="true"></i> Delete everything';
            if (status) status.textContent = 'The stored data could not be deleted. Please try again.';
        }
    });
}

window.getAnalyticsConsent = getAnalyticsConsent;
window.setAnalyticsConsent = setAnalyticsConsent;

const TOAST_ICON_KEY = 'toastIconEnabled';
const BREAD_WORDS = ['bread', 'bagel', 'toast', 'roll', 'waffle', 'pancake', 'brioche', 'wheat', 'rye', 'sourdough', 'bun', 'ciabatta', 'focaccia', 'pita', 'naan', 'baguette', 'flatbread', 'chapati', 'cornbread', 'pain', 'pumpernickel', 'monkey bread', 'pane', 'zopf', 'sweetroll', 'muffin', 'crumpet', 'babka', 'crostini', 'rye bread', 'tortilla', 'pain de mie', 'panettone', 'stollen', 'english muffin', 'breadstick', 'lavash', 'kettle bread', 'soda bread', 'pullman loaf', 'cinnamon roll', 'garlic bread', 'baguette viennoise', 'hardroll', 'soft roll', 'dinner roll', 'pretzel roll', 'coburg', 'rusk', 'tiger bread', 'naan bread', 'challah', 'bretzel', 'polenta bread', 'salt rising bread', 'pumpkin bread', 'beer bread', 'fry bread', 'sourdough baguette', 'brioche loaf', 'whole grain bread', 'gluten-free bread', 'multigrain bread', 'sweet roll', 'bunny bread', 'french toast', 'kvass bread', 'baker\'s bread', 'caraway bread', 'pane Siciliano', 'romano bread', 'cereal bread', 'bamboo bread', 'Miche', 'cinnamon swirl bread', 'oatmeal bread', 'spelt bread', 'seeded bread', 'lavender bread', 'tzatziki bread', 'toasted rye', 'Nordic flatbread', 'pepper bread', 'bakers'];


function isToastIconEnabled() {
    try {
        const value = localStorage.getItem(TOAST_ICON_KEY);
        return value === true || value === 'true' || value === '1';
    } catch (e) {
        return false;
    }
}

function updateToastIcon() {
    try {
        const existing = document.getElementById('toast-easter-egg');
        const enabled = isToastIconEnabled();

        if (!enabled) {
            if (existing) existing.remove();
            return;
        }

        if (existing) return;

        const icon = document.createElement('div');
        icon.id = 'toast-easter-egg';
        icon.setAttribute('role', 'img');
        icon.setAttribute('aria-label', 'Mildly annoyed toaster');
        icon.title = 'I am still mildly annoyed – toaster';
        icon.setAttribute('data-tooltip', 'I am still mildly annoyed – toaster');
        icon.innerHTML = '<i class="fas fa-bread-slice" aria-hidden="true"></i>';
        icon.addEventListener('click', triggerToastChaos, { once: false });

        document.body.appendChild(icon);
    } catch (e) {
        console.warn('Could not render toast icon', e);
    }
}

let toastChaosActive = false;
function triggerToastChaos() {
    if (toastChaosActive) return;
    toastChaosActive = true;

    // Replace visible text with bread variants during the effect
    breadifyTextNodes();
    startBreadFlash();
    applyBreadBackground();

    const container = document.createElement('div');
    container.className = 'toast-chaos-container';
    document.body.appendChild(container);

    const spawnWindowMs = 4200;
    const spawnEnd = Date.now() + spawnWindowMs;

    function spawnToastPieces(count = 12) {
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'toast-piece';
            const delay = Math.random() * 0.5;
            const duration = 1.6 + Math.random() * 1.4; // faster flight

            // Spawn from random points along the screen edges (slightly off-screen), fling in any direction
            const edge = Math.floor(Math.random() * 4); // 0=top,1=right,2=bottom,3=left
            let startX, startY;
            if (edge === 0) { // top
                startX = Math.random() * 100;
                startY = -15 - Math.random() * 10;
            } else if (edge === 1) { // right
                startX = 110 + Math.random() * 10;
                startY = Math.random() * 100;
            } else if (edge === 2) { // bottom
                startX = Math.random() * 100;
                startY = 110 + Math.random() * 10;
            } else { // left
                startX = -15 - Math.random() * 10;
                startY = Math.random() * 100;
            }

            // fling toward a random target zone (can exit off-screen)
            const endX = startX + (Math.random() * 220 - 110); // +/-110vw
            const endY = startY + (Math.random() * 220 - 110); // +/-110vh

            const spin = (Math.random() * 1400 - 700).toFixed(1);
            piece.style.setProperty('--start-x', `${startX}vw`);
            piece.style.setProperty('--end-x', `${endX}vw`);
            piece.style.setProperty('--start-y', `${startY}vh`);
            piece.style.setProperty('--end-y', `${endY}vh`);
            piece.style.setProperty('--spin', `${spin}deg`);
            piece.style.setProperty('--duration', `${duration}s`);
            piece.style.animationDelay = `${delay}s`;
            piece.style.animationDuration = `${duration}s`;
            container.appendChild(piece);
        }
    }

    spawnToastPieces(45); // initial burst (fewer, much larger pieces)
    const spawnInterval = setInterval(() => {
        if (Date.now() > spawnEnd) {
            clearInterval(spawnInterval);
            return;
        }
        spawnToastPieces(20);
    }, 120);

    const glitch = document.createElement('div');
    glitch.className = 'toast-glitch-overlay';
    document.body.appendChild(glitch);

    // Build glitch slices with randomized transforms/hues for full-screen effect
    const slices = 22;
    for (let i = 0; i < slices; i++) {
        const slice = document.createElement('div');
        slice.className = 'toast-glitch-slice';
        const height = 3 + Math.random() * 10;
        const top = Math.random() * 100;
        const dur = 1 + Math.random() * 1.4;
        const delay = Math.random() * 0.8;
        const x1 = (Math.random() * 30 - 15).toFixed(1) + 'px';
        const x2 = (Math.random() * 40 - 20).toFixed(1) + 'px';
        const hue1 = (Math.random() * 40 - 20).toFixed(1) + 'deg';
        const hue2 = (Math.random() * 50 - 25).toFixed(1) + 'deg';
        slice.style.top = `${top}%`;
        slice.style.height = `${height}px`;
        slice.style.animationDelay = `${delay}s`;
        slice.style.animationDuration = `${dur}s`;
        slice.style.setProperty('--glitch-x-1', x1);
        slice.style.setProperty('--glitch-x-2', x2);
        slice.style.setProperty('--glitch-hue-1', hue1);
        slice.style.setProperty('--glitch-hue-2', hue2);
        glitch.appendChild(slice);
    }

    // After the chaos, fade to black then reload
    setTimeout(() => {
        glitch.classList.add('active');
    }, 200);

    setTimeout(() => {
        const blackout = document.createElement('div');
        blackout.className = 'toast-blackout';
        document.body.appendChild(blackout);
    }, spawnWindowMs + 800);

    setTimeout(() => {
        window.location.reload();
    }, spawnWindowMs + 2000);
}

function breadifyTextNodes() {
    try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node || !node.data || !node.data.trim()) return NodeFilter.FILTER_REJECT;
                // skip script/style tags
                const parent = node.parentNode;
                if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|IFRAME|CANVAS)$/.test(parent.nodeName)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const replacements = [];
        while (walker.nextNode()) {
            const n = walker.currentNode;
            const choice = BREAD_WORDS[Math.floor(Math.random() * BREAD_WORDS.length)];
            replacements.push({ node: n, value: choice });
        }
        replacements.forEach(({ node, value }) => { node.data = value; });
    } catch (e) {
        console.warn('breadify failed', e);
    }
}

let breadFlashInterval = null;
function startBreadFlash() {
    try {
        const timerEl = document.getElementById('current-period-time');
        const headerEl = document.getElementById('countdown-heading');
        if (!timerEl && !headerEl) return;

        if (breadFlashInterval) clearInterval(breadFlashInterval);
        breadFlashInterval = setInterval(() => {
            const word = BREAD_WORDS[Math.floor(Math.random() * BREAD_WORDS.length)];
            if (timerEl) timerEl.textContent = word;
            const word2 = BREAD_WORDS[Math.floor(Math.random() * BREAD_WORDS.length)];
            if (headerEl) headerEl.textContent = word2;
        }, 70); // rapid flashing
    } catch (e) {
        console.warn('flash failed', e);
    }
}

function applyBreadBackground() {
    try {
        document.body.style.setProperty('--pre-bread-bg', document.body.style.backgroundImage || '');
        document.body.style.backgroundImage = `
            radial-gradient(circle at 10% 20%, rgba(244,198,131,0.28), transparent 28%),
            radial-gradient(circle at 80% 10%, rgba(255,235,180,0.22), transparent 26%),
            radial-gradient(circle at 30% 80%, rgba(193,146,89,0.25), transparent 30%),
            repeating-linear-gradient(
                45deg,
                rgba(255,255,255,0.04) 0px,
                rgba(255,255,255,0.04) 12px,
                rgba(0,0,0,0.08) 12px,
                rgba(0,0,0,0.08) 18px
            )
        `;
        document.body.style.backgroundColor = '#f5deb3';
        document.body.style.backgroundBlendMode = 'screen, screen, multiply, normal';
    } catch (e) {
        console.warn('could not apply bread background', e);
    }
}

class AuthManager {
    constructor() {
        // Initialize Firebase first
        this.app = firebase.initializeApp(firebaseConfig);
        this.auth = firebase.auth();
        this.analytics = null;
        this.provider = new firebase.auth.GoogleAuthProvider();
        this.isAuthenticated = false;
        this.currentUser = null;
        this._settingsLoadPromise = null;
        this._settingsLoadUserId = null;
        this._settingsSaveTimer = null;
        this._settingsSaveResolvers = [];
        this._settingsSaveChain = Promise.resolve(true);
        this._lastSyncedSettings = null;
        this._lastSyncedRevision = 0;
        this._settingsClientId = getSettingsClientId();
        
        // Make auth manager globally available immediately
        window.authManager = this;
        if (getAnalyticsConsent() === 'granted') {
            this.analytics = firebase.analytics();
            this.analytics.setAnalyticsCollectionEnabled(true);
        }
        
        const initializeWhenReady = () => {
            this.initializeAccountUI();
            this.checkAuthentication();
            this.updateUI();
            this.auth.onAuthStateChanged(user => {
                this.currentUser = user;
                this.isAuthenticated = !!user;
                this.updateUI();
                updateSettingsSyncStatus(user ? 'loading' : 'local');
                if (user) {
                    this._maybeLoadUserSettings().then(settings => {
                        window.dispatchEvent(new CustomEvent('indy-account-authenticated', {
                            detail: { source: 'saved-session', settingsRestored: Boolean(settings) }
                        }));
                    });
                }
            });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeWhenReady);
        else initializeWhenReady();
        
        // Add message listener for popup communication
        window.addEventListener('message', this.handleAuthMessage.bind(this));
    }

    // Add handler for auth messages
    handleAuthMessage(event) {
        if (event.origin !== window.location.origin) return;
        
        switch (event.data.type) {
            case 'AUTH_SUCCESS':
                this.handleAuthSuccess(event.data.credential);
                break;
            case 'AUTH_ERROR':
                this.handleAuthError(event.data.error);
                break;
        }
    }

    async handleAuthSuccess(credential) {
        try {
            // Wait for the current user to be properly set
            await this.auth.currentUser?.reload();
            this.currentUser = this.auth.currentUser;
            
            // Make sure we have the user's photo URL
            if (!this.currentUser?.photoURL) {
                console.warn('No photo URL found for user');
                // Use a default avatar if no photo is available
                this.currentUser = {
                    ...this.currentUser,
                    photoURL: 'https://www.gravatar.com/avatar/?d=mp'
                };
            }
            
            this.isAuthenticated = true;
            this.hideLoginModal();
            this.updateUI();
            updateToastIcon();
            
            // Load or save user settings in Firestore (will load if present,
            // otherwise save current local settings). Use the existing
            // _maybeLoadUserSettings helper which handles both cases.
            await this._maybeLoadUserSettings();
            
            // Refresh the page after successful login
            window.location.reload();
        } catch (error) {
            console.error('Error handling auth success:', error);
            this.showError('Error loading user profile');
        }
    }

    scheduleUserSettingsSave(delay = 450) {
        if (!this.currentUser) {
            updateSettingsSyncStatus('local');
            return Promise.resolve(true);
        }
        updateSettingsSyncStatus('saving');
        window.clearTimeout(this._settingsSaveTimer);
        const pending = new Promise((resolve) => this._settingsSaveResolvers.push(resolve));
        this._settingsSaveTimer = window.setTimeout(async () => {
            this._settingsSaveTimer = null;
            const resolvers = this._settingsSaveResolvers.splice(0);
            const saved = this.currentUser
                ? await this.saveAllUserSettings(this.currentUser.uid)
                : true;
            if (!this.currentUser) updateSettingsSyncStatus('local');
            resolvers.forEach((resolve) => resolve(saved));
        }, delay);
        return pending;
    }

    async saveAllUserSettings(userId) {
        if (!userId) return false;
        const queuedResolvers = this._settingsSaveTimer ? this._settingsSaveResolvers.splice(0) : [];
        window.clearTimeout(this._settingsSaveTimer);
        this._settingsSaveTimer = null;
        updateSettingsSyncStatus('saving');
        this._settingsSaveChain = this._settingsSaveChain
            .catch(() => false)
            .then(() => this._saveAllUserSettingsNow(userId));
        const saved = await this._settingsSaveChain;
        queuedResolvers.forEach((resolve) => resolve(saved));
        return saved;
    }

    async _saveAllUserSettingsNow(userId) {
        try {
            const db = firebase.firestore();
            const userDocRef = db.collection("users").doc(userId);
            const localSettings = collectLocalUserSettings();
            const baseline = this._lastSyncedSettings;
            const localChangedKeys = new Set(SETTINGS_KEYS.filter((key) => (
                Object.prototype.hasOwnProperty.call(localSettings, key)
                && (!baseline || !settingsValuesEqual(localSettings[key], baseline[key]))
            )));
            const serverTimestamp = firebase.firestore.FieldValue?.serverTimestamp?.();
            let committedSettings = localSettings;
            let committedRevision = 0;

            await db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(userDocRef);
                const remoteDocument = snapshot.exists ? (snapshot.data() || {}) : {};
                const remoteSchemaVersion = Number(remoteDocument.schemaVersion || 1);
                if (remoteSchemaVersion > SETTINGS_SCHEMA_VERSION) {
                    throw new Error(`Settings schema ${remoteSchemaVersion} is newer than this app supports.`);
                }

                const remoteSettings = sanitizeUserSettings(remoteDocument.settings || {});
                const mergedSettings = { ...remoteSettings };
                const changedKeys = baseline ? localChangedKeys : new Set(Object.keys(localSettings));
                changedKeys.forEach((key) => {
                    if (Object.prototype.hasOwnProperty.call(localSettings, key)) mergedSettings[key] = localSettings[key];
                });

                // If no field changed locally, retain the newest remote copy.
                // This prevents an idle device from overwriting another device.
                const now = Date.now();
                const settingsUpdatedAt = { ...(remoteDocument.settingsUpdatedAt || {}) };
                Object.keys(mergedSettings).forEach((key) => {
                    if (changedKeys.has(key) || !Object.prototype.hasOwnProperty.call(settingsUpdatedAt, key)) {
                        settingsUpdatedAt[key] = now;
                    }
                });
                Object.keys(settingsUpdatedAt).forEach((key) => {
                    if (!Object.prototype.hasOwnProperty.call(mergedSettings, key)) delete settingsUpdatedAt[key];
                });

                const remoteRevision = Number.isInteger(remoteDocument.revision) ? remoteDocument.revision : 0;
                committedRevision = remoteRevision + 1;
                committedSettings = mergedSettings;
                transaction.set(userDocRef, {
                    schemaVersion: SETTINGS_SCHEMA_VERSION,
                    revision: committedRevision,
                    updatedAt: serverTimestamp || new Date(),
                    updatedBy: this._settingsClientId,
                    settingsUpdatedAt,
                    settings: mergedSettings
                }, {
                    // Replace the validated maps as whole fields so retired
                    // legacy keys cannot survive a schema migration. Other
                    // unrelated top-level account data remains untouched.
                    mergeFields: [
                        'schemaVersion', 'revision', 'updatedAt', 'updatedBy',
                        'settingsUpdatedAt', 'settings'
                    ]
                });
            });

            // Adopt remote-only changes locally so a later save from this
            // device does not mistake stale local data for a new edit.
            applyUserSettingsToLocalStorage(committedSettings);
            this._lastSyncedSettings = stableSettingsValue(committedSettings);
            this._lastSyncedRevision = committedRevision;
            console.info("✓ All settings saved to Firestore");
            updateSettingsSyncStatus('saved');
            
            return true;
        } catch (error) {
            console.error("❌ Error saving settings:", error);
            window.reportAppError?.('account_sync', error, 'save_failed');
            updateSettingsSyncStatus('error');
            return false;
        }
    }

    // Replace _maybeSaveUserSettings with _maybeLoadUserSettings to avoid overwriting Firestore
    async _maybeLoadUserSettings() {
        if (!this.currentUser) return null;
        if (this._settingsLoadPromise && this._settingsLoadUserId === this.currentUser.uid) {
            return this._settingsLoadPromise;
        }
        if (this._settingsLoadUserId !== this.currentUser.uid) {
            this._lastSyncedSettings = null;
            this._lastSyncedRevision = 0;
        }
        this._settingsLoadUserId = this.currentUser.uid;
        this._settingsLoadPromise = this._loadUserSettingsOnce(this.currentUser.uid);
        return this._settingsLoadPromise;
    }

    async _loadUserSettingsOnce(userId) {
        try {
            const db = firebase.firestore();
            const userDocRef = db.collection("users").doc(userId);
            const doc = await userDocRef.get();
            
            if (doc.exists) {
                console.info("User settings found in Firestore, loading them.");
                const remoteDocument = doc.data() || {};
                const remoteSchemaVersion = Number(remoteDocument.schemaVersion || 1);
                if (remoteSchemaVersion > SETTINGS_SCHEMA_VERSION) {
                    throw new Error(`Settings schema ${remoteSchemaVersion} is newer than this app supports.`);
                }
                const settings = sanitizeUserSettings(remoteDocument.settings || {});
                this._lastSyncedSettings = stableSettingsValue(settings);
                this._lastSyncedRevision = Number.isInteger(remoteDocument.revision) ? remoteDocument.revision : 0;
                applyUserSettingsToLocalStorage(settings);
                if (settings) {
                    // Apply visual settings without overwriting other local preferences
                    document.body.style.backgroundImage = '';
                    localStorage.removeItem('bgImage');

                    // Gradient handling
                    if (settings.gradientSettings) {
                        const gradientSettings = (typeof settings.gradientSettings === 'string')
                            ? JSON.parse(settings.gradientSettings)
                            : settings.gradientSettings;
                        if (window.gradientManager) {
                            window.gradientManager.loadExternalSettings(gradientSettings);
                        }
                    }

                    // Visual settings
                    if (settings.fontFamily) {
                        if (typeof window.applyInterfaceFont === 'function') window.applyInterfaceFont(settings.fontFamily);
                        else document.body.style.fontFamily = settings.fontFamily;
                    }

                    // Load settings into UI
                    if (typeof loadSettings === 'function') {
                        await loadSettings(settings);
                    }

                    updateToastIcon();
                    updateSettingsSyncStatus('saved');
                    console.info("✓ Settings applied successfully");
                    return settings;
                }
            } else {
                console.info("No settings found in Firestore, saving current local settings.");
                await this.saveAllUserSettings(userId);
                updateToastIcon();
            }
        } catch (e) {
            console.error("Error handling user settings:", e);
            updateSettingsSyncStatus('error');
            this._settingsLoadPromise = null;
            this._settingsLoadUserId = null;
        }
        return null;
    }

    handleAuthError(error) {
        console.error('Auth error:', error);
        this.showError(error);
    }

    async initializeAuth() {
        // Check for redirect result on page load
        await this.handleRedirectResult();
    }

    initializeAccountUI() {
        const modal = document.getElementById('login-modal');
        const form = document.getElementById('email-auth-form');
        if (!modal || !form || modal.dataset.authBound === 'true') return;
        modal.dataset.authBound = 'true';
        modal.querySelectorAll('input, button').forEach((control) => { control.disabled = false; });
        const unavailableMessage = document.getElementById('login-error');
        if (unavailableMessage?.textContent.includes('Account services are unavailable')) {
            unavailableMessage.textContent = '';
            unavailableMessage.style.display = 'none';
        }

        const modeButtons = Array.from(modal.querySelectorAll('[data-auth-mode]'));
        const nameGroup = document.getElementById('auth-name-group');
        const nameInput = document.getElementById('auth-display-name');
        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const submitButton = document.getElementById('email-auth-submit');
        const forgotButton = document.getElementById('forgot-password');
        const status = document.getElementById('login-status');
        let mode = 'signin';

        const clearFeedback = () => {
            const error = document.getElementById('login-error');
            if (error) {
                error.textContent = '';
                error.style.display = 'none';
            }
            if (status) status.textContent = '';
        };

        const setMode = (nextMode) => {
            mode = nextMode === 'create' ? 'create' : 'signin';
            modeButtons.forEach((button) => {
                const active = button.dataset.authMode === mode;
                button.classList.toggle('active', active);
                button.setAttribute('aria-selected', String(active));
            });
            if (nameGroup) nameGroup.hidden = mode !== 'create';
            if (nameInput) nameInput.required = mode === 'create';
            if (passwordInput) passwordInput.autocomplete = mode === 'create' ? 'new-password' : 'current-password';
            if (submitButton) submitButton.textContent = mode === 'create' ? 'Create account' : 'Sign in';
            if (forgotButton) forgotButton.hidden = mode !== 'signin';
            clearFeedback();
        };
        modal._setAuthMode = setMode;

        modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.authMode)));
        document.getElementById('login-close')?.addEventListener('click', () => this.hideLoginModal());
        document.getElementById('google-auth-button')?.addEventListener('click', () => this.signIn());

        forgotButton?.addEventListener('click', async () => {
            clearFeedback();
            const email = emailInput?.value.trim() || '';
            if (!email) {
                this.showError('Enter your email address first, then choose “Forgot your password?”');
                emailInput?.focus();
                return;
            }
            forgotButton.disabled = true;
            try {
                await this.auth.sendPasswordResetEmail(email);
                if (status) status.textContent = 'Password reset email sent. Check your inbox.';
            } catch (error) {
                this.handleAuthError(error);
            } finally {
                forgotButton.disabled = false;
            }
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearFeedback();
            if (!form.reportValidity()) return;
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const displayName = nameInput?.value.trim() || '';
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> ${mode === 'create' ? 'Creating account…' : 'Signing in…'}`;
            try {
                await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                const credential = mode === 'create'
                    ? await this.auth.createUserWithEmailAndPassword(email, password)
                    : await this.auth.signInWithEmailAndPassword(email, password);
                if (mode === 'create' && displayName) await credential.user.updateProfile({ displayName });
                this.currentUser = credential.user;
                this.isAuthenticated = true;
                await this._maybeLoadUserSettings();
                const enteredFromOnboarding = modal.dataset.onboardingEntry === 'true';
                this.hideLoginModal();
                if (enteredFromOnboarding) {
                    window.dispatchEvent(new CustomEvent('indy-account-authenticated', {
                        detail: { mode, userId: credential.user.uid }
                    }));
                } else {
                    window.location.reload();
                }
            } catch (error) {
                this.handleAuthError(error);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = mode === 'create' ? 'Create account' : 'Sign in';
            }
        });

        setMode('signin');
    }

    async signIn() {
        if (this.isPopupOpen) return;
        
        try {
            this.isPopupOpen = true;
            // Use signInWithPopup directly without showing modal
            const result = await this.auth.signInWithPopup(this.provider);
            
            if (result?.credential?.accessToken) {
                await this.handleAuthSuccess(result.credential);
            }
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            this.isPopupOpen = false;
        }
    }

    // Add redirect result handler
    async handleRedirectResult() {
        try {
            const result = await this.auth.getRedirectResult();
            if (result?.credential?.accessToken) {
                await this.handleAuthSuccess(result.credential);
            }
        } catch (error) {
            this.handleAuthError(error);
        }
    }

    showError(message) {
        const errorElement = document.getElementById('login-error');
        if (errorElement) {
            const friendlyMessages = {
                'auth/email-already-in-use': 'An account already uses this email. Sign in instead.',
                'auth/invalid-email': 'Enter a valid email address.',
                'auth/weak-password': 'Choose a stronger password with at least 6 characters.',
                'auth/password-does-not-meet-requirements': 'Choose a password that meets the account security requirements.',
                'auth/wrong-password': 'The email or password is incorrect.',
                'auth/invalid-credential': 'The email or password is incorrect.',
                'auth/user-not-found': 'The email or password is incorrect.',
                'auth/too-many-requests': 'Too many attempts. Wait a little while and try again.',
                'auth/network-request-failed': 'Could not reach Firebase. Check your connection and try again.',
                'auth/operation-not-allowed': 'Email accounts are not enabled yet in Firebase.'
            };
            errorElement.textContent = friendlyMessages[message?.code] || message?.message || message || 'Authentication failed.';
            errorElement.style.display = 'block';
        }
    }

    updateUI() {
        const headerButton = document.getElementById('sign-in-button');
        if (!headerButton) return;

        if (this.isAuthenticated && this.currentUser) {
            headerButton.classList.add('is-signed-in');
            headerButton.classList.remove('is-signed-out');
            const photoURL = this.currentUser.photoURL || '';
            const avatar = photoURL
                ? `<img src="${photoURL}" alt="">`
                : '<span class="account-avatar-initial" aria-hidden="true"><i class="fas fa-user"></i></span>';
            headerButton.style.display = 'block';
            headerButton.innerHTML = `
                <div class="dashboard-account-control">
                    <button type="button" class="account-trigger" aria-label="Open account menu" aria-expanded="false">
                        ${avatar}
                    </button>
                    <div class="dashboard-account-menu" hidden>
                        <strong></strong>
                        <span></span>
                        <button type="button" class="account-signout">Sign Out</button>
                    </div>
                </div>
            `;

            const trigger = headerButton.querySelector('.account-trigger');
            const menu = headerButton.querySelector('.dashboard-account-menu');
            if (trigger) trigger.title = this.currentUser.displayName || 'Account';
            const accountName = menu?.querySelector('strong');
            const accountEmail = menu?.querySelector('span');
            if (accountName) accountName.textContent = this.currentUser.displayName || 'Indy Schedule account';
            if (accountEmail) accountEmail.textContent = this.currentUser.email || '';
            trigger?.addEventListener('click', (event) => {
                event.stopPropagation();
                const willOpen = menu.hidden;
                if (willOpen && document.getElementById('today-at-indy')?.hidden === false) {
                    document.getElementById('today-card-close')?.click();
                }
                menu.hidden = !willOpen;
                trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });
            headerButton.querySelector('.account-signout')?.addEventListener('click', async (event) => {
                event.stopPropagation();
                const button = event.currentTarget;
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Signing out…';
                await window.authManager.logout();
            });
            if (!headerButton._outsideBound) {
                document.addEventListener('click', (event) => {
                    if (headerButton.contains(event.target)) return;
                    const openMenu = headerButton.querySelector('.dashboard-account-menu');
                    const openTrigger = headerButton.querySelector('.account-trigger');
                    if (openMenu) openMenu.hidden = true;
                    openTrigger?.setAttribute('aria-expanded', 'false');
                });
                headerButton._outsideBound = true;
            }
        } else {
            headerButton.classList.add('is-signed-out');
            headerButton.classList.remove('is-signed-in');
            headerButton.style.display = 'block';
            headerButton.innerHTML = `
                <button type="button" class="account-trigger" aria-label="Open account sign-in"><span class="account-label">Sign In</span></button>
            `;
            headerButton.querySelector('.account-trigger')?.addEventListener('click', () => this.showLoginModal());
        }
        
        // Update sidebar button if it exists
        const sidebarButton = document.getElementById('auth-button');
        if (sidebarButton) {
            if (this.isAuthenticated && this.currentUser) {
                const photoURL = this.currentUser.photoURL || '';
                sidebarButton.innerHTML = `
                    ${photoURL ? `<img src="${photoURL}" alt="Profile" class="profile-pic">` : '<i class="fas fa-user"></i>'}
                    <span>Sign Out</span>
                `;
            } else {
                sidebarButton.innerHTML = `
                    <i class="fas fa-user"></i>
                    <span id="auth-button-text">Sign In</span>
                `;
            }
        }
        const loginModal = document.getElementById('login-modal');
        if (loginModal?.getAttribute('aria-hidden') === 'false' && !loginModal.contains(document.activeElement)) {
            requestAnimationFrame(() => document.getElementById('auth-email')?.focus());
        }
    }

    checkAuthentication() {
        this.currentUser = this.auth.currentUser;
        this.isAuthenticated = !!this.currentUser;
        // Remove auto-show of login modal
        return this.isAuthenticated;
    }

    async logout() {
        try {
            // Call Firebase signOut and wait for completion.
            await this.auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        } finally {
            // Immediately reload to update application state.
            window.location.href = window.location.pathname;
        }
    }

    async forceLogout() {
        try {
            // Clear auth state first
            // Remove only auth/session related keys to avoid wiping user customizations
            localStorage.removeItem('authToken');
            // Keep user's local preferences like periodRenames, custom schedules, gradients, etc.
            this.isAuthenticated = false;
            this.currentUser = null;
            
            // Reset all styles synchronously
            document.body.style.backgroundImage = 'none';
            document.body.style.background = '#000035';
            
            // Sign out of Firebase
            try {
                await this.auth.signOut();
            } catch (e) {
                console.warn('Firebase signOut error:', e);
            }
            
            // Force redirect to home page
            window.location = window.location.pathname;
            
        } catch (error) {
            console.error('Error during force logout:', error);
            // Last resort: hard reload
            window.location.reload(true);
        }
    }

    showLoginModal(options = {}) {
        const modal = document.getElementById('login-modal');
        if (modal) {
            document.getElementById('today-card-close')?.click();
            const requestedMode = options.mode === 'create' ? 'create' : 'signin';
            modal.dataset.onboardingEntry = options.onboarding ? 'true' : 'false';
            modal._setAuthMode?.(requestedMode);
            // Clear any previous errors
            const errorElement = document.getElementById('login-error');
            if (errorElement) {
                errorElement.style.display = 'none';
            }
            
            // Add the 'show' class to trigger the fade-in animation
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            window.IndyDialogManager?.open(modal, {
                trigger: document.activeElement,
                initialFocus: document.getElementById('auth-email'),
                onRequestClose: () => this.hideLoginModal()
            });
            requestAnimationFrame(() => {
                modal.classList.add('show');
                document.getElementById('auth-email')?.focus();
            });
            
            this.initializeAuth();
            
            // Add click outside to close
            const handleClick = (e) => {
                if (e.target === modal) {
                    this.hideLoginModal();
                }
            };
            
            modal.addEventListener('click', handleClick);
            
            // Store event listeners for cleanup
            modal._cleanup = () => {
                modal.removeEventListener('click', handleClick);
            };
        }
    }

    hideLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            window.IndyDialogManager?.close(modal);
            // Clean up event listeners
            if (modal._cleanup) {
                modal._cleanup();
                delete modal._cleanup;
            }
            // Wait for animation to complete before hiding
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300); // Match this with your CSS transition duration
        }
    }

    // Remove or modify handleAuthButton to directly call signIn
    handleAuthButton() {
        if (this.isAuthenticated) {
            this.logout();
        } else {
            this.showLoginModal();
        }
    }
}

// Add window message handler for popup communication
window.addEventListener('message', (event) => {
    if (event.data === 'auth-success') {
        window.location.reload();
    }
});

// Render easter-egg icon once the DOM is available, based on stored flag.
document.addEventListener('DOMContentLoaded', updateToastIcon);
document.addEventListener('DOMContentLoaded', initializeAnalyticsConsentUI);
document.addEventListener('DOMContentLoaded', initializeLocalDataControls);

function applyUserSettingsToLocalStorage(settings = {}) {
    Object.keys(settings).forEach(key => {
        const val = settings[key];
        if (key === 'indyScheduleOverride_v1' && val === null) {
            localStorage.removeItem(key);
            return;
        }
        if (val === null || typeof val === 'undefined') return;
        try {
            if (typeof val === 'object') localStorage.setItem(key, JSON.stringify(val));
            else localStorage.setItem(key, String(val));
        } catch (error) {
            console.warn('Could not mirror setting', key, error);
        }
    });
    updateToastIcon();
    return settings;
}

// Compatibility helper for callers outside AuthManager. AuthManager itself
// coalesces the initial account read through _maybeLoadUserSettings().
async function loadUserSettings() {
    return window.authManager?._maybeLoadUserSettings() || null;
}

function initializeFirebaseAuthManager() {
    if (window.authManager) return window.authManager;
    try {
        if (typeof window.firebase === 'undefined' || typeof window.firebase.auth !== 'function' || typeof window.firebase.firestore !== 'function') {
            return null;
        }
        window.authManager = new AuthManager();
        return window.authManager;
    } catch (error) {
        window.authManager = null;
        console.warn('Firebase did not initialize; Indy Schedule is continuing in guest mode.', error);
        return null;
    }
}

window.authManager = null;
window.addEventListener('indy-firebase-ready', initializeFirebaseAuthManager);
window.addEventListener('indy-auth-unavailable', () => {
    updateSettingsSyncStatus('local');
    console.warn('Firebase did not load; Indy Schedule is continuing in guest mode.');
});
initializeFirebaseAuthManager();
