# Schoology assignments Worker

This Worker owns the optional Schoology calendar connection. The browser sends a Firebase ID token; the Worker verifies its signature and claims for `indyschedule-1`, derives the UID from that verified token, and uses the UID for every D1 operation.

The existing D1 database must be bound as `DB` and contain the `schoology_connections` and `completed_assignments` tables documented in the feature specification. `CALENDAR_ENCRYPTION_KEY` remains a Worker secret. Do not put it in this repository or in `wrangler.toml`.

## Configure and deploy

From the repository root:

```sh
cd worker
npm install
npx wrangler login
npx wrangler d1 list
```

Copy the ID of the existing D1 database into `database_id` in `wrangler.toml`. Apply the included idempotent schema migration, then confirm the already-configured encryption secret is attached:

```sh
npx wrangler d1 migrations apply DB --remote
npx wrangler secret list
```

If `CALENDAR_ENCRYPTION_KEY` is missing, create it interactively (the value is not written to source):

```sh
npx wrangler secret put CALENDAR_ENCRYPTION_KEY
```

Then test and deploy:

```sh
npm test
npx wrangler deploy
cd ..
npm test
npm run test:worker
npx firebase-tools deploy --only hosting --project indyschedule-1 --non-interactive
```

For any additional production domain, set a comma-separated `ALLOWED_ORIGINS` Worker variable. Localhost is accepted only when `ENVIRONMENT` is not `production`.

## Local Firebase emulator development

Use two terminals. Start Firebase from the repository root:

```sh
npx firebase-tools emulators:start --only auth,firestore,hosting --project demo-indy-feedback
```

In the second terminal, prepare and start the local Worker:

```sh
cd worker
npx wrangler d1 migrations apply DB --local
npx wrangler dev --var ENVIRONMENT:development --var FIREBASE_PROJECT_ID:demo-indy-feedback --var CALENDAR_ENCRYPTION_KEY:local-development-only-key
```

Open the Hosting emulator at `http://127.0.0.1:5001`. The frontend automatically uses `http://127.0.0.1:8787` on `localhost` and `127.0.0.1`. Emulator JWT payloads are accepted only by a Worker explicitly started with `ENVIRONMENT=development` and only for requests whose browser origin is localhost. The deployed Worker remains on `ENVIRONMENT=production` and always requires a cryptographically verified Firebase token.
