# Plan #2986: delete orphaned selections/{uid} and auswahl/{uid}

Spec: [docs/specs/2986-….md](../specs/2986-korbjaeger-delete-orphaned-selections-uid-and-auswahl-uid-of-deleted-accounts-with-the-2983-cleanup.md)

1. **Orphan search, test first.** `apps/korbjaeger-functions/src/cleanup/orphaned-accounts.ts`:
   `ExistingAccounts` port, `findOrphanedAccounts(db, accounts)` (ids of both
   collections, deduplicated, looked up in batches of 100) and
   `cleanUpOrphanedAccounts(db, accounts, { deleteOrphans })` with its report
   (through `kontoGeloescht`). Spec `orphaned-accounts.emulator.ts` with a
   fake `ExistingAccounts`: acceptance 1–3. Commit
   `feat(korbjaeger-functions): find and delete orphaned selections of deleted accounts`.
2. **Auth adapter.** `src/cleanup/auth-accounts.ts` (`getUsers`, 100 a call)
   and its emulator spec; `emulator.json` gets the Auth emulator on ports of
   its own, `test-emulator` runs `--only firestore,auth`. Acceptance 4.
   Same or own commit.
3. **CLI and target.** `src/cleanup/run-orphan-cleanup.ts` (args `--project`,
   `--delete`, prints the report), nx target `cleanup-orphans` that bundles it with esbuild (the app is ESM,
   the libs it imports are not, so `tsx` cannot load them) and runs it; pure spec of argument parsing and report text. Acceptance
   5–6. Commit `feat(korbjaeger-functions): one-off CLI for the orphan cleanup`.
4. **Docs.** CLAUDE.md's `korbjaeger-functions` paragraph names the cleanup;
   comment on #2983 with the production run's steps. Format, lint, tests,
   PR.
