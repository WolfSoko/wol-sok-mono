# Plan #2855: crosshair alpha in Canvas 2D and the shared boost ring

Spec: [docs/specs/2855-bacteria-game-canvas-2d-crosshair-passes-alpha-0-255-to-css-rgba-share-the-boost-ring-scaling.md](../specs/2855-bacteria-game-canvas-2d-crosshair-passes-alpha-0-255-to-css-rgba-share-the-boost-ring-scaling.md)

## Task 1: shared cursorColor and boostRing

- Tests first in `libs/features/lazy/bacteria-game/src/lib/arena/arena-painter.spec.ts`:
  acceptance 3 and 4 (the `boostRingRadius` tests move to `boostRing`).
- `arena/arena-painter.ts`: add `cursorColor(cursor)` and
  `boostRing(cursor, unit)`; drop `boostRingRadius`.

## Task 2: both painters on the shared functions

- Tests first: `arena/canvas-cursors.spec.ts` expects `rgba(…,1)` and adds a
  translucent cursor (acceptance 1); `arena/gl/shape-batch.spec.ts` adds the
  translucent cursor's alpha (acceptance 2).
- `arena/canvas-cursors.ts`: colour through `rgba(rgb, alpha)` from
  `canvas-math.ts`, ring from `boostRing`.
- `arena/gl/shape-batch.ts` `pushForeground`: colour from `cursorColor`,
  ring from `boostRing`.

## Task 3: checks, commit and PR

- `npx nx test feat-lazy-bacteria-game`,
  `npx nx run feat-lazy-bacteria-game:typecheck-specs`,
  `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
- One commit
  `fix(feat-lazy-bacteria-game): share the crosshair colour and boost ring between both painters`
  with spec and plan; PR to `main` with `Closes #2855`.
