# Plan: game progress saves survive a tab closed within seconds of the change

Spec: [2820](../specs/2820-game-progress-saves-are-lost-when-the-tab-closes-within-seconds-of-the-change.md). Every path below is under `libs/features/lazy/bacteria-game/src/`. Before each commit: `npx nx format:write`, `npx nx affected -t lint,lint-templates`, `npx nx test feat-lazy-bacteria-game` and `npx nx run feat-lazy-bacteria-game:typecheck-specs`.

## 1. `GameStorage.update` says when a change settled

- `lib/storage/game-storage.ts`: `update(...)` returns `Promise<boolean>`: true once stored, false once dropped; never rejects. Doc comment says so.
- `lib/storage/local-game-storage.ts`: resolve after the write (with or without Web Locks); a refused storage resolves false.
- `lib/storage/firestore-game-storage.ts`: `enqueue` returns the task's promise; `update` resolves true after the committed transaction, false on a final error or a failed task.
- `testing/late-game-storage.ts`: resolve true on `flush`/`flushLast` of that change; `testing/fake-game-account.ts` passes it on.
- Tests first: `local-game-storage.spec.ts`, `firestore-game-storage.spec.ts` (commit → true, `permission-denied` → false), a `late-game-storage` case in `player-document.spec.ts` if no spec of its own exists.
- Fix specs whose hand-made `GameStorage` doesn't type any more (`typecheck-specs`).
- Commit: `feat(feat-lazy-bacteria-game): report when a game storage change settled`.

## 2. Never lose the device's progress to a closed page

- `lib/storage/player-document.ts`: `adoptOnce` returns the update's promise; `deviceCopy` first keeps the copy as an unsaved change of the page (task 3), then writes `null` to the device, also where the device refuses the journal, so no second page adopts it again (changed in review; the first draft cleared it only once the adoption resolved true).
- Tests first in `player-document.spec.ts`: the copy leaves the device at once and waits in the journal until stored, no second page adopts it, the next visit lands it from the journal.
- Commit: `fix(feat-lazy-bacteria-game): keep the device's progress until the cloud stored it`.

## 3. Journal unsaved changes per player

- New `lib/storage/unsaved-changes.ts`: the pure part (entry map shape, `parseUnsaved`, `withEntry`, `withoutEntry`, `entriesOf(player)`), with `unsaved-changes.spec.ts`.
- `lib/storage/player-document.ts`: a page id (random, per document instance); with a cloud and a known player, `apply` records the held value as this page's entry for the player (`DeviceStorage.update('<key>.unsaved', …)`) and counts a sequence per player; when the update for the latest sequence settles, it removes the entry. On every player start, it replays that player's entries as described in the spec (decision 5).
- Tests first in `player-document.spec.ts`: acceptance 1-5 and 8 (journal written, cleared on the latest settle only, replayed and cleared, other player's entry untouched, idempotent replay, nothing without a cloud).
- Commit: `fix(feat-lazy-bacteria-game): replay progress changes a closed tab left unsaved`.

## 4. Docs

- `lib/storage/firestore-game-storage.ts` class comment and `player-document.ts` doc: what survives a closed page now.
- Commit together with task 3, or `docs(feat-lazy-bacteria-game): ...` if separate.

## E2E

No new e2e: the emulator commits before a test can close the tab, so a reload test could not fail on the old code. The game's existing e2e (including #2817's cloud-save one) stays green.
