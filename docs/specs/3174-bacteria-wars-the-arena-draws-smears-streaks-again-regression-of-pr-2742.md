# Spec: Bacteria Wars draws smears over the arena again (#3174)

Issue: [#3174](https://github.com/WolfSoko/wol-sok-mono/issues/3174). Earlier case: [#2742](https://github.com/WolfSoko/wol-sok-mono/pull/2742).

## Goal

The arena stops drawing lasting smears on the GPU painter of the affected Android phone, and the next report like this one carries enough data to name the cause instead of guessing it.

## What is known

- The owner's screenshot (Android, Daily level "Gläserne Schanze", GPU int 320×180, 60 FPS, 100 % pixels, 1 tick a frame) shows the colonies blown out to white with an orange rim, and dotted orange arcs on the arena-cell grid. They do not fade.
- No smears on any GPU available to the session: SwiftShader, an NVIDIA RTX 3080 Ti, and an Intel Iris Xe through ANGLE on GL and on Vulkan. Those runs covered the Campaign and the same Daily level ("Glassy Redoubt"), the bubbles look, boosts, and adaptive render scales down to 30 %.
- Reading the painter (`gl-arena-painter.ts`) and the GPU cell passes (`gpu-cell-passes.ts`) found no wrong GL state: every pass sets its own blend, scissor, viewport and texture units. The cause is most likely the device's GPU or driver.
- Neither context ever disables `GL_DITHER`, which WebGL leaves on by default. A GPU may then dither what it writes into an 8-bit target. The glow texture of the simulation (`effects`, RGBA8) packs the cell's owner and the glow's owner as integers into its alpha. One step of dither noise changes an owner, so the simulation sees a colony move in all the time, and the glow keeps relighting. The painter's trail and its cells and density targets are RGBA8/RG8 too.

## Decisions

1. **Switch off dithering in every context the game renders with** (owner's decision C, request 1520). It is the one device-dependent gap the code has, and exact output is what the GPU passes and the glow packing assume. It is done in one helper of `gl-utils.ts`, called where the painter and the cell passes set up their resources. That covers the first setup, a new match and a restored context, and the self-test and the cross-check go through the cell passes too. It costs nothing on GPUs that never dithered.
2. **A diagnostic behind `?gldebug`** in the same PR, because the fix is not verified on the device. While it is on:
   - The HUD shows the frame breakdown (as with "Show FPS") and one more line: the WebGL renderer and the GL errors so far, counted per pass ("none" when there are none). On a phone without dev tools a screenshot is then enough.
   - The painter checks `gl.getError()` after each of its passes, and the GPU simulation after its tick. That stalls the GPU's pipeline, so it happens only with the flag.
   - A "Save GL layers" button in the HUD downloads one PNG: the frame's trail, the simulation's glow texture, and each colony's cells and density, stacked with a label each.
   - The flag lasts for the page's session. It is not stored, sends nothing anywhere (no analytics, no Sentry), and the query is taken out of the address as `?sim=` is.
3. The diagnostic lives where its parts belong. Error counting and layer capture are in `feat-bacteria-rendering` (`gl/gl-diagnostics.ts`), reached through one optional `ArenaPainter.diagnose()`, which the Canvas 2D painter does not have. The flag, the HUD line and the download are in the game lib.

## Non-goals

- No change to what the passes compute: the cross-check goldens, `BALANCE_VERSION` and replays stay as they are.
- No guesses beyond dithering at other suspects (trail fade, colony targets, instance buffer). The diagnostic is there to find them.
- No diagnostic for the Canvas 2D painter.

## Acceptance

1. Every context the GL painter and the GPU cell passes set up has `DITHER` off, including after a context restore (unit specs with a fake context).
2. Without `?gldebug` the painter and the simulation never call `getError` (spec).
3. With diagnostics on, an error after a pass is counted under that pass's name, and the report lists each pass with its error name and count (spec of `GlDiagnostics`).
4. The layer capture returns the trail, the glow and each colony's targets with their sizes and pixels, and the stacking puts them one under the other with their labels (specs).
5. `?gldebug` turns the diagnostic on for the session and is dropped from the address; the HUD shows the renderer and error line, and the button downloads the PNG (specs of the flag service and the HUD; a manual run in the browser).
6. A match on `?sim=gpu-int&gldebug` in Chromium shows the line with "none" and saves the PNG (checked by hand, screenshot in the PR).
7. Manual check on the owner's phone after the deploy, per the Performance Gates rule for GL changes: a match with `?gldebug`, then a screenshot of the HUD line, and the PNG if it still smears.

## Open questions

- Is dithering the cause? Only the phone can tell. If the smears stay, the diagnostic's output decides the next fix, in a follow-up step of this issue.
