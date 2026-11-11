# Plan #2983: remove the transitional code of #2966

Spec: [docs/specs/2983-korbjaeger-finish-the-english-names-migration-one-day-after-the-2966-release-and-remove-the-transitional-code.md](../specs/2983-korbjaeger-finish-the-english-names-migration-one-day-after-the-2966-release-and-remove-the-transitional-code.md)

Before each commit `npx nx format:write` and
`npx nx affected -t lint,lint-templates`.

1. **Client side.** Delete `legacy-selection.ts`,
   `legacy-account-migration.ts`, `legacy-device-selection.ts` (+ specs) and
   their exports in `feat-korbjaeger-auswahl`; `FirebaseKontoDienst` loses the
   move and the legacy delete (+ spec cases);
   `legacy-account-migration.emulator.ts` goes; `legacy-device-keys.ts`
   (+ spec) and its call in `main.ts`; the theme fallback in `index.html` and
   `darstellung.spec.ts`'s case; `LEGACY_DEVICE_KEYS` in the privacy
   component and `geraete-schluessel.spec.ts`; the migration sentences of
   sections 4 to 6 and their spec cases.
   Commit `refactor(korbjaeger): remove the client-side move of the names before #2966`.
2. **Rules, index, deletion.** `firestore.rules` drops `auswahl` and the
   `geloeschteKonten` check; `firestore.indexes.json` drops its TTL;
   `firestore-collections.spec.ts`, `firebase-deploy.spec.ts`,
   `firestore-rules.emulator.ts` follow. `kontoGeloescht` writes one
   tombstone and deletes `selections/{uid}` only (+ emulator spec); the
   cleanup CLI deletes an orphan's `auswahl/{uid}` itself;
   `LEGACY_DELETED_ACCOUNTS_COLLECTION` goes from the account lib.
   Commit `refactor(korbjaeger-functions): delete only the version 3 documents of an account`.
3. **Docs.** `CLAUDE.md`, comments naming the removed code.
4. **Checks.** `npx nx affected -t test,test-emulator,typecheck-specs,lint,lint-templates,build`;
   review by a fresh subagent; acceptance list in the PR.
5. **Owner's dry run** (manual step), then the merge request after
   2026-11-10 19:48 UTC.
