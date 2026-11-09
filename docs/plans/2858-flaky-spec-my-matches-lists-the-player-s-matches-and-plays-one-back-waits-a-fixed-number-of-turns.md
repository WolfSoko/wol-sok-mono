# Plan #2858: Flaky spec: My matches "lists the player's matches and plays one back" waits a fixed number of turns

Spec: [docs/specs/2858-flaky-spec-my-matches-lists-the-player-s-matches-and-plays-one-back-waits-a-fixed-number-of-turns.md](../specs/2858-flaky-spec-my-matches-lists-the-player-s-matches-and-plays-one-back-waits-a-fixed-number-of-turns.md)

1. **Spec and plan.** This file and the spec. Commit:
   `docs(feat-lazy-bacteria-game): spec and plan for the My matches watch wait`.
2. **Wait for the viewer, bounded.**
   `libs/features/lazy/bacteria-game/src/lib/replays/my-matches.component.spec.ts`:
   extract one settling turn from `settle`, add `settleUntil(fixture, ready,
   what)` with `SETTLE_LIMIT_MS = 3_000`, use it after the Watch click of
   "plays one back" (viewer present) and of the three "older" cases (notice
   shown). Test first: check by hand that `settleUntil` with a condition
   that never holds fails with its message within the bound, and that the
   "plays one back" spec passes 20 times in a row under parallel load (a
   stress loop with busy workers). Then `npx nx test feat-lazy-bacteria-game`,
   `typecheck-specs`, `lint`, `format:check`. Commit:
   `test(feat-lazy-bacteria-game): wait for the replay viewer in My matches
   instead of a fixed number of turns`.
