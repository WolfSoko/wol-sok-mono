# Plan #2803: Engine spec does not type-check: weaponCooldownFactor in evolution-match.spec.ts

Spec: [docs/specs/2803-…](../specs/2803-engine-spec-does-not-type-check-weaponcooldownfactor-in-evolution-match-spec-ts.md)

## Task 1: make the failure visible in Nx

- Files: `libs/features/bacteria-engine/project.json`.
- Add `"typecheck-specs": {}`; `npx nx typecheck-specs feat-shared-bacteria-engine`
  fails with TS2551 at `evolution-match.spec.ts:792`.

## Task 2: fix the boss test

- Files: `libs/features/bacteria-engine/src/lib/state/evolution-match.spec.ts`.
- Expected cooldown = `weaponOf('toxin-bomb').cooldownSec`, with the
  comment on boost vs. weapon; assert meltdown's boss `cooldownFactor` is
  not 1.
- `npx nx typecheck-specs feat-shared-bacteria-engine` and
  `npx nx test feat-shared-bacteria-engine` pass.
- Mutation check by hand: multiply `MatchEngine.weaponCooldown` by
  `cooldownFactor`, see the test fail, revert.

## Task 3: commit and PR

- `npx nx format:write` (oxfmt at the locked version),
  `npx nx affected -t lint,lint-templates`.
- One commit `test(feat-shared-bacteria-engine): type-check the engine's specs and fix the boss cooldown test`
  with spec and plan. PR to `main` with `Closes #2803`.
