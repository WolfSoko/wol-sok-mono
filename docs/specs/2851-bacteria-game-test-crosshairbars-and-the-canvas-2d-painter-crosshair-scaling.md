# Spec #2851: bacteria-game: test crosshairBars and the Canvas 2D painter crosshair scaling

Follow-up of [#2833](https://github.com/WolfSoko/wol-sok-mono/issues/2833) /
PR [#2844](https://github.com/WolfSoko/wol-sok-mono/pull/2844), found by
`/simplify` on that PR.

## Goal

The crosshair's unit scaling is pinned for both arena painters, not only the
GL one:

- `crosshairBars` (`libs/features/lazy/bacteria-game/src/lib/arena/arena-painter.ts`),
  which both painters draw their bars from, has a spec of its own.
- The Canvas 2D painter's crosshairs (bars and boost ring, today the private
  `CanvasArenaPainter.drawCursors`) are checked at `unit = 2`, so a dropped or
  doubled `unit` in its ring radius or line width fails a test.

## Non-goals

- No change to what is drawn: the scaling is correct today.
- No tests of the rest of `CanvasArenaPainter.paint` (floor, colonies, jam,
  weapons).
- No change to the GL path or its spec (`gl/shape-batch.spec.ts`), already
  pinned by [#2833](https://github.com/WolfSoko/wol-sok-mono/issues/2833).

## Decisions

- **Extract the Canvas 2D crosshair drawing into a function of its own**,
  `drawCursors(cx, cursors, unit)` in `arena/canvas-cursors.ts`, as `drawJam`
  already is (`arena/jam.ts`). `CanvasArenaPainter.paint` calls it. Testing it
  through `paint` would need a floor, colony layers and weapon effects on a
  real canvas only to check four calls; the function needs a recording 2D
  context and nothing else.
- **Assert at `unit = 2` with literal numbers worked out by hand**, as
  [#2833](https://github.com/WolfSoko/wol-sok-mono/issues/2833) does: expected
  values computed through `crosshairBars` or `boostRingRadius` would repeat
  the code under test.
- **Centres off the diagonal and a boost of a quarter**, so swapped
  coordinates and an inverted boost fail too.
- **`boostRingRadius` gets its ends checked in the same spec** (`9` at a full
  boost, `13` at none): both painters' rings rest on it, and it has no test
  either.

## Acceptance

1. `arena-painter.spec.ts`: `crosshairBars({ x: 50, y: 30, … }, 2)` is
   `[{ x: 38, y: 29, width: 26, height: 4 }, { x: 49, y: 18, width: 4, height: 26 }]`;
   at unit 1 the bars are 13 × 2 (`{ x: 44, y: 29.5, width: 13, height: 2 }`
   and `{ x: 49.5, y: 24, width: 2, height: 13 }`).
2. `arena-painter.spec.ts`: `boostRingRadius(1)` is 9, `boostRingRadius(0)`
   is 13, `boostRingRadius(0.25)` is 12.
3. `canvas-cursors.spec.ts`: at `unit = 2` a crosshair at (50, 30) without a
   boost fills exactly the two bars of acceptance 1 in its colour
   (`rgba(255,0,0,255)`) and strokes no ring.
4. `canvas-cursors.spec.ts`: at `unit = 2` a crosshair at (90, 40) with a
   quarter of its boost left strokes one ring `arc(90, 40, 24, 0, 2π)` with
   `lineWidth` 3 in its colour.
5. Each new assertion on scaling fails when `unit` is dropped from its
   formula (checked by hand, not committed).
6. `npx nx test feat-lazy-bacteria-game`, `typecheck-specs`, lint and format
   pass; the Canvas 2D painter makes the same calls as before the extraction.

## Open questions

None.
