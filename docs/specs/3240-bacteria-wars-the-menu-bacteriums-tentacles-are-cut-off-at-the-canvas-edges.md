# #3240 Bacteria Wars: the menu bacterium's tentacles are cut off at the canvas edges

## Goal

The main menu's bacterium is drawn whole: its flagella and its glow fade out
into the menu, and no edge of the canvas shows, on a wide desktop screen as
on a phone.

## Cause

The cell's canvas fills exactly the 4:3 box its buttons are laid out in. In
the shader's units that box reaches 4/3 ≈ 1.33 to each side, but the flagella
reach 1.06 + 0.29 = 1.35 from the centre, and the halo (`uGlow`) another 0.3
beyond the membrane. So the flagella's tips and the glow end in a straight
line at the canvas's left and right edges. #3229 made the box large on
widescreen, which made that edge plain to see. Behind the canvas's edge a
second cut showed once the canvas was larger: each flagellum's distance
field ends in a slab at x = 1.35 at nearly its full width, a blunt end.

## Decisions

- **The canvas bleeds out of the box** by `CELL_BLEED` (0.15 of the box on
  each side, so 1.3 times its size, still 4:3). The box, the anchors and the
  buttons stay as they are, and the shader keeps its units: `vUv` is scaled
  by `CELL_SCALE` (1 + 2 x bleed), so a point of the cell lies where it did.
  Its reach is then 1.73 x 1.3 units, past the flagella and the glow. One
  constant in TypeScript drives the shader and, through the host's
  `--cell-bleed`, the canvas's position and size, so the two cannot drift
  apart.
- **Each flagellum thins to a point** over the last 30 % of its length, so
  it ends in a tip rather than the slab's cut.
- **The rays start just in front of the cell** (z 0.8 rather than 2, the
  cell stays within 0.62 of the box's plane): the same picture in an
  orthographic view, with fewer steps for a ray that misses, which pays
  for most of the bleed's pixels.
- **The canvas fades out over its last 8 %** in the shader: whatever a later
  look draws farther out never ends in a hard line.
- **The canvas takes no pointer events**: it overlaps the hero, the tiles and
  the card now, and is decoration only.
- **The main menu clips horizontal overflow** (`overflow-x: hidden`): on a
  phone the box fills the width, and the bleed must not make the screen
  scroll sideways. In the wide layout of #3226 the box is centred at 90 %
  of the menu's height, so its canvas reaches past the layout: there the
  layout clips it vertically (`overflow-y: clip`, no scroll container) at
  the screen's padding (`overflow-clip-margin`), where nothing of the cell
  is drawn any more. Vertically the screen scrolls as before.
- **The pixel budget is for the box, as before**: the canvas's budget grows
  by `CELL_SCALE²`, so the cell keeps the sharpness #3226 gave it. The pixels
  outside the cell miss it within a few raymarch steps.

## Non-goals

- No change to the cell's shape (but the flagella's tips), its look by XP,
  the anchors or the CSS fallback cell.
- No change to the widescreen layout of #3226.

## Acceptance

1. On a wide desktop screen (2560 x 1340) with a high-rank look (flagella),
   the flagella end inside the canvas, and no straight edge of the canvas
   shows (screenshots before and after in the PR).
2. The buttons sit on their lobes as before; hero, tiles and card stay
   clickable where the canvas overlaps them.
3. On a phone (390 x 844) the main menu does not scroll sideways.
4. The drawing buffer of a canvas holds the box's budget times `CELL_SCALE²`
   (unit test).
5. The cell's draw time grows by no more than about a quarter on the wide
   screen (measured on a real GPU, before and after, in the PR).
6. Lint, tests and the spec typecheck of `feat-lazy-bacteria-game` pass.

## Open questions

None.
