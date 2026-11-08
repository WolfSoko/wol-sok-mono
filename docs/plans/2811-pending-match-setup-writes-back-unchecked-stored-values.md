# Plan: Pending match setup writes back unchecked stored values

Spec: [docs/specs/2811-pending-match-setup-writes-back-unchecked-stored-values.md](../specs/2811-pending-match-setup-writes-back-unchecked-stored-values.md)

1. **Failing spec.** In `libs/features/lazy/bacteria-game/src/lib/settings/stored-match-setup.spec.ts`,
   add "keeps only the readable values of a stored setup that waits for the
   menu": start a match, restore `{ levelId: 'moon', colors: ['gold', 'blue'],
   difficulty: 'hard' }`, and expect `toStore()` to have the current `levelId`
   and `colors` and `difficulty: 'hard'`. Then `reset()` and expect `difficulty`
   `hard`. It fails on `main`, because `toStore()` returns `'moon'`.
2. **Fix.** In `stored-match-setup.ts`, add `readMatchSetup(stored)` (from
   `MATCH_SETUP`, unreadable keys left out). `restore()` reads once and keeps
   the result as `pending` or applies it. `apply(setup: Partial<MatchSetup>)`
   only leaves out the touched keys. `toStore()` takes the pending values as
   they are.
3. **Checks and commit.** `npx nx format:write`, then
   `npx nx run-many -t test,lint,lint-templates,typecheck-specs -p feat-lazy-bacteria-game`.
   One commit: `fix(feat-lazy-bacteria-game): keep only readable values of a pending match setup`,
   with the spec and the plan.
