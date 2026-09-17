# Accessibility audit checklist

Automated regression covers keyboard focus movement, modal focus containment, accessible control names, reduced motion, preset contrast, Chromebook/tablet/phone reflow, and representative light/dark palettes.

Before each release, manually verify the parts automation cannot fully judge:

- At 200% browser zoom, complete setup, open Settings, change the schedule, and open Today at Indy without horizontal page scrolling.
- With ChromeVox on a Chromebook, navigate landmarks and headings, then operate the account dialog, palette radios, switches, schedule dropdown, Today at Indy, and all close buttons.
- Confirm status changes such as palette Undo, cloud save, calendar failure, and validation errors are announced once and in useful language.
- Use only the keyboard to complete setup, sign in, dismiss dialogs, and reach every Settings control; verify focus is always visible.
- Check Daylight, Dark Mode, and one custom low-contrast palette with a contrast analyzer.

Record the browser/ChromeOS version, failed task, exact control, and expected behavior. Do not mark the audit complete until every blocking issue is fixed or documented with an owner.
