# Spec: the arena's trail no longer depends on a kept render target (#3231)

Issue: [#3231](https://github.com/WolfSoko/wol-sok-mono/issues/3231), related [#3174](https://github.com/WolfSoko/wol-sok-mono/issues/3174).

## Finding

The owner sees smears in the arena, apparently after the browser went into power-save mode. Reproduced on headless Chromium with SwiftShader (`?sim=gpu-int&gldebug`, campaign level 1):

- a forced context loss and restore (`WEBGL_lose_context`) mid-match: painter and simulation rebuild, the war restarts, the only GL error is the expected `CONTEXT_LOST_WEBGL` once;
- a 20 s frozen page (CDP `Page.setWebLifecycleState`);
- the frame rate halved to 30 fps, as power savers do.

All three paint cleanly. The owner's screenshot (#3174) shows the trail not fading in large blocks with a hard horizontal edge, kept arcs of the crosshair ring and glow adding up to white, at 0:08 of a match, so the state survives into new matches until a reload. That is the content of the kept trail target coming back wrongly on a tiled mobile GPU, the class #3184 worked around for scissored passes. The painter still depends on that content every frame: it blends the floor at 70 % over the trail framebuffer, which the driver has to load from the last frame.

## Goal

No pass of the arena painter reads a render target's earlier content through blending. The trail lives in two targets used in turn: each frame's floor pass samples the last frame as a texture and writes every pixel of the other target unblended; the rest of the frame draws on top of it, as now.

## Non-goals

- The GPU simulation's own kept targets (state, glow, report): they are not blended over; a capture decides whether they need work.
- The menu bacterium's and other canvases' context loss.
- Visibility handling of the frame loop: the long pause paints correctly.

## Decisions

- **Ping-pong over invalidation alone**: `invalidateFramebuffer` only hints; sampling the last frame makes the result independent of what the driver keeps. (The owner's decision, option C on request 1632.)
- **The floor shader composes the trail**: `uPrevious` is read with `texelFetch` at `gl_FragCoord`, one texel per pixel, since both targets have the render size. Output `rgb = floor + previous * (1 - alpha)`, `a = 1`: the same as the blend `ONE, ONE_MINUS_SRC_ALPHA` did, so the look is unchanged. A cleared or fresh frame keeps `uAlpha = 1`, which leaves nothing of the last one.
- **No feedback loop**: the last frame is sampled on a texture unit of its own and unbound right after the floor pass, so the texture of the target being drawn into is never bound for sampling, after a render-scale change and a context restore included.
- **The new target is invalidated after it is bound**: its old content is never needed, which spares tiled GPUs a load.
- **Cost**: one more render-size RGBA8 target (at most the canvas, smaller under adaptive quality).

## Acceptance

1. The floor pass draws into the target the last frame was not built in, unblended, sampling the last frame's target.
2. Frames alternate between the two targets; `showLastFrame`, the diagnostic's `trail` layer and a render-scale change take the last finished frame.
3. A new floor (`uploadFloor`) and a context restore leave nothing of the old frame.
4. The arena looks as before on SwiftShader (no smear, the trail still fades) with `?sim=gpu-int`.
5. Specs, lint and typecheck of `feat-bacteria-rendering` pass; the GPU cross-check is untouched.
6. The PR notes a manual check on the owner's phone after power save; if smears remain, the owner sends a `?gldebug` "Save GL layers" capture.

## Open questions

None.
