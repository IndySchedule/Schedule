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
    { name: 'today-at-indy', viewport: 'phone', time: schoolTimes.lunch, action: 'today' },
    { name: 'onboarding-first-step', viewport: 'phone', time: schoolTimes.beforeSchool, onboarding: true },
    { name: 'palette-daylight', viewport: 'chromebook', time: schoolTimes.duringClass, palette: 'daylight', state: 'in-class', heading: 'Period 1' },
    { name: 'palette-dark-plum', viewport: 'chromebook', time: schoolTimes.duringClass, palette: 'dark-plum', state: 'in-class', heading: 'Period 1' },
    { name: 'edition-friday-night-lights', viewport: 'chromebook', time: schoolTimes.duringClass, edition: 'friday-night-lights', state: 'in-class', heading: 'Period 1' },
    { name: 'edition-historic-franklin', viewport: 'chromebook', time: schoolTimes.duringClass, edition: 'historic-franklin', state: 'in-class', heading: 'Period 1' },
    { name: 'edition-music-city', viewport: 'chromebook', time: schoolTimes.duringClass, edition: 'music-city', state: 'in-class', heading: 'Period 1' },
    { name: 'edition-music-city-phone', viewport: 'phone', time: schoolTimes.duringClass, edition: 'music-city', state: 'in-class', heading: 'Period 1' },
    { name: 'edition-selection-control', viewport: 'chromebook', time: schoolTimes.duringClass, settings: 'appearance', chooseEdition: 'historic-franklin' },
    { name: 'palette-disables-edition', viewport: 'chromebook', time: schoolTimes.duringClass, edition: 'friday-night-lights', settings: 'appearance', resetEdition: true },
    { name: 'account-signed-out', viewport: 'chromebook', time: schoolTimes.duringClass, account: 'signed-out' },
    { name: 'account-signed-in', viewport: 'chromebook', time: schoolTimes.duringClass, account: 'signed-in' },
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
            localStorage.setItem('lunchWave', 'A');
            localStorage.setItem('showPeriodTimes', 'true');
            localStorage.setItem('progressBarEnabled', 'true');
            localStorage.setItem('indyAnalyticsConsent_v1', 'denied');
            ${scenario.onboarding ? "localStorage.removeItem('indyOnboardingComplete_v2');" : "localStorage.setItem('indyOnboardingComplete_v2', 'true');"}
            ${settings ? `localStorage.setItem('gradientSettings', ${JSON.stringify(JSON.stringify(settings))});` : "localStorage.removeItem('gradientSettings');"}
        })();
    `;
}

async function waitForReady(page) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        const ready = await page.evaluate(`document.readyState === 'complete' && Boolean(document.querySelector('.dashboard-shell'))`);
        if (ready) {
            await page.evaluate(`document.fonts?.ready || Promise.resolve()`);
            await delay(350);
            return;
        }
        await delay(100);
    }
    throw new Error('Page did not finish loading.');
}

async function prepareScenario(page, scenario) {
    if (scenario.settings) {
        await page.evaluate(`
            document.getElementById('settings-button')?.click();
            document.querySelector('.nav-item[data-target=${JSON.stringify(scenario.settings)}]')?.click();
        `);
        await delay(300);
    }
    if (scenario.resetEdition) {
        await page.evaluate(`document.querySelector('.palette-option[data-palette="indy"]')?.click()`);
        await delay(200);
    }
    if (scenario.chooseEdition) {
        await page.evaluate(`document.querySelector('.edition-option[data-edition=${JSON.stringify(scenario.chooseEdition)}]')?.click()`);
        await delay(200);
    }
    if (scenario.action === 'today') {
        await page.evaluate(`document.getElementById('today-toggle')?.click()`);
        await delay(250);
    }
    if (scenario.account === 'signed-in') {
        await page.evaluate(`
            (() => {
                if (!window.authManager) return;
                window.authManager.isAuthenticated = true;
                window.authManager.currentUser = {
                    displayName: 'Indy Student',
                    email: 'student@example.com',
                    photoURL: 'indy_schedule_logo_sizes/indy-schedule-logo-48x48.png'
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
                accountState: document.getElementById('sign-in-button')?.className || '',
                accountMenuOpen: !document.querySelector('.dashboard-account-menu')?.hidden,
                duplicateIds,
                unnamedControls,
                imagesWithoutAlt
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
    if (scenario.action === 'today') {
        check(result.todayOpen, 'Today at Indy did not open');
        check(result.todayContained, 'Today at Indy is clipped outside the viewport');
    }
    if (scenario.onboarding) {
        check(result.onboardingOpen, 'onboarding did not open');
        check(result.onboardingContained, 'onboarding is clipped horizontally');
    }
    if (scenario.account === 'signed-out') check(result.accountState.includes('is-signed-out'), 'signed-out account state is missing');
    if (scenario.account === 'signed-in') {
        check(result.accountState.includes('is-signed-in'), 'signed-in account state is missing');
        check(result.accountMenuOpen, 'signed-in account menu did not open');
    }
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
        for (const scenario of scenarios) {
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
                const initialization = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: initializationScript(scenario) });
                initializationId = initialization.identifier;
                await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
                await waitForReady(page);
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
        browser.chrome.kill('SIGTERM');
        await rm(browser.profileDirectory, { recursive: true, force: true });
    }

    await writeFile(join(artifactRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    const passedCount = report.scenarios.filter((scenario) => scenario.failures.length === 0).length;
    console.log(`\nVisual QA: ${passedCount}/${report.scenarios.length} scenarios passed.`);
    console.log(`Keyboard focus: ${report.globalChecks.keyboardFocusMoves ? 'PASS' : 'FAIL'}`);
    console.log(`Reduced motion: ${report.globalChecks.reducedMotionHonored ? 'PASS' : 'FAIL'}`);
    console.log(`Artifacts: ${artifactRoot}`);
    if (failed) process.exitCode = 1;
}

run().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
});
