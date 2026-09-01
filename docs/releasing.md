# Releasing Indy Schedule

## Normal release

1. Update the version and What’s New copy.
2. Run `npm run release:check`.
3. Follow [`deployment-checklist.md`](deployment-checklist.md), especially the app-settings/rules compatibility check and post-deploy save smoke test.
4. Open a pull request. GitHub creates a Firebase preview after quality checks pass.
5. Merge to `main` to deploy the live site.
6. Create and push a signed or annotated `vX.Y.Z` tag. The release workflow reruns checks, deploys Hosting and Firestore rules together, and creates the GitHub release notes.

## Rollback

Firebase keeps prior Hosting releases. In Firebase Console, open **Hosting → Release history**, find the last known-good release, choose its menu, and select **Rollback**. This restores the site files without rewriting Git history.

If Firestore rules caused the problem, restore the previous `firestore.rules` from Git and deploy only that file with `npx firebase-tools deploy --only firestore:rules --project indyschedule-1`. Then open a corrective pull request so the repository matches production.
