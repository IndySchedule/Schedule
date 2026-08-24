import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const artifactRoot = join(projectRoot, '.artifacts', 'visual-qa');
const chromeCandidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
].filter(Boolean);

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

const viewports = {
    chromebook: { width: 1366, height: 728, mobile: false },
    tablet: { width: 820, height: 900, mobile: false },
    phone: { width: 390, height: 844, mobile: true }
};

const schoolTimes = {
    beforeSchool: '2026-08-11T07:20:00-05:00',
    duringClass: '2026-08-11T08:00:00-05:00',
    betweenClasses: '2026-08-11T08:31:00-05:00',
    lunch: '2026-08-11T11:50:00-05:00',
    afterSchool: '2026-08-11T15:10:00-05:00',
    noSchool: '2026-09-07T10:00:00-05:00'
};

const scenarios = [
    { name: 'dashboard-before-school', viewport: 'chromebook', time: schoolTimes.beforeSchool, state: 'before-school', heading: 'School Starts Soon' },
    { name: 'dashboard-during-class', viewport: 'chromebook', time: schoolTimes.duringClass, state: 'in-class', heading: 'Period 1' },
    { name: 'dashboard-between-classes', viewport: 'chromebook', time: schoolTimes.betweenClasses, state: 'between-classes', heading: 'Between Classes' },
    { name: 'dashboard-lunch', viewport: 'chromebook', time: schoolTimes.lunch, state: 'in-class', heading: 'Lunch' },
    { name: 'dashboard-after-school', viewport: 'chromebook', time: schoolTimes.afterSchool, state: 'after-school', heading: 'School’s Out!' },
    { name: 'dashboard-no-school', viewport: 'chromebook', time: schoolTimes.noSchool, state: 'no-school', heading: 'Next class:' },
    { name: 'dashboard-phone', viewport: 'phone', time: schoolTimes.duringClass, state: 'in-class', heading: 'Period 1' },
    { name: 'not-found-page', viewport: 'chromebook', time: schoolTimes.duringClass, page: '404.html', action: 'not-found' },
    { name: 'not-found-page-phone', viewport: 'phone', time: schoolTimes.duringClass, page: '404.html', action: 'not-found' },
    { name: 'privacy-page', viewport: 'chromebook', time: schoolTimes.duringClass, page: 'privacy.html', action: 'legal-page', legalTitle: 'Your choices stay under your control.', legalSections: 9 },
    { name: 'privacy-page-phone', viewport: 'phone', time: schoolTimes.duringClass, page: 'privacy.html', action: 'legal-page', legalTitle: 'Your choices stay under your control.', legalSections: 9 },
    { name: 'terms-page', viewport: 'chromebook', time: schoolTimes.duringClass, page: 'terms.html', action: 'legal-page', legalTitle: 'Simple terms for using the service.', legalSections: 8 },
    { name: 'terms-page-phone', viewport: 'phone', time: schoolTimes.duringClass, page: 'terms.html', action: 'legal-page', legalTitle: 'Simple terms for using the service.', legalSections: 8 },
    { name: 'today-at-indy', viewport: 'phone', time: schoolTimes.lunch, action: 'today' },
    { name: 'release-notice', viewport: 'chromebook', time: schoolTimes.duringClass, action: 'release-notice' },
    { name: 'release-notice-daylight', viewport: 'chromebook', time: schoolTimes.duringClass, palette: 'daylight', action: 'release-notice' },
    { name: 'release-notice-phone', viewport: 'phone', time: schoolTimes.duringClass, action: 'release-notice' },
    { name: 'today-at-indy-daylight', viewport: 'chromebook', time: schoolTimes.lunch, palette: 'daylight', action: 'today' },
    { name: 'onboarding-first-step', viewport: 'phone', time: schoolTimes.beforeSchool, onboarding: true },
    { name: 'onboarding-first-step-chromebook', viewport: 'chromebook', time: schoolTimes.beforeSchool, onboarding: true },
    { name: 'onboarding-guest-confirmation', viewport: 'chromebook', time: schoolTimes.beforeSchool, onboarding: true, action: 'onboarding-guest-confirmation' },
    { name: 'onboarding-finish-chromebook', viewport: 'chromebook', time: schoolTimes.beforeSchool, onboarding: true, action: 'onboarding-finish' },
    { name: 'onboarding-create-account', viewport: 'phone', time: schoolTimes.beforeSchool, onboarding: true, action: 'onboarding-create' },
    { name: 'onboarding-account-created', viewport: 'chromebook', time: schoolTimes.beforeSchool, onboarding: true, action: 'onboarding-account-created' },
    { name: 'palette-daylight', viewport: 'chromebook', time: schoolTimes.duringClass, palette: 'daylight', state: 'in-class', heading: 'Period 1' },
    { name: 'palette-dark-mode', viewport: 'chromebook', time: schoolTimes.duringClass, palette: 'dark-mode', state: 'in-class', heading: 'Period 1' },
    { name: 'palette-mango-wave', viewport: 'chromebook', time: schoolTimes.duringClass, palette: 'mango-wave', state: 'in-class', heading: 'Period 1' },
    { name: 'palette-midnight', viewport: 'chromebook', time: schoolTimes.duringClass, palette: 'midnight', state: 'in-class', heading: 'Period 1' },
    { name: 'palette-deep-ocean', viewport: 'chromebook', time: schoolTimes.duringClass, palette: 'deep-ocean', state: 'in-class', heading: 'Period 1' },
    { name: 'palette-forest-night', viewport: 'chromebook', time: schoolTimes.duringClass, palette: 'forest-night', state: 'in-class', heading: 'Period 1' },
    { name: 'edition-friday-night-lights', viewport: 'chromebook', time: schoolTimes.duringClass, edition: 'friday-night-lights', state: 'in-class', heading: 'Period 1' },
    { name: 'edition-historic-franklin', viewport: 'chromebook', time: schoolTimes.duringClass, edition: 'historic-franklin', state: 'in-class', heading: 'Period 1' },
    { name: 'edition-music-city', viewport: 'chromebook', time: schoolTimes.duringClass, edition: 'music-city', state: 'in-class', heading: 'Period 1' },
    { name: 'edition-music-city-phone', viewport: 'phone', time: schoolTimes.duringClass, edition: 'music-city', state: 'in-class', heading: 'Period 1' },
    { name: 'edition-selection-control', viewport: 'chromebook', time: schoolTimes.duringClass, settings: 'appearance', chooseEdition: 'historic-franklin' },
    { name: 'palette-disables-edition', viewport: 'chromebook', time: schoolTimes.duringClass, edition: 'friday-night-lights', settings: 'appearance', resetEdition: true },
    { name: 'account-signed-out', viewport: 'chromebook', time: schoolTimes.duringClass, account: 'signed-out' },
    { name: 'account-signed-in', viewport: 'chromebook', time: schoolTimes.duringClass, account: 'signed-in' },
    { name: 'account-fallback-avatar', viewport: 'chromebook', time: schoolTimes.duringClass, account: 'signed-in-fallback' },
    { name: 'account-over-today', viewport: 'chromebook', time: schoolTimes.duringClass, account: 'signed-in', action: 'today-then-account' },
    { name: 'account-dialog', viewport: 'chromebook', time: schoolTimes.duringClass, action: 'account' },
    { name: 'account-dialog-phone', viewport: 'phone', time: schoolTimes.duringClass, action: 'account' },
    { name: 'auth-unavailable-dashboard', viewport: 'chromebook', time: schoolTimes.duringClass, blockFirebase: true },
    { name: 'onboarding-replay-signed-in', viewport: 'chromebook', time: schoolTimes.beforeSchool, onboardingReplay: true, action: 'replay-signed-in' },
    { name: 'firestore-schedule-sync', viewport: 'chromebook', time: schoolTimes.duringClass, settings: 'schedule', action: 'firestore-sync' },
    { name: 'settings-modal-accessibility', viewport: 'chromebook', time: schoolTimes.duringClass, settings: 'appearance', action: 'settings-a11y' },
    { name: 'settings-appearance-features', viewport: 'chromebook', time: schoolTimes.duringClass, settings: 'appearance', action: 'appearance-features' },
    { name: 'font-local-restoration', viewport: 'chromebook', time: schoolTimes.duringClass, settings: 'appearance', fontFamily: 'Open Sans', expectedFont: "'Open Sans'" },
    { name: 'font-firestore-restoration', viewport: 'chromebook', time: schoolTimes.duringClass, settings: 'appearance', action: 'font-firestore', expectedFont: "'Source Sans Pro'" },
    { name: 'devtools-popup', viewport: 'chromebook', time: schoolTimes.duringClass, action: 'devtools' },
    { name: 'devtools-popup-phone', viewport: 'phone', time: schoolTimes.duringClass, action: 'devtools' },
    { name: 'devtools-sources', viewport: 'chromebook', time: schoolTimes.duringClass, action: 'devtools-sources' },
    { name: 'devtools-sources-phone', viewport: 'phone', time: schoolTimes.duringClass, action: 'devtools-sources' },
    { name: 'settings-schedule-override', viewport: 'chromebook', time: schoolTimes.duringClass, settings: 'schedule', scheduleOverride: 'normalNoSoar' },
    ...['schedule', 'appearance', 'about', 'legal', 'whatsnew', 'contact'].map((panel) => ({
        name: `settings-${panel}`,
        viewport: 'chromebook',
        time: schoolTimes.duringClass,
        settings: panel
    })),
    { name: 'settings-schedule-phone', viewport: 'phone', time: schoolTimes.duringClass, settings: 'schedule' },
    { name: 'settings-appearance-tablet', viewport: 'tablet', time: schoolTimes.duringClass, settings: 'appearance' },
    { name: 'settings-contact-phone', viewport: 'phone', time: schoolTimes.duringClass, settings: 'contact' }
];
const scenarioFilter = (process.env.VISUAL_QA_FILTER || '').trim();
const selectedScenarios = scenarioFilter
    ? scenarios.filter((scenario) => scenario.name.includes(scenarioFilter))
    : scenarios;

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function findChrome() {
    for (const candidate of chromeCandidates) {
        try {
            const info = await stat(candidate);
            if (info.isFile()) return candidate;
        } catch {}
    }
    throw new Error('Chrome or Chromium was not found. Set CHROME_PATH to its executable.');
}

async function startStaticServer() {
    const server = createServer(async (request, response) => {
        try {
            const rawPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            const requestedPath = rawPath === '/' ? '/index.html' : rawPath;
            const filePath = normalize(join(projectRoot, requestedPath));
            if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${sep}`)) {
                response.writeHead(403).end('Forbidden');
                return;
            }
            const body = await readFile(filePath);
            response.writeHead(200, {
                'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
                'Cache-Control': 'no-store'
            });
            response.end(body);
        } catch {
            response.writeHead(404).end('Not found');
        }
    });
    await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
    return { server, port: server.address().port };
}

async function launchChrome(executable) {
    const profileDirectory = await mkdtemp(join(tmpdir(), 'indy-visual-qa-'));
    const chrome = spawn(executable, [
        '--headless=new',
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--hide-scrollbars=false',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=0',
        `--user-data-dir=${profileDirectory}`,
        'about:blank'
    ], { stdio: 'ignore' });

    const portFile = join(profileDirectory, 'DevToolsActivePort');
    let debugPort;
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            debugPort = Number((await readFile(portFile, 'utf8')).split('\n')[0]);
            if (debugPort) break;
        } catch {}
        if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}.`);
        await delay(50);
    }
    if (!debugPort) throw new Error('Chrome did not expose a debugging port.');
    return { chrome, debugPort, profileDirectory };
}

async function stopChrome(browser) {
    const waitForExit = () => new Promise((resolveExit) => {
        if (browser.chrome.exitCode !== null) resolveExit();
        else browser.chrome.once('exit', resolveExit);
    });
    const gracefulExit = waitForExit();
    browser.chrome.kill('SIGTERM');
    await Promise.race([gracefulExit, delay(3000)]);
    if (browser.chrome.exitCode === null) {
        const forcedExit = waitForExit();
        browser.chrome.kill('SIGKILL');
        await Promise.race([forcedExit, delay(1000)]);
    }
    await rm(browser.profileDirectory, { recursive: true, force: true });
}

class CdpPage {
    constructor(socket, debugPort, targetId) {
        this.socket = socket;
        this.debugPort = debugPort;
        this.targetId = targetId;
        this.nextId = 0;
        this.pending = new Map();
        socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (!message.id || !this.pending.has(message.id)) return;
            const pending = this.pending.get(message.id);
            this.pending.delete(message.id);
            if (message.error) pending.reject(new Error(message.error.message));
            else pending.resolve(message.result);
        });
    }

    send(method, params = {}) {
        return new Promise((resolveSend, rejectSend) => {
            const id = ++this.nextId;
            this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true
        });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
        return result.result.value;
    }

    async close() {
        this.socket.close();
        try {
            await fetch(`http://127.0.0.1:${this.debugPort}/json/close/${this.targetId}`);
        } catch {}
    }
}

async function createPage(debugPort) {
    const target = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json());
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveOpen, rejectOpen) => {
        socket.addEventListener('open', resolveOpen, { once: true });
        socket.addEventListener('error', rejectOpen, { once: true });
    });
    return new CdpPage(socket, debugPort, target.id);
}

function initializationScript(scenario) {
    const settings = scenario.edition ? {
        paletteId: `edition-${scenario.edition}`,
        paletteName: scenario.edition,
        editionId: scenario.edition
    } : scenario.palette ? {
        paletteId: scenario.palette,
        paletteName: scenario.palette,
        angle: 120
    } : null;
    return `
        (() => {
            localStorage.clear();
            const NativeDate = Date;
            const fixedEpoch = new NativeDate(${JSON.stringify(scenario.time)}).getTime();
            class FixedDate extends NativeDate {
                constructor(...args) { super(...(args.length ? args : [fixedEpoch])); }
                static now() { return fixedEpoch; }
            }
            FixedDate.parse = NativeDate.parse;
            FixedDate.UTC = NativeDate.UTC;
            window.Date = FixedDate;
            localStorage.setItem('showPeriodTimes', 'true');
            localStorage.setItem('progressBarEnabled', 'true');
            ${scenario.action === 'release-notice'
                ? "localStorage.removeItem('indyReleaseNotice_v1_3_2');"
                : "localStorage.setItem('indyReleaseNotice_v1_3_2', 'true');"}
            ${scenario.onboarding
                ? "localStorage.removeItem('lunchWave'); localStorage.removeItem('indyAnalyticsConsent_v1'); localStorage.removeItem('indyOnboardingComplete_v2');"
                : "localStorage.setItem('lunchWave', 'A'); localStorage.setItem('indyAnalyticsConsent_v1', 'denied'); localStorage.setItem('indyOnboardingComplete_v2', 'true');"}
            ${scenario.onboardingReplay
                ? "localStorage.setItem('lunchWave', 'A'); localStorage.setItem('indyAnalyticsConsent_v1', 'denied'); localStorage.removeItem('indyOnboardingComplete_v2'); localStorage.setItem('indyOnboardingReplayRequested_v1', 'true');"
                : "localStorage.removeItem('indyOnboardingReplayRequested_v1');"}
            ${settings ? `localStorage.setItem('gradientSettings', ${JSON.stringify(JSON.stringify(settings))});` : "localStorage.removeItem('gradientSettings');"}
            ${scenario.fontFamily ? `localStorage.setItem('fontFamily', ${JSON.stringify(scenario.fontFamily)});` : "localStorage.removeItem('fontFamily');"}
        })();
    `;
}

async function waitForReady(page, scenario) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        const readySelector = scenario.action === 'not-found'
            ? '.not-found-shell'
            : scenario.action === 'legal-page'
                ? '.legal-document'
                : '.dashboard-shell';
        const ready = await page.evaluate(`document.readyState === 'complete' && Boolean(document.querySelector(${JSON.stringify(readySelector)}))`);
        if (ready) {
            await page.evaluate(`document.fonts?.ready || Promise.resolve()`);
            await delay(350);
            return;
        }
        await delay(100);
    }
    throw new Error('Page did not finish loading.');
}

async function waitForAuthManager(page) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (await page.evaluate(`Boolean(window.authManager)`)) return;
        await delay(100);
    }
    throw new Error('Optional Firebase account services did not initialize for an auth-dependent scenario.');
}

async function prepareScenario(page, scenario) {
    const needsAuth = scenario.account
        || ['account', 'onboarding-create', 'replay-signed-in', 'firestore-sync'].includes(scenario.action);
    if (needsAuth && !scenario.blockFirebase) await waitForAuthManager(page);
    if (scenario.settings) {
        await page.evaluate(`
            document.getElementById('settings-button')?.click();
            document.querySelector('.nav-item[data-target=${JSON.stringify(scenario.settings)}]')?.click();
        `);
        await delay(300);
    }
    if (scenario.scheduleOverride) {
        await page.evaluate(`
            (() => {
                const dropdown = document.getElementById('schedule-dropdown');
                if (!dropdown) return;
                dropdown.value = ${JSON.stringify(scenario.scheduleOverride)};
                dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                updateCountdowns();
            })()
        `);
        await delay(1250);
    }
    if (scenario.resetEdition) {
        await page.evaluate(`document.querySelector('.palette-option[data-palette="indy"]')?.click()`);
        await delay(200);
    }
    if (scenario.chooseEdition) {
        await page.evaluate(`document.querySelector('.edition-option[data-edition=${JSON.stringify(scenario.chooseEdition)}]')?.click()`);
        await delay(200);
    }
    if (scenario.action === 'today' || scenario.action === 'today-then-account') {
        await page.evaluate(`document.getElementById('today-toggle')?.click()`);
        await delay(250);
    }
    if (scenario.action === 'release-notice') await delay(600);
    if (scenario.action === 'account') {
        await page.evaluate(`document.querySelector('#sign-in-button .account-trigger')?.click()`);
        await delay(250);
    }
    if (scenario.action === 'onboarding-create') {
        await page.evaluate(`document.getElementById('onboarding-create-account')?.click()`);
        await delay(250);
    }
    if (scenario.action === 'onboarding-finish') {
        await page.evaluate(`
            document.getElementById('onboarding-use-guest')?.click();
            document.getElementById('onboarding-guest-confirm')?.click();
            document.getElementById('onboarding-next')?.click();
            document.querySelector('input[name="onboarding-lunch"][value="A"]')?.click();
            document.getElementById('onboarding-next')?.click();
            document.getElementById('onboarding-analytics-decline')?.click();
        `);
        await delay(250);
    }
    if (scenario.action === 'onboarding-guest-confirmation') {
        await page.evaluate(`document.getElementById('onboarding-use-guest')?.click()`);
        await delay(250);
    }
    if (scenario.action === 'onboarding-account-created') {
        await page.evaluate(`window.dispatchEvent(new CustomEvent('indy-account-authenticated', { detail: { mode: 'create' } }))`);
        await delay(250);
    }
    if (scenario.action === 'replay-signed-in') {
        await page.evaluate(`
            (() => {
                window.authManager.currentUser = { uid: 'replay-user', displayName: 'Indy Student', email: 'student@example.com' };
                window.authManager.isAuthenticated = true;
                window.dispatchEvent(new CustomEvent('indy-account-authenticated', { detail: { source: 'saved-session' } }));
            })()
        `);
        await delay(250);
    }
    if (scenario.action === 'firestore-sync') {
        await page.evaluate(`
            (async () => {
                window.__firestoreWrites = [];
                window.__firestoreReads = 0;
                window.authManager.currentUser = { uid: 'sync-user' };
                window.authManager.isAuthenticated = true;
                firebase.firestore = () => ({
                    collection: () => ({
                        doc: () => ({
                            get: async () => {
                                window.__firestoreReads += 1;
                                return { exists: true, data: () => ({ settings: { lunchWave: 'A' } }) };
                            },
                            set: async (payload) => { window.__firestoreWrites.push(JSON.parse(JSON.stringify(payload))); }
                        })
                    })
                });
                window.authManager._settingsLoadPromise = null;
                window.authManager._settingsLoadUserId = null;
                await Promise.all([
                    window.authManager._maybeLoadUserSettings(),
                    window.authManager._maybeLoadUserSettings()
                ]);
                const dropdown = document.getElementById('schedule-dropdown');
                dropdown.value = 'normalNoSoar';
                dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                saveSettings();
                saveSettings();
            })()
        `);
        await delay(700);
        await page.evaluate(`
            (() => {
                const dropdown = document.getElementById('schedule-dropdown');
                dropdown.value = 'automatic';
                dropdown.dispatchEvent(new Event('change', { bubbles: true }));
            })()
        `);
        await delay(700);
    }
    if (scenario.action === 'appearance-features') {
        await page.evaluate(`
            (async () => {
                const manager = window.gradientManager;
                const originalPalette = manager.paletteId;
                manager.selectPalette('midnight');
                document.getElementById('palette-undo-button')?.click();
                const undoRestored = manager.paletteId === originalPalette;
                manager.deviceAppearanceQuery = { matches: true };
                manager.setFollowDeviceAppearance(true);
                const deviceDarkApplied = manager.paletteId === 'dark-mode'
                    && JSON.parse(localStorage.getItem('gradientSettings')).appearanceMode === 'device';
                manager.selectPalette('custom');
                ['gradient-start-color', 'gradient-end-color', 'palette-accent-color', 'palette-surface-color'].forEach((id) => {
                    const input = document.getElementById(id);
                    input.value = '#ffffff';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                });
                window.__appearanceFeatureResults = {
                    undoRestored,
                    deviceDarkApplied,
                    manualAfterSelection: manager.appearanceMode === 'manual'
                };
                document.getElementById('gradient-settings')?.scrollIntoView({ block: 'center' });
                try {
                    await Promise.race([
                        navigator.serviceWorker.ready.then(() => { window.__pwaReady = true; }),
                        new Promise((resolve) => setTimeout(resolve, 2500))
                    ]);
                } catch {}
            })()
        `);
        await delay(300);
    }
    if (scenario.action === 'font-firestore') {
        await page.evaluate(`loadSettings({ fontFamily: 'Source Sans 3' })`);
        await delay(200);
    }
    if (scenario.action === 'devtools' || scenario.action === 'devtools-sources') {
        await page.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, shiftKey: true }))`);
        await delay(250);
    }
    if (scenario.action === 'devtools-sources') {
        await page.evaluate(`document.getElementById('devtools-tab-sources')?.click()`);
        await delay(500);
        await page.evaluate(`document.querySelector('.devtools-source-file[title="script.js"]')?.click()`);
        await delay(500);
    }
    if (scenario.account === 'signed-in' || scenario.account === 'signed-in-fallback') {
        await page.evaluate(`
            (() => {
                if (!window.authManager) return;
                window.authManager.isAuthenticated = true;
                window.authManager.currentUser = {
                    displayName: 'Indy Student',
                    email: 'student@example.com',
                    photoURL: ${'`'}${scenario.account === 'signed-in-fallback' ? '' : 'indy_schedule_logo_sizes/indy-schedule-logo-48x48.png'}${'`'}
                };
                window.authManager.updateUI();
                document.querySelector('#sign-in-button .account-trigger')?.click();
            })()
        `);
        await delay(200);
    }
}

async function inspectScenario(page, scenario) {
    return page.evaluate(`
        (() => {
            const visible = (element) => {
                if (!element) return false;
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
            };
            const accessibleName = (element) => {
                const labelledBy = element.getAttribute('aria-labelledby');
                const labelledText = labelledBy ? labelledBy.split(/\\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ') : '';
                const label = element.id ? document.querySelector('label[for="' + CSS.escape(element.id) + '"]')?.textContent : '';
                return element.getAttribute('aria-label') || labelledText || label || element.getAttribute('title') || element.getAttribute('alt') || element.textContent || element.value || '';
            };
            const unnamedControls = [...document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea')]
                .filter(visible)
                .filter((element) => !accessibleName(element).trim())
                .map((element) => element.id || element.className || element.tagName);
            const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
            const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
            const imagesWithoutAlt = [...document.images].filter((image) => !image.hasAttribute('alt')).map((image) => image.src);
            const sidebar = document.getElementById('settings-sidebar');
            const panels = sidebar?.querySelector('.settings-panels');
            const activePanel = sidebar?.querySelector('.settings-panel.active');
            const activeRect = activePanel?.getBoundingClientRect();
            const panelsRect = panels?.getBoundingClientRect();
            const today = document.getElementById('today-at-indy');
            const todayRect = today?.getBoundingClientRect();
            const onboarding = document.getElementById('update-notice-backdrop');
            const onboardingDialog = onboarding?.querySelector('.onboarding-dialog');
            const onboardingRect = onboardingDialog?.getBoundingClientRect();
            const activeOnboardingStep = onboarding?.querySelector('.onboarding-step.active');
            const activeOnboardingStepRect = activeOnboardingStep?.getBoundingClientRect();
            const onboardingStepChildren = activeOnboardingStep ? [...activeOnboardingStep.children].filter(visible) : [];
            const firstOnboardingChildRect = onboardingStepChildren[0]?.getBoundingClientRect();
            const lastOnboardingChildRect = onboardingStepChildren.at(-1)?.getBoundingClientRect();
            const accountDialog = document.querySelector('#login-modal .login-container');
            const accountDialogRect = accountDialog?.getBoundingClientRect();
            const accountMenu = document.querySelector('.dashboard-account-menu');
            const signOutAction = accountMenu?.querySelector('.account-signout');
            const signOutRect = signOutAction?.getBoundingClientRect();
            const signOutTopElement = signOutRect ? document.elementFromPoint(signOutRect.left + signOutRect.width / 2, signOutRect.top + signOutRect.height / 2) : null;
            const fallbackAvatar = document.querySelector('.account-avatar-initial');
            const fallbackAvatarRect = fallbackAvatar?.getBoundingClientRect();
            const devtools = document.getElementById('devtools-debug-overlay');
            const devtoolsRect = devtools?.getBoundingClientRect();
            const devtoolsTitleRect = document.getElementById('devtools-title')?.getBoundingClientRect();
            const devtoolsTabsRect = document.querySelector('.devtools-tabs')?.getBoundingClientRect();
            const notFoundShell = document.querySelector('.not-found-shell');
            const notFoundRect = notFoundShell?.getBoundingClientRect();
            const legalHero = document.querySelector('.legal-hero');
            const legalHeroRect = legalHero?.getBoundingClientRect();
            const legalDocument = document.querySelector('.legal-document');
            const legalDocumentRect = legalDocument?.getBoundingClientRect();
            const releaseNotice = document.getElementById('release-notice-backdrop');
            const releaseNoticeDialog = releaseNotice?.querySelector('.release-notice-dialog');
            const releaseNoticeRect = releaseNoticeDialog?.getBoundingClientRect();
            return {
                viewport: { width: innerWidth, height: innerHeight },
                horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                heroState: document.querySelector('.current-period')?.dataset.state || '',
                heading: document.getElementById('countdown-heading')?.textContent?.trim() || '',
                activePalette: document.documentElement.dataset.palette || '',
                activeEdition: document.documentElement.dataset.edition || '',
                settingsOpen: Boolean(sidebar?.classList.contains('open')),
                activeSettingsPanel: activePanel?.id || '',
                activePanelContained: !activeRect || !panelsRect || (activeRect.left >= panelsRect.left - 1 && activeRect.right <= panelsRect.right + 1),
                todayOpen: Boolean(today && !today.hidden),
                todayContained: !todayRect || (todayRect.left >= -1 && todayRect.right <= innerWidth + 1 && todayRect.top >= -1 && todayRect.bottom <= innerHeight + 1),
                onboardingOpen: Boolean(onboarding && onboarding.getAttribute('aria-hidden') === 'false' && getComputedStyle(onboarding).display !== 'none'),
                onboardingContained: !onboardingRect || (onboardingRect.left >= -1 && onboardingRect.right <= innerWidth + 1),
                onboardingVerticalBalance: activeOnboardingStepRect && firstOnboardingChildRect && lastOnboardingChildRect
                    ? Math.abs((firstOnboardingChildRect.top - activeOnboardingStepRect.top) - (activeOnboardingStepRect.bottom - lastOnboardingChildRect.bottom))
                    : null,
                managedChromebookReminderVisible: visible([...document.querySelectorAll('.onboarding-ready-card strong')].find((element) => element.textContent.includes('School Chromebook reminder'))),
                guestConfirmationVisible: visible(document.getElementById('onboarding-guest-confirmation')),
                accountCreatedNoticeVisible: visible(document.getElementById('onboarding-account-created')),
                accountDialogOpen: Boolean(accountDialog && visible(accountDialog)),
                accountDialogContained: !accountDialogRect || (accountDialogRect.left >= -1 && accountDialogRect.right <= innerWidth + 1 && accountDialogRect.top >= -1 && accountDialogRect.bottom <= innerHeight + 1),
                accountFocusContained: Boolean(document.getElementById('login-modal')?.contains(document.activeElement)),
                activeAuthMode: document.querySelector('.auth-mode-button.active')?.dataset.authMode || '',
                forgotPasswordVisible: visible(document.getElementById('forgot-password')),
                accountState: document.getElementById('sign-in-button')?.className || '',
                accountMenuOpen: !document.querySelector('.dashboard-account-menu')?.hidden,
                signOutVisible: visible(signOutAction),
                signOutReachable: Boolean(signOutAction && (signOutTopElement === signOutAction || signOutAction.contains(signOutTopElement))),
                fallbackAvatarSize: fallbackAvatarRect ? { width: fallbackAvatarRect.width, height: fallbackAvatarRect.height } : null,
                scheduleOverride: localStorage.getItem('indyScheduleOverride_v1') || '',
                scheduleDropdownValue: document.getElementById('schedule-dropdown')?.value || '',
                scheduleMode: document.getElementById('schedule-mode-pill')?.dataset.mode || '',
                scheduleSummary: document.getElementById('schedule-day-summary')?.textContent?.trim() || '',
                duplicateIds,
                unnamedControls,
                imagesWithoutAlt,
                activeOnboardingStep: Number(document.querySelector('.onboarding-step.active')?.dataset.step ?? -1),
                onboardingFocusContained: Boolean(onboarding?.contains(document.activeElement)),
                releaseNoticeOpen: Boolean(releaseNotice && !releaseNotice.hidden && releaseNotice.getAttribute('aria-hidden') === 'false'),
                releaseNoticeContained: !releaseNoticeRect || (releaseNoticeRect.left >= -1 && releaseNoticeRect.right <= innerWidth + 1 && releaseNoticeRect.top >= -1 && releaseNoticeRect.bottom <= innerHeight + 1),
                releaseNoticeFocusContained: Boolean(releaseNotice?.contains(document.activeElement)),
                releaseNoticeTitle: document.getElementById('release-notice-title')?.textContent?.trim() || '',
                releaseNoticeSummaryCount: document.querySelectorAll('.release-notice-summary article').length,
                backgroundInert: Boolean(document.querySelector('.container')?.inert),
                firebaseAvailable: Boolean(window.authManager),
                countdownInitialized: Boolean(document.getElementById('countdown-heading')?.textContent?.trim()),
                firestoreWrites: window.__firestoreWrites || [],
                firestoreReads: window.__firestoreReads || 0,
                settingsFocusContained: Boolean(sidebar?.contains(document.activeElement)),
                dashboardInertWhileSettingsOpen: Boolean(document.querySelector('.container')?.inert),
                visiblePaletteCount: [...document.querySelectorAll('.palette-option')].filter(visible).length,
                totalPaletteCount: document.querySelectorAll('.palette-option').length,
                inactiveEditionAssetsLoaded: [...document.querySelectorAll('img[data-edition-src]')].some((image) => image.hasAttribute('src')),
                fontDropdownValue: document.getElementById('font-family')?.value || '',
                storedFontFamily: localStorage.getItem('fontFamily') || '',
                interfaceFontToken: document.documentElement.style.getPropertyValue('--interface-font-family'),
                bodyFontFamily: getComputedStyle(document.body).fontFamily,
                settingsFontFamily: sidebar ? getComputedStyle(sidebar).fontFamily : '',
                sourceSansLoaded: Boolean(document.getElementById('indy-font-source-sans-3')),
                appearanceFeatures: window.__appearanceFeatureResults || null,
                customContrastState: document.getElementById('custom-contrast-status')?.dataset.state || '',
                paletteUndoVisible: visible(document.getElementById('palette-undo-notice')),
                pwaReady: Boolean(window.__pwaReady),
                devtoolsOpen: visible(devtools),
                devtoolsContained: !devtoolsRect || (devtoolsRect.left >= -1 && devtoolsRect.right <= innerWidth + 1 && devtoolsRect.top >= -1 && devtoolsRect.bottom <= innerHeight + 1),
                devtoolsDialogRole: devtools?.getAttribute('role') || '',
                devtoolsFocusContained: Boolean(document.getElementById('devtools-layer')?.contains(document.activeElement)),
                devtoolsBackgroundInert: Boolean(document.querySelector('.container')?.inert),
                devtoolsStorageGrid: devtools ? getComputedStyle(document.getElementById('devtools-debug-content')).display : '',
                devtoolsSearchVisible: visible(document.querySelector('.devtools-storage-toolbar input')),
                devtoolsTitleVisible: visible(document.getElementById('devtools-title')),
                devtoolsTabsVisible: visible(document.querySelector('.devtools-tabs')),
                devtoolsTitleRect: devtoolsTitleRect ? { left: devtoolsTitleRect.left, top: devtoolsTitleRect.top, right: devtoolsTitleRect.right, bottom: devtoolsTitleRect.bottom } : null,
                devtoolsTabsRect: devtoolsTabsRect ? { left: devtoolsTabsRect.left, top: devtoolsTabsRect.top, right: devtoolsTabsRect.right, bottom: devtoolsTabsRect.bottom } : null,
                devtoolsScheduleActionCount: [...document.querySelectorAll('.devtools-action-group button')].filter((button) => button.textContent === 'Next Schedule').length,
                devtoolsInternalSettingHidden: ![...document.querySelectorAll('.devtools-key-cell')].some((cell) => cell.textContent === 'devtoolsOverlayPlacement'),
                devtoolsSourcesVisible: visible(document.getElementById('devtools-sources-content')),
                devtoolsActiveSource: document.querySelector('.devtools-source-file.is-active')?.textContent || '',
                devtoolsSourceLineCount: document.querySelectorAll('.devtools-source-line').length,
                devtoolsSourceFileCount: document.querySelectorAll('.devtools-source-file').length,
                devtoolsScrollbarWidth: devtools ? getComputedStyle(document.querySelector('.devtools-source-code'), '::-webkit-scrollbar').width : '',
                notFoundVisible: visible(notFoundShell),
                notFoundContained: !notFoundRect || (notFoundRect.left >= -1 && notFoundRect.right <= innerWidth + 1),
                notFoundTitle: document.getElementById('not-found-title')?.textContent || '',
                notFoundPath: document.getElementById('requested-path')?.textContent || '',
                notFoundHelpCount: document.querySelectorAll('.help-list li').length,
                legalHeroVisible: visible(legalHero),
                legalHeroContained: !legalHeroRect || (legalHeroRect.left >= -1 && legalHeroRect.right <= innerWidth + 1),
                legalDocumentContained: !legalDocumentRect || (legalDocumentRect.left >= -1 && legalDocumentRect.right <= innerWidth + 1),
                legalTitle: document.getElementById('page-title')?.textContent || '',
                legalSectionCount: document.querySelectorAll('.legal-section').length,
                legalTocCount: document.querySelectorAll('.table-of-contents a').length,
                legalCurrentDocument: document.querySelector('.document-switcher [aria-current="page"]')?.textContent || ''
            };
        })()
    `);
}

function validateScenario(scenario, result) {
    const failures = [];
    const check = (condition, message) => { if (!condition) failures.push(message); };
    check(result.horizontalOverflow <= 0, `horizontal overflow is ${result.horizontalOverflow}px`);
    check(result.duplicateIds.length === 0, `duplicate IDs: ${result.duplicateIds.join(', ')}`);
    check(result.unnamedControls.length === 0, `unnamed visible controls: ${result.unnamedControls.join(', ')}`);
    check(result.imagesWithoutAlt.length === 0, `images without alt attributes: ${result.imagesWithoutAlt.join(', ')}`);
    if (scenario.state) check(result.heroState === scenario.state, `expected state ${scenario.state}, received ${result.heroState}`);
    if (scenario.heading) check(result.heading.includes(scenario.heading), `expected heading containing “${scenario.heading}”, received “${result.heading}”`);
    if (scenario.palette) check(result.activePalette === scenario.palette, `expected palette ${scenario.palette}, received ${result.activePalette}`);
    if (scenario.edition && !scenario.resetEdition) check(result.activeEdition === scenario.edition, `expected edition ${scenario.edition}, received ${result.activeEdition}`);
    if (scenario.chooseEdition) check(result.activeEdition === scenario.chooseEdition, `edition control did not activate ${scenario.chooseEdition}`);
    if (scenario.resetEdition) {
        check(result.activeEdition === '', `palette selection did not disable edition ${result.activeEdition}`);
        check(result.activePalette === 'indy', `expected restored Indy palette, received ${result.activePalette}`);
    }
    if (scenario.settings) {
        check(result.settingsOpen, 'Settings did not open');
        check(result.activeSettingsPanel === `${scenario.settings}-panel`, `wrong Settings panel: ${result.activeSettingsPanel}`);
        check(result.activePanelContained, 'active Settings panel is clipped horizontally');
    }
    if (scenario.scheduleOverride) {
        let savedOverride = null;
        try { savedOverride = JSON.parse(result.scheduleOverride); } catch {}
        check(savedOverride?.date === '2026-08-11', `override date was not saved for today: ${result.scheduleOverride}`);
        check(savedOverride?.schedule === scenario.scheduleOverride, `wrong saved override: ${result.scheduleOverride}`);
        check(result.scheduleDropdownValue === scenario.scheduleOverride, `override reset after countdown refresh: ${result.scheduleDropdownValue}`);
        check(result.scheduleMode === 'override', `override pill did not activate: ${result.scheduleMode}`);
        check(result.scheduleSummary.includes('No SOAR') && result.scheduleSummary.includes('Override'),
            `schedule summary did not identify the override: ${result.scheduleSummary}`);
    }
    if (scenario.expectedFont) {
        check(result.fontDropdownValue === scenario.expectedFont, `font dropdown did not restore ${scenario.expectedFont}: ${result.fontDropdownValue}`);
        check(result.storedFontFamily === scenario.expectedFont, `font preference was not normalized: ${result.storedFontFamily}`);
        const expectedCssFamily = scenario.expectedFont === "'Source Sans Pro'" ? 'Source Sans 3' : scenario.expectedFont.replaceAll("'", '');
        check(result.interfaceFontToken.includes(expectedCssFamily), `font token does not apply ${expectedCssFamily}: ${result.interfaceFontToken}`);
        check(result.bodyFontFamily.includes(expectedCssFamily), `dashboard does not use ${expectedCssFamily}: ${result.bodyFontFamily}`);
        check(result.settingsFontFamily.includes(expectedCssFamily), `Settings does not use ${expectedCssFamily}: ${result.settingsFontFamily}`);
        if (scenario.action === 'font-firestore') check(result.sourceSansLoaded, 'Source Sans 3 stylesheet was not loaded on demand');
    }
    if (scenario.action === 'devtools' || scenario.action === 'devtools-sources') {
        check(result.devtoolsOpen, 'developer tools did not open');
        check(result.devtoolsContained, 'developer tools is outside the viewport');
        check(result.devtoolsDialogRole === 'dialog', `developer tools role is ${result.devtoolsDialogRole || 'missing'}`);
        check(result.devtoolsFocusContained && result.devtoolsBackgroundInert, 'developer tools did not contain focus and isolate the dashboard');
        check(result.devtoolsTitleVisible && result.devtoolsTabsVisible, 'developer-tools title or tabs are not visible');
        check(result.devtoolsScheduleActionCount === 1, `schedule action appears ${result.devtoolsScheduleActionCount} times`);
        check(result.devtoolsInternalSettingHidden, 'internal developer-tools settings are visible by default');
    }
    if (scenario.action === 'devtools') {
        check(result.devtoolsStorageGrid === 'grid', `saved-settings layout is ${result.devtoolsStorageGrid}`);
        check(result.devtoolsSearchVisible, 'saved-settings search is not visible');
    }
    if (scenario.action === 'devtools-sources') {
        check(result.devtoolsSourcesVisible, 'Sources panel is not visible');
        check(result.devtoolsOpen, 'developer tools closed after selecting a source file');
        check(result.devtoolsActiveSource === 'script.js', `expected script.js after file selection, received ${result.devtoolsActiveSource || 'no file'}`);
        check(result.devtoolsSourceLineCount > 100, `source viewer rendered only ${result.devtoolsSourceLineCount} lines`);
        check(result.devtoolsSourceFileCount >= 15, `source tree contains only ${result.devtoolsSourceFileCount} files`);
        check(result.devtoolsScrollbarWidth === '8px', `source scrollbar width is ${result.devtoolsScrollbarWidth || 'unknown'}`);
    }
    if (scenario.action === 'not-found') {
        check(result.notFoundVisible, '404 recovery card is not visible');
        check(result.notFoundContained, '404 recovery card is clipped horizontally');
        check(result.notFoundTitle === 'We couldn’t find that page.', `unexpected 404 title: ${result.notFoundTitle}`);
        check(result.notFoundPath.includes('404.html'), `requested address is missing: ${result.notFoundPath}`);
        check(result.notFoundHelpCount === 3, `expected three recovery tips, received ${result.notFoundHelpCount}`);
    }
    if (scenario.action === 'legal-page') {
        check(result.legalHeroVisible, 'legal-page hero is not visible');
        check(result.legalHeroContained && result.legalDocumentContained, 'legal-page content is clipped horizontally');
        check(result.legalTitle === scenario.legalTitle, `unexpected legal-page title: ${result.legalTitle}`);
        check(result.legalSectionCount === scenario.legalSections, `expected ${scenario.legalSections} legal sections, received ${result.legalSectionCount}`);
        check(result.legalTocCount === scenario.legalSections, `table of contents has ${result.legalTocCount} links`);
        check(Boolean(result.legalCurrentDocument), 'current legal document is not identified');
    }
    if (scenario.action === 'today') {
        check(result.todayOpen, 'Today at Indy did not open');
        check(result.todayContained, 'Today at Indy is clipped outside the viewport');
    }
    if (scenario.action === 'release-notice') {
        check(result.releaseNoticeOpen, 'release notice did not open');
        check(result.releaseNoticeContained, 'release notice is clipped outside the viewport');
        check(result.releaseNoticeFocusContained && result.backgroundInert, 'release notice did not contain focus and inert the dashboard');
        check(result.releaseNoticeTitle === 'Your schedule, ready anywhere.', `unexpected release-notice title: ${result.releaseNoticeTitle}`);
        check(result.releaseNoticeSummaryCount === 1, `expected one release summary, received ${result.releaseNoticeSummaryCount}`);
    }
    if (scenario.action === 'account') {
        check(result.accountDialogOpen, 'account dialog did not open');
        check(result.accountDialogContained, 'account dialog is clipped outside the viewport');
        check(result.accountFocusContained && result.backgroundInert, 'account dialog did not contain focus and inert the dashboard');
    }
    if (scenario.blockFirebase) {
        check(!result.firebaseAvailable, 'Firebase unexpectedly initialized in the blocked-CDN scenario');
        check(result.countdownInitialized, 'dashboard did not initialize without Firebase');
        check(!result.inactiveEditionAssetsLoaded, 'inactive edition artwork loaded eagerly');
    }
    if (scenario.action === 'replay-signed-in') {
        check(result.onboardingOpen, 'replayed onboarding closed for the signed-in user');
        check(result.activeOnboardingStep === 1, `signed-in replay did not bypass the account step: ${result.activeOnboardingStep}`);
        check(!result.accountDialogOpen, 'signed-in replay opened the account dialog');
    }
    if (scenario.action === 'firestore-sync') {
        check(result.firestoreReads === 1, `expected one coalesced Firestore read, received ${result.firestoreReads}`);
        check(result.firestoreWrites.length === 2, `expected two debounced Firestore writes, received ${result.firestoreWrites.length}`);
        check(result.firestoreWrites[0]?.settings?.indyScheduleOverride_v1?.schedule === 'normalNoSoar', 'manual override was not written to Firestore');
        check(result.firestoreWrites[1]?.settings?.indyScheduleOverride_v1 === null, 'Automatic mode did not clear the Firestore override');
        check(result.firestoreWrites.every((write) => write?.settings?.indyReleaseNotice_v1_3_2 === 'true'), 'release-notice dismissal was not included in Firestore settings');
    }
    if (scenario.action === 'settings-a11y') {
        check(result.settingsFocusContained, 'keyboard focus did not enter the Settings dialog');
        check(result.dashboardInertWhileSettingsOpen, 'dashboard was not inert while Settings was modal');
        check(result.visiblePaletteCount === result.totalPaletteCount, 'the curated palette collection is not fully visible');
    }
    if (scenario.action === 'appearance-features') {
        check(result.appearanceFeatures?.undoRestored, 'palette Undo did not restore the previous selection');
        check(result.appearanceFeatures?.deviceDarkApplied, 'device appearance did not apply and persist Dark Mode');
        check(result.appearanceFeatures?.manualAfterSelection, 'a direct palette choice did not leave device appearance mode');
        check(result.customContrastState === 'adjusted', `custom contrast guidance is ${result.customContrastState || 'missing'}`);
        check(result.paletteUndoVisible, 'custom palette edit did not expose Undo');
        check(result.pwaReady, 'offline service worker did not become ready');
    }
    if (scenario.action === 'onboarding-create') {
        check(result.accountDialogOpen, 'create-account dialog did not open');
        check(result.accountDialogContained, 'create-account dialog is clipped outside the viewport');
        check(result.activeAuthMode === 'create', `expected create-account mode, received ${result.activeAuthMode}`);
        check(!result.forgotPasswordVisible, 'password-reset action should be hidden while creating an account');
        check(result.accountFocusContained && result.backgroundInert, 'create-account dialog did not contain focus and inert the dashboard');
    }
    if (scenario.action === 'onboarding-finish') check(result.managedChromebookReminderVisible, 'managed Chromebook sign-in reminder is not visible on the final walkthrough step');
    if (scenario.action === 'onboarding-guest-confirmation') check(result.guestConfirmationVisible, 'guest confirmation dialog did not open');
    if (scenario.action === 'onboarding-account-created') check(result.accountCreatedNoticeVisible, 'post-signup password recommendation did not open');
    if (scenario.onboarding) {
        check(result.onboardingOpen, 'onboarding did not open');
        check(result.onboardingContained, 'onboarding is clipped horizontally');
        if (!result.accountDialogOpen) check(result.onboardingFocusContained && result.backgroundInert, 'onboarding did not contain focus and inert the dashboard');
    }
    if (scenario.name === 'onboarding-first-step-chromebook') check(result.onboardingVerticalBalance !== null && result.onboardingVerticalBalance <= 40, `welcome content is not vertically centered (${result.onboardingVerticalBalance}px imbalance)`);
    if (scenario.account === 'signed-out') check(result.accountState.includes('is-signed-out'), 'signed-out account state is missing');
    if (scenario.account === 'signed-in' || scenario.account === 'signed-in-fallback') {
        check(result.accountState.includes('is-signed-in'), 'signed-in account state is missing');
        check(result.accountMenuOpen, 'signed-in account menu did not open');
        check(result.signOutVisible, 'sign-out action is not visible');
        check(result.signOutReachable, 'sign-out action is covered by another dashboard layer');
    }
    if (scenario.account === 'signed-in-fallback') {
        check(result.fallbackAvatarSize && result.fallbackAvatarSize.width <= 28 && result.fallbackAvatarSize.height <= 28, 'fallback avatar is oversized');
    }
    if (scenario.action === 'today-then-account') check(!result.todayOpen, 'Today at Indy stayed open over the account menu');
    return failures;
}

async function runKeyboardAndMotionChecks(page) {
    await page.evaluate(`document.body.focus()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    const focused = await page.evaluate(`document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement`);
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const reducedMotion = await page.evaluate(`
        (() => {
            const backdrop = document.getElementById('update-notice-backdrop');
            backdrop?.classList.add('show');
            const duration = parseFloat(getComputedStyle(backdrop).animationDuration) || 0;
            const childDuration = parseFloat(getComputedStyle(backdrop?.querySelector('.onboarding-dialog')).transitionDuration) || 0;
            return duration <= 0.001 && childDuration <= 0.001;
        })()
    `);
    return { keyboardFocusMoves: focused, reducedMotionHonored: reducedMotion };
}

async function run() {
    await mkdir(artifactRoot, { recursive: true });
    const executable = await findChrome();
    const { server, port } = await startStaticServer();
    const browser = await launchChrome(executable);
    const report = { generatedAt: new Date().toISOString(), chrome: executable, scenarios: [], globalChecks: {} };
    let failed = false;

    try {
        const page = await createPage(browser.debugPort);
        await page.send('Page.enable');
        await page.send('Runtime.enable');
        await page.send('Network.enable');
        await page.send('Network.setBlockedURLs', { urls: [
            '*://www.googleapis.com/identitytoolkit/*',
            '*://identitytoolkit.googleapis.com/*',
            '*://securetoken.googleapis.com/*'
        ] });
        for (const scenario of selectedScenarios) {
            let initializationId;
            try {
                const viewport = viewports[scenario.viewport];
                await page.send('Emulation.setDeviceMetricsOverride', {
                    width: viewport.width,
                    height: viewport.height,
                    deviceScaleFactor: 1,
                    mobile: viewport.mobile
                });
                await page.send('Emulation.setEmulatedMedia', {
                    media: 'screen',
                    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
                });
                await page.send('Network.setBlockedURLs', { urls: [
                    '*://www.googleapis.com/identitytoolkit/*',
                    '*://identitytoolkit.googleapis.com/*',
                    '*://securetoken.googleapis.com/*',
                    ...(scenario.blockFirebase ? ['*://www.gstatic.com/firebasejs/*'] : [])
                ] });
                const initialization = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: initializationScript(scenario) });
                initializationId = initialization.identifier;
                await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/${scenario.page || 'index.html'}` });
                await waitForReady(page, scenario);
                await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: initializationId });
                initializationId = null;
                await prepareScenario(page, scenario);
                const result = await inspectScenario(page, scenario);
                const failures = validateScenario(scenario, result);
                const screenshot = await page.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
                await writeFile(join(artifactRoot, `${scenario.name}-${scenario.viewport}.png`), screenshot.data, 'base64');
                report.scenarios.push({ ...scenario, result, failures });
                if (failures.length) failed = true;
                console.log(`${failures.length ? 'FAIL' : 'PASS'} ${scenario.name} (${scenario.viewport})${failures.length ? ` — ${failures.join('; ')}` : ''}`);

                if (scenario.name === 'dashboard-during-class') {
                    report.globalChecks = await runKeyboardAndMotionChecks(page);
                    if (!report.globalChecks.keyboardFocusMoves || !report.globalChecks.reducedMotionHonored) failed = true;
                }
            } finally {
                if (initializationId) {
                    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: initializationId }).catch(() => {});
                }
            }
        }
        await page.close();
    } finally {
        server.close();
        await stopChrome(browser);
    }

    await writeFile(join(artifactRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    const passedCount = report.scenarios.filter((scenario) => scenario.failures.length === 0).length;
    console.log(`\nVisual QA: ${passedCount}/${report.scenarios.length} scenarios passed.${scenarioFilter ? ` Filter: ${scenarioFilter}.` : ''}`);
    const globalChecksRan = typeof report.globalChecks.keyboardFocusMoves === 'boolean';
    console.log(`Keyboard focus: ${globalChecksRan ? (report.globalChecks.keyboardFocusMoves ? 'PASS' : 'FAIL') : 'SKIPPED'}`);
    console.log(`Reduced motion: ${globalChecksRan ? (report.globalChecks.reducedMotionHonored ? 'PASS' : 'FAIL') : 'SKIPPED'}`);
    console.log(`Artifacts: ${artifactRoot}`);
    if (failed) process.exitCode = 1;
}

run().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
});
