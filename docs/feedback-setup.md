# Feedback: Firestore storage + Formspree notifications

The form saves to Firestore first, then uses browser `fetch()` to POST JSON to Formspree. A successful Firestore write is the source of truth. A failed, timed-out, or unconfigured notification never turns a saved submission into an error. No Cloud Functions deployment, backend email package, Firebase billing upgrade, or secret is required by this implementation.

## Paste the Formspree endpoint

Your endpoint is configured at the top of **feedback.js**. To change it later, edit only this constant:

```js
const FORMSPREE_ENDPOINT = "https://formspree.io/f/mqpkggqq";
```

The endpoint is public client configuration; do not add an API secret. If it is ever replaced with a placeholder or malformed URL, Firestore saves still work and the console logs `formspree_not_configured` without sending a request.

In Formspree, create/select your form, configure notifications to **IndySchedule@outlook.com**, and complete any recipient verification shown in its dashboard. Use settings compatible with JSON AJAX submissions. If you restrict allowed domains, include every production hostname and the localhost host used for testing. Check your Formspree account's submission allowance independently of Firebase.

The JSON notification contains category, message, optional name/email, school (`Independence High School`), Auth UID (empty for guests), page URL, and the saved feedback ID. The payload uses the values captured at submission time, even if the user edits the form during the request. Both `Content-Type` and `Accept` are `application/json`. URLs omit query strings and fragments to avoid forwarding incidental private information. Neither Firebase tokens nor the server-timestamp sentinel is sent to Formspree.

## Firebase steps still required

1. Use the existing **indyschedule-1** Firebase project and Firestore database. Keep the Spark plan; keep the existing Auth providers. No new collection, index, mail extension, or admin dashboard needs to be created manually.
2. The production rules last inspected during this task did **not** include `/feedback`. Deploy the complete checked-in **firestore.rules** file after configuring App Check below. It preserves `/users` access and adds strictly validated, create-only feedback. Browser read/list/update/delete access stays denied, including for the submitter. UID must match Firebase Auth, or be empty for a guest. Do not add client notification status writes.
3. Preserve the existing App Check design for guest submissions. Firebase Console → App Check: register your web app with the reCAPTCHA v3 provider and your deployed domains. Enter the private reCAPTCHA secret only in the provider/Console setup. Set the public site key in **feedback-config.js → appCheckSiteKey**. This public key is separate from the Formspree endpoint.
4. Deploy the configured client first. Check App Check metrics and normal signed-in preference sync, then enable Cloud Firestore enforcement under App Check → APIs. Enforcement covers preference syncing too, so older cached clients need to reload. Deploy the feedback rules after enforcement is ready.
5. Verify a submission on your real deployed HTTPS site. The **feedback** collection appears automatically beside **users** in the Firebase Console after the first successful production write. Local emulator records do not appear in this database.

App Check helps reduce automated misuse but is not an enforceable per-user submission quota. The one-minute client cooldown can be bypassed. Keep an eye on Firestore usage and Formspree submission limits. Firebase rules and App Check do not secure the separate Formspree endpoint; use Formspree's own spam/domain controls as appropriate.

From the project root:

```sh
npm install
npm test
npm run test:feedback
# Stop other Firestore emulators before this command:
npm run test:firestore-rules
npx firebase login
# After inserting your public App Check key and Formspree endpoint:
npx firebase deploy --only hosting --project indyschedule-1
# Enable App Check enforcement in the Console, then:
npx firebase deploy --only firestore:rules --project indyschedule-1
```

To paste rules manually instead: Firebase Console → Firestore Database → Rules → replace the editor with the **entire contents of firestore.rules**, then Publish. Preserve the complete `/users` and `/feedback` ruleset.

## Local testing

Start the existing local emulators:

```sh
npx firebase emulators:start --only auth,firestore,hosting --project demo-indy-feedback
```

Open **http://127.0.0.1:5000/**, or keep your Live Server preview at **http://127.0.0.1:5500/**. Both localhost and 127.0.0.1 automatically use the isolated demo database. Local Analytics is disabled. Hard-refresh after changing the endpoint or code.

1. Open Settings → Send Feedback. Submit a category and unique harmless message. Verify the button stays disabled until the save and notification attempt finish, then the message clears and confirmation appears.
2. Open **http://127.0.0.1:4000/firestore** → `demo-indy-feedback` → `feedback`. Verify the category/message/contact fields, correct guest/auth UID, server timestamp, `status: new`, sanitized page URL, and app version. Data is in the emulator process, **not browser Local Storage and not production Firebase**. Without export it normally disappears when the emulator stops.
3. If the Formspree endpoint is configured, **local tests send real Formspree notifications**, even though Firestore data is local. Verify the browser Network panel shows a POST to your endpoint with the expected JSON and a successful response. Check the submission in Formspree, then Outlook inbox/junk. A successful API response does not by itself prove inbox delivery.
4. Test missing category, empty/whitespace message, malformed email, and field limits. No write or notification should occur when validation fails. Test guest and signed-in prefill, double-clicking, and phone/dark/light appearance.
5. To test notification failure without changing Firebase rules, use browser DevTools request blocking for `https://formspree.io/f/*`, then send a new message. Firestore should still contain it and the form should still confirm success. The console should show only a generic notification failure code. Remove request blocking afterward. A hanging notification is aborted after ten seconds.
6. `npm run test:feedback` tests the same flow with mocked Firebase/fetch: request ordering, captured payload/UID, Firestore failure, HTTP/network failure, timeout, duplicate clicks, missing endpoint, and invalid input. It sends no real mail.

## Production testing and limits

After deployment, hard-refresh the production URL. Submit a unique test message; verify **both** the production Firebase Console's `feedback` record and the corresponding Formspree submission/email. Test signed out and signed in. A denied Firestore write must not generate a Formspree request. Security-rule emulator tests cover malicious direct writes and denied reads/list/update/delete independently of the form.

The notification is best-effort browser delivery. Closing the tab after saving can prevent the notification; failures are not automatically retried, and existing records are not backfilled. Do not resubmit the same feedback just because an email is missing. Review the saved record privately in Firestore. The browser does not write notification metadata or gain any read/update permissions.

Reference: [Formspree JavaScript submissions](https://help.formspree.io/articles/building-your-form/submit-forms-with-javascript-ajax), [Firebase App Check setup](https://firebase.google.com/docs/app-check/web/recaptcha-provider).

## Files for this change

Changed: `feedback.js`, `firebase.json`, `.gitignore`, `package.json`, `privacy.html`, `service-worker.js`, `docs/feedback-setup.md`.

Added: `tests/feedback-form-test.mjs`.

Removed: the notification-only `functions/` directory, including its entry point, email renderer, tests, package manifest, lockfile, and installed dependencies. Removed its Firebase deployment/emulator configuration and obsolete deployment instructions. Existing feedback form markup, validation, Auth integration, App Check, and Firestore rules are preserved.

Verification: 414 existing checks and seven new feedback tests passed. The supplied endpoint is configured. Automated tests mock the network and send no actual email; live Formspree/Outlook delivery still needs the manual test above. This change does not deploy production rules or Hosting automatically.
