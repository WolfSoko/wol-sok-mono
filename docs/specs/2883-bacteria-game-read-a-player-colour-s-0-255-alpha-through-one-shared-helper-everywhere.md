# Spec #2883: bacteria-game: read a player colour's 0-255 alpha through one shared helper everywhere

Follow-up of [#2855](https://github.com/WolfSoko/wol-sok-mono/issues/2855) /
PR [#2878](https://github.com/WolfSoko/wol-sok-mono/pull/2878), found in its
review.

## Goal

A player colour is RGBA with its alpha from 0 to 255 (`PlayerColorArray`).
#2855 added `splitColor(color)` (in `arena/arena-painter.ts`), which turns it
into channels and an alpha from 0 to 1, and moved both crosshair painters onto
it. Two readers still read the alpha by hand
(paths below `libs/features/lazy/bacteria-game/src/lib/`):

1. **Scoreboard:** `toColonyStats` in `colony-stats.ts` builds
   `ColonyStats.css` as `` `rgba(${player.color.join(',')})` ``, so the alpha
   0-255 reaches CSS, which expects 0-1 and clamps it to opaque. It is the bug
   of #2855; it doesn't show today only because every player colour is opaque.
   `css` colours the HUD, the boost pad (`--seat-color`) and the touch pads.
2. **GL colony layer:** `paintColonyLayer`'s uniforms in
   `arena/gl/gl-arena-painter.ts` divide `(color[3] ?? 255) / 255` and each
   channel by 255 themselves.
3. **Cursor type:** `CursorShape.color` is typed `readonly number[]`
   although it is always built from a `PlayerColorArray`; a short colour
   compiles.

## Non-goals

- No change to what is drawn or shown for today's opaque colours.
- No change to the engine's `ColonyLayer.color` (`readonly number[]` in
  `libs/features/bacteria-engine`), `SeatColors`, the slime or weapon
  painters' colour parameters: they take opaque RGB and don't read the alpha.
- No other hand-written `/ 255` in the GL code (theme colours, packed tints,
  shaders): those are RGB channels, not a player colour's alpha.

## Decisions

- **The helper moves to its own module, `player-color.ts`** at the lib's
  root, with `SplitColor` and the 0-255 maximum: `colony-stats.ts` is no
  arena code and should not import the painter contract to read a colour.
  `arena-painter.ts` keeps `CursorShape` and its painter helpers and stops
  holding colour code; its importers (`canvas-cursors.ts`,
  `gl/shape-batch.ts`) and the `splitColor` specs move over. No re-export from
  `arena-painter.ts`: one place to import it from.
- **`cssColor(color)` beside it** returns the CSS `rgba()` text of an RGBA
  colour, through `splitColor` and the existing `rgba(rgb, alpha)` of
  `arena/canvas-math.ts`. The scoreboard and the Canvas 2D crosshair both use
  it, so no caller builds the CSS from `splitColor` by hand. The text changes
  from `rgba(255,100,20,255)` to `rgba(255,100,20,1)`: the same colour for an
  opaque one.
- **The GL colony layer takes channels and alpha from `splitColor`**,
  dividing the channels by 255 for `uColor` as before. It has no spec harness
  (no WebGL in Jest); `splitColor`'s spec covers the reading.
- **`CursorShape.color` becomes `Readonly<PlayerColorArray>`** (the engine's
  type). `splitColor` keeps accepting `readonly number[]`, since the engine's
  colony layers hand it that type; a 3-entry colour still counts as opaque.
- Spec fixtures that wrote `css: 'rgba(255,100,20,255)'`
  (`boost-pad.component.spec.ts`, `touch-pads.component.spec.ts`) get the
  valid text `rgba(255,100,20,1)`.

## Acceptance

1. `toColonyStats` gives a translucent player colour (`[0, 0, 255, 51]`) the
   `css` `rgba(0,0,255,0.2)` and an opaque one `rgba(255,100,20,1)`
   (`colony-stats.spec.ts`).
2. `cssColor` and `splitColor` are spec'd in `player-color.spec.ts`
   (opaque, translucent, no alpha); the `splitColor` tests leave
   `arena-painter.spec.ts`.
3. The Canvas 2D crosshair still draws `rgba(0,0,255,0.2)` for a translucent
   cursor (`canvas-cursors.spec.ts`, unchanged).
4. No code under `libs/features/lazy/bacteria-game/src/lib/` reads a player
   colour's alpha other than through `splitColor`: no `color[3]`, no
   `color.join` into `rgba(`.
5. A `CursorShape` with a 3-entry colour fails `typecheck-specs`
   (checked by hand once; not kept as a test).
6. `nx test feat-lazy-bacteria-game`, `typecheck-specs`, lint and format
   pass.

## Open questions

None.
