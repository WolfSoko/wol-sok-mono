# Spec: bacterium parts glow gold while the DNA buys something ([#3227](https://github.com/WolfSoko/wol-sok-mono/issues/3227))

## Goal

The old My Colony and Evolution tiles glowed gold while the player's DNA
could buy something there (`.tile.ready`, the `evolve-ready` pulse).
[#3210](https://github.com/WolfSoko/wol-sok-mono/issues/3210) made the
bacterium the main menu and removed the tiles, so that cue is gone. The
bacterium's parts get it back: the My Colony and Evolution parts, and their
lobes on the cell, glow gold while their DNA buys something.

## Non-goals

- No new cue for friend requests: they keep their count badge, as the
  Friends tile did (it never glowed).
- No change to how the DNA that buys something is counted (`colonyDna`,
  `evolveDna` of the main menu stay as they are).
- No layout change of the cell: that is
  [#3226](https://github.com/WolfSoko/wol-sok-mono/issues/3226).

## Decisions

1. **A `ready` flag on `BacteriumItem`** (`bacterium-items.ts`), set by
   `bacteriumItems` for the parts whose badge counts DNA (colony,
   evolution) while that count is above 0; false for every other part,
   friends included. The rule lives in the pure item model, so it is
   tested there and the component only shows it.
2. **The part's button glows** (`.part.ready .spot`): a gold border and the
   tiles' pulsing gold shadow (1.8 s), built on `--bw-gold`. With reduced
   motion it holds a still gold shadow instead of pulsing.
3. **The lobe glows too.** `BacteriumScene.lobes` carries `ready` per lobe;
   the renderer packs it into the lobe's free fourth component
   (`uLobes[i].w`), and the shader adds a gold light to a ready lobe,
   pulsing with `uTime` (still at time 0, as reduced motion draws). No new
   uniform: the vec4 had a spare slot. The packing becomes a pure,
   exported `packLobes` so it is tested without WebGL. The CSS cell's lobe
   (`.css-lobe.ready`) gets a gold glow likewise.
4. **No new text for screen readers.** The badge already reads "N DNA ready
   to spend"; the glow is decoration.
5. **Conflicts with #3226** stay small: it changes `resize` in the renderer
   and adds a container query at the end of `bacterium-menu.component.scss`;
   this change touches `draw`, the scene's lobes and adds rules next to
   `.count`.

## Acceptance

1. `bacteriumItems` marks colony and evolution `ready` exactly while their
   DNA count is above 0, and never marks another part (spec).
2. The menu sets the class `ready` on the parts that are ready and on their
   CSS lobes, and on nothing else (component spec).
3. The scene handed to the renderer marks the ready lobes, and a change of
   readiness redraws a still cell (component spec).
4. `packLobes` writes x, y, r and 1 or 0 for ready per lobe (spec).
5. The shader compiles: the GPU-free checks do not cover it, so it is
   checked in a real browser (Playwright screenshot of the main menu with
   DNA to spend, WebGL and the CSS cell).
6. Reduced motion: no animation on a ready part.
7. Lint, lint-templates, test and typecheck-specs of `feat-lazy-bacteria-game`
   pass; the production build of `bacteria-game-remote` keeps its budgets.

## Open questions

None.
