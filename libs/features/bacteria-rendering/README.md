# feat-bacteria-rendering

The arena rendering and the GPU simulation of Bacteria Wars, split out of
`feat-lazy-bacteria-game` (#3102):

- `src/lib/arena/`: the painters (canvas and WebGL), the camera, the minimap,
  the weapon effects and the menu's previews (`ArenaViewComponent`,
  `LookPreviewComponent`).
- `src/lib/gl/`: the GPU simulation (`gpuSimulation`, the cell passes and
  their shaders), the renderer and the on-device self-test.
- `gpu-crosscheck/` with `playwright.config.ts`: the integer shaders on
  SwiftShader against the engine's reference (ADR 0015), inferred as this
  project's `e2e-ci--*` target.

It depends only on `@wolsok/feat-shared-bacteria-engine`, Angular and RxJS
(tag `feature:game-kit`), and the game takes it only through
`@wolsok/feat-bacteria-rendering` (`src/index.ts`). The game lib's `CLAUDE.md`
and `README.md` describe how the painters and the GPU simulation work.

A change here has no CI coverage on a real GPU: check it on a device.
