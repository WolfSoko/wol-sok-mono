# Plan: Bacteria Wars smears (#3174)

Spec: [docs/specs/3174-…](../specs/3174-bacteria-wars-the-arena-draws-smears-streaks-again-regression-of-pr-2742.md). Each task is test first and is its own commit.

1. **Exact output in every GL context**
   - Files: `libs/features/bacteria-rendering/src/lib/gl/gl-utils.ts` (`useExactOutput(gl)`: `gl.disable(gl.DITHER)`), `arena/gl/gl-arena-painter.ts` (`setup()`), `gl/gpu-cell-passes.ts` (`setup()`).
   - Tests: `gl-utils.spec.ts` (a fake context records the disable), plus a painter spec and a cell-passes spec checking that setup disables dithering, after a restore too.
   - Commit: `fix(feat-bacteria-rendering): switch off dithering in the arena's and the GPU simulation's contexts (#3174)`

2. **`GlDiagnostics`: errors per pass**
   - Files: `gl/gl-diagnostics.ts` (`check(pass)` drains `getError` and counts by pass and error name; `errors()`), exported from the lib's index.
   - Tests: `gl-diagnostics.spec.ts` with a fake `getError` queue.
   - Commit: `feat(feat-bacteria-rendering): count GL errors per pass for a diagnostic (#3174)`

3. **The painter and the simulation report through it**
   - Files: `arena/arena-painter.ts` (optional `diagnose(): PainterDiagnostics`), `gl-arena-painter.ts` (checks after each pass while diagnosing, `renderer()` in the report, `captureLayers()` reading the trail, the last glow texture and each colony's targets through a scratch framebuffer), `gpu-cell-passes.ts` (a check after the tick through the painter's diagnostics, passed with `GpuSimulationOptions`).
   - Tests: the painter spec (no `getError` without diagnosing; a pass's error is counted under its name), `captureLayers` names and sizes with a fake context.
   - Commit: `feat(feat-bacteria-rendering): let the GL painter check its passes and capture its layers (#3174)`

4. **Layer sheet**
   - Files: `gl/layer-sheet.ts` (`stackLayers(layers)`: the layers one under the other, each under a label row, as RGBA with its width and height). The game turns it into a PNG.
   - Tests: `layer-sheet.spec.ts`.
   - Commit: in task 3's commit if it stays small, else its own `feat(feat-bacteria-rendering): …`.

5. **`?gldebug` in the game**
   - Files: game lib `gpu-choice/gl-debug.service.ts` (reads and drops the query once, a session-only signal), `stage/stage-frame.ts` (calls `diagnose()` on the current painter while on, shows the perf breakdown while on, fills a `hudGl` signal each perf window), `hud-bar.component.ts` and its template (the GL line and a "Save GL layers" button), `bacteria-game.component.html` (wiring), texts in `i18n/texts/en|de/stage.ts`.
   - Tests: `gl-debug.service.spec.ts`, the HUD bar spec (line and button only with data), the stage-frame spec where it exists.
   - Commit: `feat(feat-lazy-bacteria-game): a ?gldebug diagnostic with the GL renderer, errors and layers in the HUD (#3174)`

6. **Checks and docs**: format, `nx affected -t lint,lint-templates,test,typecheck-specs,build` for the touched projects, a manual `?sim=gpu-int&gldebug` run in Chromium (screenshot for the PR), and a line on `?gldebug` in `CLAUDE.md` next to the GPU notes if it fits there.
