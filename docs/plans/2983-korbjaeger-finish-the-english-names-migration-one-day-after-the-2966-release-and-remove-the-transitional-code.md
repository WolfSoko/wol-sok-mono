# Plan #2983: finish the English-names migration, remove the transitional code

Spec: [docs/specs/2983-korbjaeger-finish-the-english-names-migration-one-day-after-the-2966-release-and-remove-the-transitional-code.md](../specs/2983-korbjaeger-finish-the-english-names-migration-one-day-after-the-2966-release-and-remove-the-transitional-code.md)

Each task test first; before each commit `npx nx format:write` and
`npx nx affected -t lint,lint-templates`.

1. **Pure migration entry.** `libs/features/korbjaeger-auswahl/src/migration.ts`
   (entry) and `src/lib/legacy-migration.ts` with `legacyMigration`, built
   on `legacySelection`, `auswahlDokumentLesen`, `inhaltAus`,
   `zusammenfuehren`, `auswahlFelder`, `naechsterSeit`; plain values (no
   `deleteField`, a join only adds). Path alias in `tsconfig.base.json`.
   Spec: `legacy-migration.spec.ts` (acceptance 1).
   Commit `feat(feat-korbjaeger-auswahl): pure legacy migration entry for the server-side move`.
2. **Migration step in the CLI.** `apps/korbjaeger-functions/src/cleanup/legacy-selections.ts`
   (`migrateLegacySelections(db, { apply })`, a transaction an account,
   counts), wired into `run-orphan-cleanup.ts` after the orphan step;
   `reportText` gets the second block. Specs: `cleanup-cli.spec.ts`,
   `legacy-selections.emulator.ts` (acceptance 2, 3).
   Commit `feat(korbjaeger-functions): move the remaining auswahl documents in the cleanup run`.
3. **Remove the client migration.** Delete `legacy-account-migration.ts`,
   `legacy-device-selection.ts` (+ spec), their exports; `FirebaseKontoDienst`
   loses the move and the legacy delete (+ spec cases);
   `legacy-account-migration.emulator.ts` goes; `legacy-device-keys.ts`
   (+ spec) and its call in `main.ts`; the theme fallback in `index.html` and
   `darstellung.spec.ts`'s case; `LEGACY_DEVICE_KEYS` in the privacy
   component, `geraete-schluessel.spec.ts`; the migration sentences of
   sections 4 to 6 and their spec cases.
   Commit `refactor(korbjaeger): remove the client-side move of the names before #2966`.
4. **Rules, index, deletion.** `firestore.rules` drops `auswahl` and the
   `geloeschteKonten` check; `firestore.indexes.json` drops its TTL;
   `firestore-collections.spec.ts`, `firebase-deploy.spec.ts`,
   `firestore-rules.emulator.ts` follow. `kontoGeloescht` writes one
   tombstone and deletes `selections/{uid}` only (+ emulator spec);
   `LEGACY_DELETED_ACCOUNTS_COLLECTION` goes from the account lib.
   Commit `refactor(korbjaeger-functions): delete only the version 3 documents of an account`.
5. **Docs.** `CLAUDE.md` (Korbjäger and the functions' cleanup), the
   `auswahl-dokument.ts` comment.
   Commit `docs(korbjaeger): the names of before #2966 are gone`.
6. **Checks.** `npx nx affected -t test,test-emulator,typecheck-specs,lint,lint-templates,build`,
   `korbjaeger:e2e`; review by a fresh subagent; acceptance list in the PR.
7. **Owner's run** from the branch (dry run, `--delete`, dry run), reports
   on the PR, then the merge request.
