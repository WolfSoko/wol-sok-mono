# Plan #2857: write simulation and ladder back to old local guest replay entries once

Spec: [docs/specs/2857-…](../specs/2857-bacteria-game-write-simulation-and-ladder-back-to-old-local-guest-replay-entries-once.md)

All in `libs/features/lazy/bacteria-game/src/lib/storage/`.

1. **Spec first** (`local-game-replays.spec.ts`): extend the existing test
   "lists an entry kept before the store wrote its simulation" to check
   acceptance 2 and 4 (storage after the listing); add a test for acceptance
   3 (spy on `replayFromBytes` across a second listing) and acceptance 5
   (no `update` for a store without old entries); add a unit test of the pure
   backfill function (acceptance 6). Red against the current code.
2. **Migrate in `read()`** (`local-game-replays.ts`): a function
   `readPlayback(entry)` that inflates an old entry's bytes into its
   `StoredPlayback` (null when they do not read); a pure exported
   `backfilled(stored, read)` that merges the read playback into the stored
   entries still lacking `simulation` and drops those that read as null;
   `read()` applies both, issues one `storage.update` when old entries were
   found, and returns the migrated entries. `listMine` drops `bytes` from
   each entry; `keptListingOf` goes. Green.
3. **Checks and commit**: `npx nx test feat-lazy-bacteria-game`,
   `npx nx typecheck-specs feat-lazy-bacteria-game`,
   `npx nx affected -t lint,lint-templates`, `npx nx format:write`; one
   commit `fix(feat-lazy-bacteria-game): write simulation and ladder back to
   old local replays once`, with spec and plan in a `docs(...)` commit before
   it.
