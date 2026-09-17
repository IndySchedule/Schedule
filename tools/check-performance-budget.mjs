import { stat } from 'node:fs/promises';

const budgets = {
    'index.html': 130_000,
    'styles.css': 110_000,
    'styles2.css': 210_000,
    'script.js': 190_000,
    'auth.js': 70_000,
    'gradient.js': 45_000,
    'data/ihs-calendar-events.json': 100_000
};

const appShell = [
    'index.html', 'design-tokens.css', 'styles.css', 'styles2.css',
    'dialog-manager.js', 'diagnostics.js', 'auth.js', 'firebase-loader.js',
    'gradient.js', 'script2.js', 'school-calendar.js', 'lunch-menu.js',
    'script.js', 'data/ihs-calendar-events.json',
    'indy_schedule_logo_sizes/indy-schedule-logo-192x192.png',
    'indy_schedule_logo_sizes/indy-schedule-logo-512x512.png'
];
const APP_SHELL_BUDGET = 1_050_000;
let failed = false;
let total = 0;

for (const path of appShell) {
    const bytes = (await stat(path)).size;
    total += bytes;
    if (budgets[path] && bytes > budgets[path]) {
        console.error(`FAIL ${path}: ${bytes.toLocaleString()} bytes exceeds ${budgets[path].toLocaleString()}`);
        failed = true;
    }
}

if (total > APP_SHELL_BUDGET) {
    console.error(`FAIL app shell: ${total.toLocaleString()} bytes exceeds ${APP_SHELL_BUDGET.toLocaleString()}`);
    failed = true;
}

console.log(`App shell: ${total.toLocaleString()} / ${APP_SHELL_BUDGET.toLocaleString()} bytes (uncompressed).`);
if (failed) process.exitCode = 1;
