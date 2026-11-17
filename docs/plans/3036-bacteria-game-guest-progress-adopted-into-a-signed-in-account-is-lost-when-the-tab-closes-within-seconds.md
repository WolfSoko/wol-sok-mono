# Plan: guest progress adoption survives a closed tab (#3036)

Spec: [docs/specs/3036-bacteria-game-guest-progress-adopted-into-a-signed-in-account-is-lost-when-the-tab-closes-within-seconds.md](../specs/3036-bacteria-game-guest-progress-adopted-into-a-signed-in-account-is-lost-when-the-tab-closes-within-seconds.md)

1. **Idempotent update in the storage, test first.** `firestore-game-storage.spec.ts`: `once`
   skips a listed id, lists a new one, caps at 20, `update` and `write` keep the list. Then
   `game-storage.ts` (`UpdateOptions`), `firestore-game-storage.ts`, `local-game-storage.ts`
   (accepts and ignores it), and the fakes that implement `GameStorage`.
   Commit: `feat(feat-lazy-bacteria-game): apply a storage change once by its id`.
2. **Rules take the list.** `apps/bacteria-game-remote/firestore.rules` `isStoredValue`; cases in
   `rules-test/firestore-rules.emulator.ts`.
   Commit: `feat(bacteria-game-remote): allow the applied change ids beside a stored value`.
3. **Journal of pending adoptions, test first.** `player-document.spec.ts`: a sign-in that
   adopts records and clears the entry, a page closed before it landed leaves it, the next
   start of that player replays it once. Then `pendingAdoptionsKey` in `unsaved-changes.ts`
   (the journal reuses its functions), `player-document.ts`, and the privacy policy's
   section 3.
   Commit: `fix(feat-lazy-bacteria-game): replay a guest adoption a closed tab left behind`.
4. **Checks.** `test`, `typecheck-specs`, lint and `lint-templates` of the game lib and the
   remote, `bacteria-game-remote:test-emulator`, format.
