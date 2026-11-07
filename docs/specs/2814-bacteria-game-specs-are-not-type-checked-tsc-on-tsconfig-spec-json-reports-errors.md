# 2814: bacteria-game specs are not type-checked

Issue: [#2814](https://github.com/WolfSoko/wol-sok-mono/issues/2814)

## Goal

The game lib (`feat-lazy-bacteria-game`) has no spec type errors and no lint
warnings, and neither can come back unnoticed.

## State on `main` (2026-11-07)

- The spec type errors the issue lists are fixed, and the
  `typecheck-specs` target runs in CI: PR
  [#2821](https://github.com/WolfSoko/wol-sok-mono/pull/2821) (for
  [#2815](https://github.com/WolfSoko/wol-sok-mono/issues/2815)).
  `npx tsc -p libs/features/lazy/bacteria-game/tsconfig.spec.json --noEmit`
  exits 0.
- Left open: the unused imports the issue names. oxlint reports four
  `no-unused-vars` warnings in the lib: `lerp` in `arena/arena-renderer.ts`,
  `MatchmakerService`, `MATCH_LEVELS` and `replayOf` in
  `bacteria-game.component.spec.ts`. `no-unused-vars` is `warn`
  workspace-wide and `nx lint` passes with warnings, so nothing stops them.

## Non-goals

- Raising `no-unused-vars` to `error` workspace-wide: the one other warning
  is in `libs/public/spa-cdk-stack` (`IDistribution`, a published package),
  outside this ticket; raised to the manager as a follow-up.
- Further spec typecheck work: done by
  [#2821](https://github.com/WolfSoko/wol-sok-mono/pull/2821).

## Decisions

- Remove the four unused imports, and merge the second
  `import { darker } from './canvas-math'` in `arena-renderer.ts` into the
  first (touched code, same module imported twice).
- Make `no-unused-vars` an `error` for `libs/features/lazy/bacteria-game/**`
  through an `overrides` entry in `.oxlintrc.json` (the workspace's way to
  set project rules). Reason: a warning never fails CI, so the issue's
  "cannot return" needs an error; scoped to this lib, which is clean after
  the fix. The override sets the whole rule, so options later added to the
  root `no-unused-vars` must be repeated there; it goes away once the rule
  is an `error` workspace-wide.

## Acceptance

1. `npx oxlint libs/features/lazy/bacteria-game` reports no warnings.
2. An unused import added to a file of the lib fails `nx lint
feat-lazy-bacteria-game` (checked by hand, not committed).
3. `nx run feat-lazy-bacteria-game:typecheck-specs` passes.
4. `nx test feat-lazy-bacteria-game` passes.
5. `nx lint` of every project passes (the override touches only the lib).

## Open questions

None.
