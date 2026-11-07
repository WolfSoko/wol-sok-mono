# Spec #2833: pushForeground has no geometry tests for unit scaling

From a CodeRabbit nitpick on PR [#2821](https://github.com/WolfSoko/wol-sok-mono/pull/2821)
([#2815](https://github.com/WolfSoko/wol-sok-mono/issues/2815)).

## Goal

`libs/features/lazy/bacteria-game/src/lib/arena/gl/shape-batch.spec.ts` checks
that `pushForeground` scales its geometry by `unit` (cells per base cell), so a
missing or doubled scaling fails a test. Today the spec checks only the shape
kinds and the packed jam colour, always at `unit = 1`, where a missing factor
cannot show.

## Non-goals

- No change to `shape-batch.ts`, `arena-painter.ts` or the GL painter: the
  scaling is correct today; this ticket only pins it.
- No geometry tests for the other `push*` functions (they take no unit).
- No test of the drop's shadow, body or highlight scaling: their sizes come
  from the drop's `radius`, already in cells, and do not depend on `unit`.

## Decisions

- **Assert at `unit = 2` with literal numbers**, worked out by hand from the
  constants (halo `radius + (1.5 + halo) * unit`, bars 13 × 2 base cells
  offset by 6 and 0.5, ring `boostRingRadius * unit` plus a unit of room,
  line `1.5 * unit`). Expected values computed through `crosshairBars` or
  `boostRingRadius` would repeat the code under test and miss a dropped
  factor in either place.
- **Rects as `[x, y, width, height]`, parameters as `p0`, `p1`** read from the
  packed instance, as `pushWeaponMarks`' spec already does. Its local
  `instance(batch, index)` helper moves to the top of the file beside `kinds`,
  so both describes use one helper rather than a copy.
- **Values chosen to be exact in Float32** (integers and halves), so the
  tests use `toEqual` and need no tolerance.

## Acceptance

1. At `unit = 2` the jam halo of a drop at (10, 10) with radius 3 and halo 0.5
   is the square `[3, 3, 14, 14]` (radius 7; 5 at unit 1).
2. At `unit = 2` a crosshair at (50, 50) draws the bars `[38, 49, 26, 4]` and
   `[49, 38, 4, 26]`.
3. At `unit = 2` a boosted crosshair at (90, 50) with half its boost left
   draws a ring in the square `[66, 26, 48, 48]` with radius `p0 = 22` and
   line width `p1 = 3`.
4. Each new assertion fails when `unit` is dropped from its formula in
   `shape-batch.ts` / `arena-painter.ts` (checked by hand, not committed).
5. `npx nx test feat-lazy-bacteria-game`, `typecheck-specs` and lint pass.

## Open questions

None.
