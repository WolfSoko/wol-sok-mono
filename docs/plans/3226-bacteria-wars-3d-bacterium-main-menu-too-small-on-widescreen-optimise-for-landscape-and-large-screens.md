# Plan: the bacterium menu on widescreen and landscape ([#3226](https://github.com/WolfSoko/wol-sok-mono/issues/3226))

Spec: [`docs/specs/3226-…`](../specs/3226-bacteria-wars-3d-bacterium-main-menu-too-small-on-widescreen-optimise-for-landscape-and-large-screens.md).
Branch `3226-bacterium-menu-widescreen` off `main`, one PR.

1. **Pixel budget of the renderer** (test first).
   - `menu/bacterium/bacterium-renderer.ts`: extract the buffer size into a
     pure, exported `drawingBufferSize(width, height, scale)` honouring
     `MAX_PIXEL_SCALE` and a new `MAX_BUFFER_PIXELS`; `resize` uses it.
   - Spec `menu/bacterium/bacterium-renderer.spec.ts`: small box at DPR 2
     gets scale 1.5; a 1600 x 1200 box at DPR 2 stays within the budget
     and keeps 4:3; never below 1 x 1.
   - Commit: `perf(feat-lazy-bacteria-game): cap the bacterium's drawing buffer (#3226)`.
2. **Layout** (CSS).
   - `menu/main-menu.component.scss`: the wide-landscape media block
     (grid, `display: contents` hero, `.bacterium` in the middle column
     sized by height), the height rule in the `max-height: 30rem` block.
   - `menu/bacterium-menu.component.scss`: `@container (min-width: 44rem)`
     scaling the labels.
   - Check: screenshots with Playwright at 3750x1825, 1920x1080,
     1440x900, 1280x720, 844x390, 390x844 against `main`.
   - Commit: `feat(feat-lazy-bacteria-game): the bacterium fills widescreen and fits landscape (#3226)`.
3. **Checks, PR.** `npx nx format:write`; `npx nx affected --base=origin/main -t lint,lint-templates,test,typecheck-specs`;
   `bacteria-game-remote:build:production` for budgets. PR with
   `Closes #3226`, screenshots, acceptance list.
