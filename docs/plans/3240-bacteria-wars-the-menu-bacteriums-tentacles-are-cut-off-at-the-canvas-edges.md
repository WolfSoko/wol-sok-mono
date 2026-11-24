# Plan: #3240 the menu bacterium's tentacles are cut off

Spec: `docs/specs/3240-bacteria-wars-the-menu-bacteriums-tentacles-are-cut-off-at-the-canvas-edges.md`.

1. **Bleed constant and buffer budget** — `bacterium/drawing-buffer.ts`:
   `CELL_BLEED`, `CELL_SCALE`; the budget per canvas is the box's
   (`MAX_BUFFER_PIXELS`) times `CELL_SCALE²`. Test first in
   `drawing-buffer.spec.ts`.
2. **Shader** — `bacterium/bacterium-shader.ts`: scale `vUv` by `CELL_SCALE`
   (interpolated like `MAX_LOBES`), fade the colour over the canvas's last
   8 %, thin each flagellum to a point, start the rays at z 0.8. Spec: the
   fragment source carries the scale and the fade.
3. **Canvas and menu** — `bacterium-menu.component.{ts,html,scss}`: the
   canvas's inline `inset` from `CELL_BLEED`, `pointer-events: none`;
   `main-menu.component.scss`: `overflow-x: hidden`. Spec in
   `bacterium-menu.component.spec.ts`: the canvas bleeds by `CELL_BLEED`.
4. **Check** — screenshots on 2560 x 1340 before and after (real GPU),
   phone width without sideways scroll, the draw time before and after; lint, test, typecheck-specs.

One commit `fix(feat-lazy-bacteria-game): ...` with spec, plan and code (or
docs first), one PR `Closes #3240`.
