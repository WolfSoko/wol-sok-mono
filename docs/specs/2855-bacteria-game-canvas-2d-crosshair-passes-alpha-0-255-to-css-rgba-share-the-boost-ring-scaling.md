# Spec #2855: bacteria-game: Canvas 2D crosshair passes alpha 0-255 to CSS rgba(); share the boost ring scaling

Follow-up of [#2851](https://github.com/WolfSoko/wol-sok-mono/issues/2851) /
PR [#2853](https://github.com/WolfSoko/wol-sok-mono/pull/2853), found in its
review.

## Goal

Both arena painters draw a crosshair from the same shared numbers:

1. **Colour:** the Canvas 2D painter (`drawCursors` in
   `libs/features/lazy/bacteria-game/src/lib/arena/canvas-cursors.ts`) joins
   all four entries of `CursorShape.color` into `rgba(...)`, so the alpha
   0-255 reaches CSS, which expects 0-1. The GL painter
   (`pushForeground` in `arena/gl/shape-batch.ts`) divides by 255. A
   translucent cursor looks different between the two painters. It does not
   show today only because every player colour is opaque.
2. **Boost ring:** its radius (`boostRingRadius(...) * unit`) and line width
   (`1.5 * unit`) are written out in each painter; `crosshairBars` already
   holds the bars' scaling for both.

## Non-goals

- No change to what is drawn for today's opaque colours, in either painter.
- No change to the GL ring's bounding square (`radius + unit`, room for the
  line): that is the GL painter's own concern.
- No change to `CursorShape.color` (RGBA, alpha 0-255) or to where cursors are
  built.

## Decisions

- **`cursorColor(cursor)` in `arena/arena-painter.ts`**, beside
  `crosshairBars`, returns `{ rgb, alpha }` with the alpha from 0 to 1 (a
  missing alpha counts as opaque, as the GL painter does today). Both painters
  take colour and alpha from it: the Canvas 2D one through the `rgba(rgb,
  alpha)` helper in `canvas-math.ts`, like the rest of its code, the GL one
  as it pushes. One place says what the alpha means, so the painters cannot
  drift apart again.
- **`boostRing(cursor, unit)` in `arena/arena-painter.ts`** returns
  `{ radius, lineWidth }` in arena cells, or `null` without a running boost.
  It replaces `boostRingRadius`, whose only callers are the two painters; its
  spec moves to `boostRing`. Returning `null` puts the "only while the boost
  runs" rule into the shared function too, instead of a check in each painter.
- **Literal expected values worked out by hand**, as the specs of
  [#2851](https://github.com/WolfSoko/wol-sok-mono/issues/2851) do, at
  `unit = 2` for the scaling.

## Acceptance

1. `canvas-cursors.spec.ts`: an opaque cursor `[255, 0, 0, 255]` is drawn in
   `rgba(255,0,0,1)`; a translucent cursor `[0, 0, 255, 51]` fills and strokes
   in `rgba(0,0,255,0.2)`.
2. `gl/shape-batch.spec.ts`: the translucent cursor `[0, 0, 255, 51]` pushes
   its bars and ring with alpha `0.2`.
3. `arena-painter.spec.ts`: `cursorColor` gives `{ rgb: [255, 0, 0], alpha: 1 }`
   for `[255, 0, 0, 255]`, alpha `0.2` for an alpha of 51, and alpha `1` when
   the alpha entry is missing.
4. `arena-painter.spec.ts`: `boostRing` is `null` without a boost; at
   `unit = 1` and a full boost it is `{ radius: 9, lineWidth: 1.5 }`, at no
   boost left radius 13; at `unit = 2` and a quarter left it is
   `{ radius: 24, lineWidth: 3 }`.
5. Both painters take the ring from `boostRing` and the colour from
   `cursorColor`; `boostRingRadius` and the written-out `1.5 * unit` are gone.
   The existing ring and bar specs of both painters
   (`canvas-cursors.spec.ts`, `gl/shape-batch.spec.ts`) pass unchanged apart
   from the colour strings of acceptance 1.
6. `npx nx test feat-lazy-bacteria-game`, `typecheck-specs`, lint and format
   are green.

## Open questions

None.
