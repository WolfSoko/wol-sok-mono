# Plan: Bacteria Wars smears, step 2 (#3174)

Spec: [docs/specs/3174-step-2-…](../specs/3174-step-2-box-quads-and-admin-gl-debug.md). Each task is test first and is its own commit.

1. **`BOX_VERTEX` and `canvasBox`**
   - Files: `libs/features/bacteria-rendering/src/lib/gl/gl-utils.ts` (`BOX_VERTEX`, `clipBox(rect, width, height)`), `arena/gl/canvas-box.ts` (`canvasBox(cellBox, view, renderWidth, renderHeight)`, out of `scissorCanvas`).
   - Tests: `canvas-box.spec.ts` (inside, cut, fractional scale, out of view), `gl-utils.spec.ts` (`clipBox`).
2. **The colony and glow passes draw their box**
   - Files: `gl-arena-painter.ts` (`colony` and `effects` programs on `BOX_VERTEX` with `uBox`; `drawColony`/`drawEffects` set it instead of the scissor; `scissorCanvas` goes).
   - Tests: painter spec: no `SCISSOR_TEST` around those draws, `uBox` set, no draw for a box out of view.
   - Commit: `fix(feat-bacteria-rendering): draw the colony and glow passes as quads of their box, not scissored (#3174)`
3. **`stop()` on the diagnostics**
   - Files: `gl/gl-diagnostics.ts` (`undiagnose(gl)`), `arena/arena-painter.ts` (`PainterDiagnostics.stop`), `gl-arena-painter.ts`.
   - Tests: `gl-diagnostics.spec.ts`, painter spec (no `getError` after `stop`).
4. **The owner's switch**
   - Files: game lib `settings/setting-table.ts` (`glDebug`), `gl-debug/gl-debug.service.ts` (`on` = query flag or owner and setting), `stage/stage-frame.ts` (diagnose or stop when `on` changes), `menu/settings.component.*` (the toggle under `owner()`), texts `i18n/texts/en|de/settings.ts`, `CLAUDE.md` of the game lib (the `?gldebug` note).
   - Tests: `gl-debug.service.spec.ts`, settings component spec, stage-frame spec.
   - Commit: `feat(feat-lazy-bacteria-game): let the owner switch the GL diagnostic on in the settings (#3174)`
5. **Checks**: format, `nx affected -t lint,lint-templates,test,typecheck-specs,build`, the GPU cross-check e2e locally, a manual `?sim=gpu-int` run in Chromium with a screenshot for the PR.
