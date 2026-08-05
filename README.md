# Indy Schedule

Indy Schedule is an unofficial schedule countdown website for Independence High School in Thompson's Station, Tennessee. It keeps the current class and time remaining at the center of the dashboard while also showing the rest of the school day at a glance.

> Indy Schedule is not an official Independence High School or Williamson County Schools website. Schedule, calendar, and menu information may contain errors; verify important information with the school.

## Features

- Live current-period countdown with progress through the class period
- Clear **Between Classes**, **Before School**, and **School's Out!** states
- Independence's regular, late-start, and half-day bell schedules
- Automatic schedule selection using the 2026–27 WCS school calendar
- A, B, and C fifth-period lunch support, including split fifth period for B lunch
- Tuesday–Thursday SOAR and Homeroom placement
- **Today at Indy** summary with today's schedule, IHS calendar events, lunch menu, and tomorrow's schedule
- Preset light and dark color palettes plus a custom four-color palette
- Custom period names and optional times beside schedule entries
- First-visit setup for selecting lunch
- Optional Google sign-in and Firebase preference syncing
- Responsive layouts for desktop and smaller screens

## Running Locally

The website itself is static and does not require a build step. Serve the repository root with any local HTTP server, then open `index.html` through that server.

The calendar updater requires Node.js 22 or newer:

```sh
npm install
npm run update-calendar
```

That command downloads the public IHS calendar feed and writes the browser-friendly cache at `data/ihs-calendar-events.json`.

## Calendar Automation

`.github/workflows/update-ihs-calendar.yml` runs every three hours and can also be started manually from the GitHub Actions page. It:

1. Downloads the public Independence High School calendar feed.
2. Generates `data/ihs-calendar-events.json` for the next 120 days.
3. Commits the file only when the cached event data changes.

For the workflow to push updates, enable **Read and write permissions** under **Settings → Actions → General → Workflow permissions** in the GitHub repository.

When calendar data is unavailable or has not been generated yet, the website falls back to a link to the [official IHS calendar](https://ihs.wcs.edu/calendar).

## Lunch Menu Updates

Monthly cafeteria items live in `lunch-menu.js` under `YYYY-MM-DD` date keys. Add each new month's menu there. If a date has no uploaded menu, **Today at Indy** directs visitors to the [official WCS Menus & Nutrition page](https://www.wcs.edu/about-us/menus-nutrition).

## Project Layout

```text
index.html                         Main dashboard, settings, and onboarding
styles.css / script.js             Dashboard styling and behavior
styles2.css / script2.js           Settings styling and behavior
gradient.js                        Palette and background-gradient behavior
auth.js                            Optional Firebase authentication and sync
school-calendar.js                 School dates and schedule selection
lunch-menu.js                      Daily cafeteria menu data
data/ihs-calendar-events.json      Generated IHS calendar cache
tools/update-calendar-events.mjs   Calendar cache generator
tests/run-tests.js                 Schedule and regression checks
.github/workflows/                 GitHub Actions calendar automation
```

## Testing

On macOS, run the regression suite with JavaScriptCore:

```sh
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tests/run-tests.js
```

The tests validate schedule dates and times, lunch placement, display states, calendar integration, and retired-code cleanup.

## Publishing

Use this directory—the one containing `index.html` and `.github`—as the Git repository root. Do not initialize the parent `Indy Schedule` directory, because it also contains archived versions of the project.

The site can be published with GitHub Pages or another static host. The scheduled calendar workflow must remain enabled so the event cache stays current.

## Privacy and Terms

The countdown and most preferences work without an account. Google sign-in is optional and is used only for authentication and cross-device preference syncing. See `privacy.html` and `terms.html` for the full policies.

## License

MIT
