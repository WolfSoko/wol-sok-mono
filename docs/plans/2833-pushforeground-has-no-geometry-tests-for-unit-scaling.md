# Plan #2833: pushForeground has no geometry tests for unit scaling

Spec: [docs/specs/2833-…](../specs/2833-pushforeground-has-no-geometry-tests-for-unit-scaling.md)

## Task 1: share the instance helper

- File: `libs/features/lazy/bacteria-game/src/lib/arena/gl/shape-batch.spec.ts`.
- Move `instance(batch, index)` from the `pushWeaponMarks` describe to the
  top of the file beside `kinds`.
- Test: the spec stays green.

## Task 2: geometry tests at unit 2

- Same file, `describe('pushForeground')`: a `DOUBLE_UNIT = 2` constant and
  three tests: the halo square (acceptance 1), the crosshair bars
  (acceptance 2), the boost ring's square, radius and line (acceptance 3).
- Test first in the sense the ticket allows: the code is already correct, so
  each test is shown red by removing `unit` from its formula locally, then
  restored (acceptance 4).

## Task 3: checks and commit

- `npx nx test feat-lazy-bacteria-game --testFile=shape-batch.spec.ts`,
  `npx nx run feat-lazy-bacteria-game:typecheck-specs`,
  `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
- One commit `test(feat-lazy-bacteria-game): pin pushForeground's unit scaling`
  with spec and plan; PR to `main` with `Closes #2833`.
