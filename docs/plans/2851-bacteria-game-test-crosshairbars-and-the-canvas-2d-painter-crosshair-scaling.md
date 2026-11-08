# Plan #2851: test crosshairBars and the Canvas 2D painter crosshair scaling

Spec: [docs/specs/2851-…](../specs/2851-bacteria-game-test-crosshairbars-and-the-canvas-2d-painter-crosshair-scaling.md)

## Task 1: spec for crosshairBars and boostRingRadius

- New file: `libs/features/lazy/bacteria-game/src/lib/arena/arena-painter.spec.ts`.
- Tests: acceptance 1 and 2, literal values.
- The code is correct already: show each scaling test red by dropping `unit`
  locally, then restore (acceptance 5).

## Task 2: extract and test the Canvas 2D crosshairs

- New `arena/canvas-cursors.spec.ts` first (red until the function exists):
  a recording 2D context; acceptance 3 and 4.
- New `arena/canvas-cursors.ts` with `drawCursors(cx, cursors, unit)`, the
  body of today's private `CanvasArenaPainter.drawCursors`;
  `canvas-arena-painter.ts` calls it and drops the private method and the
  imports it no longer needs.

## Task 3: checks and commit

- `npx nx test feat-lazy-bacteria-game`,
  `npx nx run feat-lazy-bacteria-game:typecheck-specs`,
  `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
- One commit `test(feat-lazy-bacteria-game): pin the crosshair scaling of both painters`
  with spec and plan; PR to `main` with `Closes #2851`.
