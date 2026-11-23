# Plan: the bacterium menu on widescreen and landscape ([#3226](https://github.com/WolfSoko/wol-sok-mono/issues/3226))

Spec: [`docs/specs/3226-…`](../specs/3226-bacteria-wars-3d-bacterium-main-menu-too-small-on-widescreen-optimise-for-landscape-and-large-screens.md).
Branch `3226-bacterium-menu-widescreen` off `main`, one PR.

1. **Pixel budget of the renderer** (test first).
   - `menu/bacterium/bacterium-renderer.ts`: extract the buffer size into a
     pure, exported `drawingBufferSize(width, height, scale)` honouring
     `MAX_PIXEL_SCALE` and a new `MAX_BUFFER_PIXELS`; `resize` uses it.
   - the sizing lives in `menu/bacterium/drawing-buffer.ts` with its spec:
     a small box at DPR 2 gets scale 1.5; a 2000 x 1500 box stays within the
     budget and keeps 4:3; the 3750 x 1825 cell at DPR 1 keeps scale 1;
     never below 1 x 1.
   - Commit: `perf(feat-lazy-bacteria-game): cap the bacterium's drawing buffer (#3226)`.
2. **Layout** (CSS).
   - `menu/main-menu.component.scss`: the wide-landscape media block
     (the bacterium positioned in the middle between hero and card, sized
     by the layout's height through `cqh`).
   - `menu/bacterium-menu.component.scss`: `@container (min-width: 44rem)`
     scaling the labels.
   - Check: screenshots with Playwright at 3750x1825, 1920x1080,
     1440x900, 1280x720, 844x390, 390x844 against `main`.
   - Commit: `feat(feat-lazy-bacteria-game): the bacterium fills widescreen (#3226)`.
3. **Checks, PR.** `npx nx format:write`; `npx nx affected --base=origin/main -t lint,lint-templates,test,typecheck-specs`;
   `bacteria-game-remote:build:production` for budgets. PR with
   `Closes #3226`, screenshots, acceptance list.
