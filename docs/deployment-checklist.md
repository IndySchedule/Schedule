# Deployment checklist

Use this checklist before every release that changes account settings, Firestore fields, or the service worker.

## Keep the app and rules together

The browser can start sending a new settings key as soon as Hosting is updated. If Firestore rules are still on the previous schema, every settings transaction can fail with `403 Forbidden`.

Before deploying:

1. Compare the settings keys collected in `auth.js` with the allowed keys and value checks in `firestore.rules`.
2. Keep compatibility keys for the previous release when older clients may still be open.
3. Run `npm test`, `npm run test:firestore-rules`, `npm run validate-live-data`, and `npm run check:performance`.
4. Deploy Hosting and Firestore rules in the same command:

   ```sh
   npx firebase-tools deploy --only hosting,firestore:rules --project indyschedule-1 --non-interactive
   ```

5. Hard-refresh the live site and change one harmless preference while signed in. Confirm the console shows `✓ All settings saved to Firestore` and no `403` or `permission-denied` message.
6. Confirm the live service worker cache version matches the release version.

Do not deploy a new client settings schema by itself. Do not deploy new rules without checking that the currently published client can still save its existing settings.
