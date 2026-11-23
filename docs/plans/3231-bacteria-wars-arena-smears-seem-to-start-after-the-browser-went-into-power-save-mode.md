# Plan: ping-pong trail (#3231)

Spec: [docs/specs/3231-…](../specs/3231-bacteria-wars-arena-smears-seem-to-start-after-the-browser-went-into-power-save-mode.md)

1. **Spec first** — `libs/features/bacteria-rendering/src/lib/arena/gl/gl-arena-painter.spec.ts`: on the fake context, two frames draw their floor into different framebuffers with blending off, each sampling the other's texture; `showLastFrame` samples the last one drawn into. Red.
2. **Two trail targets** — `gl-arena-painter.ts`: `Resources.trail` (last finished frame) and `Resources.next`; `setup` makes both; `paint` binds `next`, invalidates it, draws the floor unblended with `uPrevious` = `trail`, swaps at the end; `setRenderScale` scales the finished one and makes `next` at the new size; `uploadFloor` clears the finished one; `captureLayers` reads it. `shaders.ts`: `FLOOR_FRAGMENT` composes the previous frame. Green; commit `fix(feat-bacteria-rendering): build each arena frame from the last one as a texture (#3231)`.
3. **Check** — `nx test/lint/typecheck-specs feat-bacteria-rendering`, `nx affected -t lint,lint-templates`, `nx format:write`; the repro script on SwiftShader (loss/restore, freeze, 30 fps) and a look at the trail.
4. **PR** with spec, plan and code, `Closes #3231`; manual check on a phone noted.
