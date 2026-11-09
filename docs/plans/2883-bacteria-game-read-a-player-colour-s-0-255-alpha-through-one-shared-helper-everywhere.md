# Plan #2883: one reading of a player colour's alpha

Spec: [docs/specs/2883-bacteria-game-read-a-player-colour-s-0-255-alpha-through-one-shared-helper-everywhere.md](../specs/2883-bacteria-game-read-a-player-colour-s-0-255-alpha-through-one-shared-helper-everywhere.md)

## Task 1: `player-color.ts` with `splitColor` and `cssColor`

- Tests first: `libs/features/lazy/bacteria-game/src/lib/player-color.spec.ts`
  (acceptance 2: the `splitColor` tests move from `arena/arena-painter.spec.ts`,
  plus `cssColor`).
- `player-color.ts`: `SplitColor`, `splitColor`, `cssColor`; drop them from
  `arena/arena-painter.ts`; `canvas-cursors.ts` and `gl/shape-batch.ts` import
  from the new module, `canvas-cursors.ts` through `cssColor`.

## Task 2: scoreboard and GL colony layer on the helper

- Test first: `colony-stats.spec.ts` (acceptance 1).
- `colony-stats.ts`: `css: cssColor(player.color)`.
- `arena/gl/gl-arena-painter.ts`: colony layer uniforms from `splitColor`.
- Fixtures in `boost-pad.component.spec.ts` and `touch-pads.component.spec.ts`
  to `rgba(255,100,20,1)`.

## Task 3: `CursorShape.color` as a tuple

- `arena/arena-painter.ts`: `color: Readonly<PlayerColorArray>`; fix spec
  fixtures the type now refuses; check acceptance 5 by hand.

## Task 4: checks, commit and PR

- `npx nx test feat-lazy-bacteria-game`,
  `npx nx run feat-lazy-bacteria-game:typecheck-specs`,
  `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
- One commit
  `fix(feat-lazy-bacteria-game): read a player colour's alpha through one shared helper`
  with spec and plan; PR to `main` with `Closes #2883`.
