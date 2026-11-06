# Plan: one fake Firebase SDK for the game's storage adapter specs

Spec: [`docs/specs/2788-one-fake-firebase-sdk-for-the-games-storage-adapter-specs.md`](../specs/2788-one-fake-firebase-sdk-for-the-games-storage-adapter-specs.md). All paths below are under `libs/features/lazy/bacteria-game/src/`.

1. **The fake, test first.** `testing/fake-firebase-sdk.spec.ts`, then `testing/fake-firebase-sdk.ts` (`FakeFirebase`, `FakeTimestamp`, `FakeBytes`, `SERVER_TIMESTAMP`). Commit `test(feat-lazy-bacteria-game): add one fake Firebase SDK for the adapter specs`.
2. **Storage and rooms specs** move to it: `lib/storage/firestore-game-storage.spec.ts`, `lib/storage/firestore-game-rooms.spec.ts`; their fakes deleted.
3. **Social and moderation specs**: `lib/storage/firestore-game-social.spec.ts`, `lib/storage/firestore-game-moderation.spec.ts`.
4. **Ranked and replays specs**: `lib/storage/firestore-game-ranked.spec.ts`, `lib/storage/firestore-game-replays.spec.ts`.
   Steps 2 to 4 commit as `refactor(feat-lazy-bacteria-game): move the <adapter> specs to the shared fake Firebase SDK`; each runs `npx nx test feat-lazy-bacteria-game` on the spec files it touched.
5. **Docs**: a line in `CLAUDE.md` where it describes the game's specs. Commit `docs(feat-lazy-bacteria-game): ...`.
6. Before each commit `npx nx format:write`, `npx nx affected -t lint,lint-templates`, then the full `npx nx test feat-lazy-bacteria-game`.
