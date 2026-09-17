# Indy Schedule

Indy Schedule is an unofficial schedule countdown website for Independence High School in Thompson's Station, Tennessee. It keeps the current class and time remaining at the center of the dashboard while also showing the rest of the school day at a glance.

> Indy Schedule is not an official Independence High School or Williamson County Schools website. Schedule, calendar, and menu information may contain errors; verify important information with the school.

## Features

- Live current-period countdown with progress through the class period
- Clear **Between Classes**, **Before School**, and **School's Out!** states
- Independence's regular, late-start, and half-day bell schedules
- Automatic schedule selection using the 2026–27 WCS school calendar
- A, B, and C fifth-period lunch support, including split fifth period for B lunch
- Official Tuesday–Thursday SOAR and Monday/Friday no-SOAR bells
- One-day schedule overrides that automatically expire and sync with an optional account
- **Today at Indy** summary with separate built-in bells, validated live IHS events, sourced lunch information, and tomorrow's schedule
- Preset light and dark color palettes, custom-color contrast help, palette Undo, and optional device appearance matching
- Music City special edition with a matching built-in palette; Friday Night Lights and Historic Franklin remain implemented but are temporarily hidden from Appearance
- Custom period names, selectable interface fonts, and optional times beside schedule entries
- First-visit setup with account or guest paths, lunch selection, and replayable guidance
- Optional email/password or Google sign-in with resilient Firebase preference syncing
- Versioned, validated Firestore settings with owner-only access and conflict-safe multi-device merging
- Installable app support with a cached dashboard and school data for offline reopening
- Responsive layouts for desktop and smaller screens

## Running Locally

The website itself is static and does not require a build step. Serve the repository root with any local HTTP server, then open `index.html` through that server.

The calendar updater requires Node.js 24 or newer:

```sh
npm install
npm run refresh-live-data
```

That command downloads the public IHS calendar feed and the official WCS high-school lunch PDF, writes browser-friendly data, and validates both sources.

## Firestore Settings

Signed-in preferences use settings schema version 2. Each save runs in a Firestore transaction, preserves unrelated changes made on another device, and records a revision, server update time, per-setting update times, and a device identifier. Invalid or unknown fields are discarded before they reach browser storage.

`firestore.rules` restricts `/users/{uid}` to the matching authenticated user, validates supported settings, and denies every other Firestore path by default. Compile-check changes before deployment with:

```sh
npm run test:firestore-rules
npx firebase-tools deploy --only firestore:rules --dry-run
```

## Calendar Automation

`.github/workflows/update-ihs-calendar.yml` runs every three hours and can also be started manually from the GitHub Actions page. It:

1. Downloads the public Independence High School calendar feed.
2. Generates and validates `data/ihs-calendar-events.json` for the next 120 days.
3. Discovers, downloads, parses, and validates the current WCS high-school lunch menu PDF.
4. Deploys the refreshed working tree directly to the `production` Firebase Hosting target.
5. Publishes the same validated tree through GitHub Pages as a secondary host.
6. Commits calendar or lunch data only when source content changes, avoiding timestamp-only commits.

For the workflow to push content updates, enable **Read and write permissions** under **Settings → Actions → General → Workflow permissions**. The repository must retain the `FIREBASE_SERVICE_ACCOUNT_INDYSCHEDULE_1` Actions secret created by `firebase init hosting:github`. Set the Pages deployment source to **GitHub Actions** under **Settings → Pages**.

Today at Indy identifies whether calendar data is live, a saved browser copy, stale, outside its generated range, or unavailable. Built-in bell schedules continue working independently. When event data cannot be trusted, the website links to the [official IHS calendar](https://ihs.wcs.edu/calendar).

## Lunch Menu Updates

Monthly cafeteria items are generated in `lunch-menu.js` from the High School Lunch Menu PDF linked by WCS. To refresh them manually:

1. Run `npm run update-lunch`.
2. Review the generated diff against the official PDF.
3. Run `npm run validate-live-data`.
4. Check several dates in Today at Indy.

The scheduled workflow performs this automatically every three hours. WCS often posts the next menu before the current month ends, so the generator keeps both the posted month and its immediately preceding month; Today at Indy continues using the correct date until the calendar actually rolls over. Older months are removed when the following menu arrives. If WCS removes the link or changes the PDF structure, the updater fails safely and does not replace the last validated menu.

The validator rejects malformed dates, empty meals, dates outside the declared month, and lunches assigned to non-instructional days. If a date has no uploaded menu, Today at Indy displays the source and directs visitors to the [official WCS Menus & Nutrition page](https://www.wcs.edu/about-us/menus-nutrition).

## Project Layout

```text
index.html                         Main dashboard, settings, and onboarding
design-tokens.css                 Authoritative palette and design-token values
styles.css / script.js             Dashboard styling and behavior
styles2.css / script2.js           Settings styling and behavior
gradient.js                        Runtime palette roles and background-gradient behavior
auth.js                            Optional Firebase authentication and sync
firebase-loader.js                 Non-blocking Firebase service loader
dialog-manager.js                  Shared modal focus and background-isolation behavior
school-calendar.js                 School dates and schedule selection
lunch-menu.js                      Daily cafeteria menu data
data/ihs-calendar-events.json      Generated IHS calendar cache
tools/update-calendar-events.mjs   Calendar cache generator
tools/update-lunch-menu.mjs        Official WCS lunch PDF generator
tools/validate-live-data.mjs       Calendar and lunch publication checks
tools/run-regression.mjs           Portable Node regression-test launcher
tools/visual-qa.mjs                Browser screenshots and responsive QA
tests/run-tests.js                 Schedule and regression checks
.github/workflows/                 GitHub Actions data and release automation
```

## Testing

Run the regression suite with Node:

```sh
npm test
```

The tests validate schedule dates and times, lunch placement, display states, calendar integration, palette contrast and token ownership, and retired-code cleanup.

Validate publishable live data separately with:

```sh
npm run validate-live-data
```

Run the complete v1.3.3 release check with:

```sh
npm run qa
```

`npm run check:performance` prevents the uncompressed app shell and its largest files from quietly growing beyond the Chromebook-oriented limits in `tools/check-performance-budget.mjs`. Release steps, preview behavior, and rollback are documented in `docs/releasing.md`; the manual student and accessibility checks are in `docs/student-chromebook-test.md` and `docs/accessibility-audit.md`.

The browser QA runner (`npm run test:browser`, also used by `test:visual`) uses local Chrome or Chromium to freeze representative school times and capture Chromebook, tablet, and phone screenshots. It covers all dashboard states, every Settings page, onboarding, Today at Indy, signed-in and signed-out headers, Firestore preference behavior, signed-in tour replay, optional-auth failure, modal accessibility, and representative light and dark palettes. Screenshots and a machine-readable report are written to `.artifacts/visual-qa/` and are intentionally excluded from deployment and version control.

Special editions live directly below Color palette in Appearance. Music City is currently the visible option; Friday Night Lights and Historic Franklin remain implemented behind temporary hidden controls. Activating an edition applies its artwork and built-in palette across the dashboard and Settings. Choosing any regular palette or editing the custom palette turns the edition off. Lossless source artwork remains locally in `assets/special-editions/` and is ignored by Git, while deployment includes only the optimized browser images.

## CSS Architecture

Styles load in a deliberate order:

1. `design-tokens.css` owns global palette, spacing, radius, border, shadow, and motion values.
2. `styles.css` provides base layout, dashboard foundations, onboarding/dialog components, and base responsive fallbacks.
3. `styles2.css` provides the canonical dashboard components, Settings shell and pages, Today at Indy popover, and component-local responsive refinements.

Keep palette values out of component stylesheets. Add shared component behavior to the existing canonical section instead of appending a new override block at the end of a file.

## Publishing

Use this directory—the one containing `index.html`, `firebase.json`, and `.github`—as the Git repository root. Archived copies outside this directory should not be included in the repository or Firebase deployment.

Firebase Hosting is the primary deployment. The scheduled calendar workflow deploys the validated site directly to Firebase every three hours and also refreshes GitHub Pages. Keep that workflow enabled so the public event cache does not become stale.

## Privacy and Terms

The countdown and most preferences work without an account. Email/password and Google sign-in are optional and are used only for authentication and preference syncing. See `privacy.html` and `terms.html` for the full policies.

## License

Licensed under the [Apache License 2.0](LICENSE).
