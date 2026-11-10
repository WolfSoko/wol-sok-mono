# Plan 2945 — one shared place for Korbjäger's account constants and emulator helpers

Spec: [docs/specs/2945-….md](../specs/2945-korbjaeger-one-shared-place-for-regions-collection-names-deletion-durations-and-emulator-test-helpers.md). Each task ends with `npx nx format:write`, `npx nx affected -t lint,lint-templates,test` and a commit.

1. **Lib `feat-shared-korbjaeger-account`** — `libs/features/korbjaeger-account/{project.json,package.json,LICENSE,README.md,tsconfig*.json,jest.config.ts,src/index.ts,src/lib/account.ts,src/lib/account.spec.ts}`, path alias in `tsconfig.base.json`, line in root `LICENSE`. Spec: the tombstone outlives an ID token (an hour), `TOMBSTONE_DURATION_MS` equals `TOMBSTONE_DAYS` days. Commit `feat(feat-shared-korbjaeger-account): …`.
2. **Functions take the lib** — `apps/korbjaeger-functions/src/{config.ts,config.spec.ts,konto-geloescht.ts,konto-geloescht.emulator.ts}`, `project.json` (drop `regionen.ts` input). Spec: deploy `--location` equals `REGION`. Commit `refactor(korbjaeger-functions): …`.
3. **Auswahl lib takes the collection name** — `libs/features/korbjaeger-auswahl/src/lib/firestore-auswahl.ts`. Existing contract specs cover it. Commit `refactor(feat-korbjaeger-auswahl): …`.
4. **App regions and collections** — `apps/korbjaeger/src/shared/{regionen.ts→regions.ts,function-region.ts}`, `vite.config.ts`, `firebase-deploy.spec.ts`, `firestore-rules.emulator.ts`, new rules/collections check in `src/firestore-collections.spec.ts`. Commit `refactor(korbjaeger): …`.
5. **Privacy policy durations from constants** — `rechtliches/datenschutz.component.{ts,html,spec.ts}`, `rechtliches/tage-text.ts` (+ spec). Commit `refactor(korbjaeger): …`.
6. **Lib `shared-firebase-emulator`** — `libs/shared/firebase-emulator/…` (MIT, tag `shared`), alias; use it in `apps/bacteria-wars-functions/src/testing/emulator.ts`, `apps/korbjaeger-functions/src/testing/emulator.ts`, `apps/korbjaeger/src/testing/firestore-emulator.ts`. Check: the three `test-emulator` targets. Commit `refactor(shared-firebase-emulator): …`.
7. **CLAUDE.md** — Korbjäger section (regions, functions config, libs) and Licence list. Commit `docs` under scope `korbjaeger`.
8. **PR, review, test, merge** as the end-to-end role says.
