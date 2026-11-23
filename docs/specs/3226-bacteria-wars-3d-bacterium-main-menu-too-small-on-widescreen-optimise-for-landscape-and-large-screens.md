# Spec: the bacterium menu on widescreen and landscape ([#3226](https://github.com/WolfSoko/wol-sok-mono/issues/3226))

## Goal

On a large landscape screen the 3D bacterium of the main menu is the
menu's centrepiece: it takes the empty middle of the screen between the
hero (title, tagline, banners, utility tiles) and the player's card,
and grows with the screen until the height runs out. On a landscape
phone it fits the height instead of running off the screen. Its part
labels grow with it, so they stay readable on a large cell.

Today (screenshot of the issue, about 3750 x 1825 px) the bacterium sits
in the hero's column, capped at `max-width: 34rem` (544 px), and the
middle of the screen stays empty.

## Non-goals

- No change to the bacterium's shader, look, anchors, items or where
  they lead, nor to the card or the utility tiles' content.
- No change to the portrait and phone layouts beyond fitting the cell
  into the height (they keep the hero, then the card under it).
- No change to the menu's template structure where PR
  [#3225](https://github.com/WolfSoko/wol-sok-mono/pull/3225) (#3210) rewrites it:
  that PR removes `showsBacterium`, the play buttons and the action tiles
  from `main-menu.component.{html,scss}`. This change touches only the
  layout rules (`.layout`, `.hero`, `.bacterium`, `.card`, a new media
  block) of `main-menu.component.scss`, and the bacterium's own files, so
  the two merge without conflicts whichever lands first.

## Decisions

- **A three-column grid on wide landscape screens, by CSS alone.** From
  `(min-width: 100rem) and (min-aspect-ratio: 4/3)` the `.layout` becomes a
  grid `hero | stage | card` and the hero becomes `display: contents`, so
  its children stay in the first column while `.bacterium` is placed in the
  middle column across every row. The template stays as it is: the DOM order
  (and so the reading and tab order: title, banners, bacterium, tiles,
  card) does not change, and PR #3225's template edits do not collide.
  Below 100rem (1600 px) the middle column would be narrower than the
  hero's 30rem the cell has today, so the current layout stays.
- **The cell is sized by the space, not a fixed cap.** In the wide grid the
  box is `width: min(100%, (100dvh - room) * 4 / 3)`: as wide as its column
  allows and no higher than the screen less the paddings, centred both ways.
  So at 1920 x 1080 it is about 900 px wide instead of 544 px, at the
  issue's 3750 x 1825 about 2000 px.
- **A landscape phone fits the cell into the height.** In the existing
  `(max-height: 30rem)` block the box gets the same `min(100%, height * 4/3)`
  width rule, so it no longer pushes the tiles below the fold.
- **Labels grow with the cell.** The parts' font sizes are in `rem` and
  look tiny on a 2000 px cell. A container query of the bacterium
  (`@container (min-width: 44rem)`) scales the `.spot` font with the box
  (`clamp(...)` on `cqw`), the counterpart of the existing small-screen
  query.
- **The GPU cost stays where it is.** The canvas' drawing buffer is CSS
  size times `min(devicePixelRatio, 1.5)`. A larger box would multiply the
  shader's per-pixel work every frame (at 30 fps). The renderer caps the
  buffer at the pixel count of today's largest box (544 x 408 CSS px at
  scale 1.5, about 500 000 pixels) by lowering the scale; the browser
  scales the canvas up, which the soft, glowing cell takes without visible
  loss. A spec of the renderer's sizing covers the cap.

## Acceptance

1. At 1920 x 1080 and at 3750 x 1825 the bacterium stands in the middle
   between the hero and the card, larger than today's 544 px (at least
   800 px wide at 1920 x 1080), fully on screen without scrolling.
2. At 1280 x 720 and 1440 x 900 the layout is as today (hero with the cell,
   the card beside it).
3. On a landscape phone (844 x 390) the cell fits into the screen's
   height.
4. Portrait phone (390 x 844) unchanged.
5. The parts' labels grow on a large cell, and keep their size below 44rem.
6. The drawing buffer never exceeds the pixel budget; the renderer's spec
   covers it (a large box at DPR 2 is drawn at a lower scale, a small one
   as before).
7. The DOM order of the main menu is unchanged; the menu's specs pass.
8. Tests, lint, `lint-templates`, `typecheck-specs` of the game lib pass;
   `bacteria-game-remote`'s production build holds its budgets.

## Open questions

- None blocking. The 100rem breakpoint is a judgement from the column
  widths; the screenshots in the PR show the steps around it.
