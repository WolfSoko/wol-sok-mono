# Spec: the bacterium menu on widescreen and landscape ([#3226](https://github.com/WolfSoko/wol-sok-mono/issues/3226))

## Goal

On a large landscape screen the 3D bacterium of the main menu is the
menu's centrepiece: it takes the empty middle of the screen between the
hero (title, tagline, banners, utility tiles) and the player's card,
and grows with the screen until the height runs out. Its part labels
grow with it, so they stay readable on a large cell.

Today (screenshot of the issue, about 3750 x 1825 px) the bacterium sits
in the hero's column, capped at `max-width: 34rem` (544 px), and the
middle of the screen stays empty.

## Non-goals

- No change to the bacterium's shader, look, anchors, items or where
  they lead, nor to the card or the utility tiles' content.
- No change to the portrait and phone layouts, the landscape phone
  included (see Decisions).
- No change to the menu's template structure where PR
  [#3225](https://github.com/WolfSoko/wol-sok-mono/pull/3225) (#3210) rewrites it:
  that PR removes `showsBacterium`, the play buttons and the action tiles
  from `main-menu.component.{html,scss}`. This change touches only the
  layout rules (`.layout`, `.hero`, `.bacterium`, `.card`, a new media
  block) of `main-menu.component.scss`, and the bacterium's own files, so
  the two merge without conflicts whichever lands first.

## Decisions

- **Positioned in the middle on wide landscape screens, by CSS alone.**
  From a container query on the menu's own box (`:host` is the size
  container `main-menu`; the stage gives it its height), `(min-width: 92rem)
  and (min-height: 40rem) and (min-aspect-ratio: 4/3)`,
  hero and card take fixed widths at the layout's two ends, and `.bacterium`
  is positioned absolutely in the middle between them (`.layout` is its
  containing block). The template stays as it is: the
  DOM order (and so the reading and tab order: title, banners, bacterium,
  tiles, card) does not change, and PR #3225's template edits do not
  collide. A grid with a `display: contents` hero was considered: a cell
  spanning the hero's rows stretches them and spreads the title, banners
  and tiles apart. The menu's box, not the viewport, decides: inside the
  shell a sidenav takes up to 320 px. Below 92rem of content the middle
  (less hero, card and gaps, 61rem) would be narrower than
  the hero's 30rem the cell has today, so the current layout stays.
- **The cell is sized by the space, not a fixed cap.** In the wide layout
  the box is `width: min(middle, 90cqh * 4 / 3)`: as wide as the middle
  allows and at most 90% of the menu's height, centred both ways.
  So at 1920 x 1080 it is about 900 px wide instead of 544 px, at the
  issue's 3750 x 1825 about 2000 px.
- **A landscape phone keeps today's cell.** Fitting the cell into an
  844 x 390 screen's height shrank it to about 330 px, where its labels
  (the small-container style below 26rem) cover most of it, and the game's
  stage is at least 30rem high there, so the menu scrolls either way. The
  hero's width (about 450 px) suits it better.
- **Labels grow with the cell.** The parts' font sizes are in `rem` and
  look tiny on a 2000 px cell. A container query of the bacterium
  (`@container (min-width: 44rem)`) scales the `.spot` font with the box
  (`clamp(<size below>, Ncqw, <cap>)`, so no label shrinks past the
  threshold), the counterpart of the existing small-screen
  query.
- **The GPU cost has a cap.** The canvas' drawing buffer is CSS size
  times `min(devicePixelRatio, 1.5)`; a larger box multiplies the shader's
  per-pixel work every frame (at 30 fps). `drawingBufferSize` caps it at
  `MAX_BUFFER_PIXELS` (3.5 million) by lowering the scale. The first
  choice, today's largest buffer (about 500 000), drew the 3750 x 1825 cell
  at scale 0.8 and its membrane's edge showed steps in the screenshot, so
  the budget is the pixel count that still draws that cell at scale 1
  (about 2036 x 1527), as the approval asked. It bounds a 5K screen's cell;
  a spec covers the sizing.

## Acceptance

1. At 1920 x 1080 and at 3750 x 1825 the bacterium stands in the middle
   between the hero and the card, larger than today's 544 px (at least
   800 px wide at 1920 x 1080), fully on screen without scrolling.
2. At 1280 x 720 and 1440 x 900 (and wherever the menu's box is
   narrower than 92rem, the shell with its sidenav included) the layout is
   as today (hero with the cell,
   the card beside it).
3. Landscape phone (844 x 390) and portrait phone (390 x 844) unchanged.
4. At 3750 x 1825 the cell is drawn at one device pixel a CSS pixel, its
   edge without steps.
5. The parts' labels grow on a large cell, and keep their size below 44rem.
6. The drawing buffer never exceeds the pixel budget; the renderer's spec
   covers it (a large box at DPR 2 is drawn at a lower scale, a small one
   as before).
7. The DOM order of the main menu is unchanged; the menu's specs pass.
8. Tests, lint, `lint-templates`, `typecheck-specs` of the game lib pass;
   `bacteria-game-remote`'s production build holds its budgets.

## Open questions

- None blocking. The 92rem breakpoint is a judgement from the column
  widths; the screenshots in the PR show the steps around it.
