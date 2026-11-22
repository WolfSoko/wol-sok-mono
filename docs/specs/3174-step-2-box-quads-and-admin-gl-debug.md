# Spec: Bacteria Wars smears, step 2 - box quads on the frame, and the GL diagnostic in the owner's settings (#3174)

Issue: [#3174](https://github.com/WolfSoko/wol-sok-mono/issues/3174). Step 1: [spec](3174-bacteria-wars-the-arena-draws-smears-streaks-again-regression-of-pr-2742.md), PR [#3182](https://github.com/WolfSoko/wol-sok-mono/pull/3182) (dithering off, `?gldebug`).

## Goal

The arena on the owner's Pixel 8 Pro (Mali GPU, `?sim=gpu-int`) stops keeping old frames inside the colony and glow boxes, and the owner can switch the GL diagnostic on in the game's settings, also in the Android app, where no query can be typed.

## What is known

- Step 1 did not help: with dithering off the phone still smears, and `?gldebug` counted no GL error in any pass (owner, request 1534).
- The phone's layer picture (message 207) shows:
  - the simulation's glow texture fades as it should;
  - each colony's cells and density targets are clean;
  - the frame's trail keeps stale content (cyan crosshair bars stacked over many frames, boost rings, white) inside a rectangle that matches the colony pass's scissor box. The owner's first screenshot has a hard horizontal edge where the glow pass's box ends.
- So the passes compute right, and what goes wrong is how the trail keeps what was drawn into it. The two passes that draw onto the trail scissored are `drawColony` and `drawEffects` (`gl-arena-painter.ts`, `scissorCanvas`). Every other pass on the trail is full-screen (the floor's fade) or instanced quads (shapes, weapons), without a scissor.
- Mali drivers have known bugs with scissored or partial rendering into a kept target, where a tile's previous content comes back (Mozilla bugs 1814344, 1558374, 1809738). Firefox avoids the scissor there. This is the likely cause, but only the phone can confirm it.

## Decisions

1. **The colony and the glow passes draw a quad of their box instead of a scissored full-screen quad.** A vertex shader `BOX_VERTEX` (in `gl-utils.ts`, next to `FULLSCREEN_VERTEX`) maps the shared quad's corners onto a box given as a uniform `uBox` in clip space, and hands the fragment shaders the same `vNdc` as before, so `COLONY_FRAGMENT` and `EFFECTS_FRAGMENT` stay unchanged. The box is today's whole-pixel box out of `scissorCanvas`, turned into a pure function (`canvasBox`) of the cell box, the view and the render size, so the quad covers exactly the pixels the scissor let through. The pixels drawn and their colours stay the same; only how the GPU is told to skip the rest changes. An empty box draws nothing.
2. **The scissor stays where it does no harm**: the passes on the arena grid (the blur and cells targets, `scissorCells`), which the phone's layers show clean, are rewritten every frame and never blended into a kept target.
3. **The GL diagnostic gets a switch in the settings, for the owner only.** A device setting `glDebug` (off by default, not counted by the statistics) appears in Settings → Screen under "Show the frame rate" only while `GameAccount.owner()` is true. The diagnostic runs while `?gldebug` was in the address or while the owner is signed in with the switch on. Switching it on diagnoses the current painter at once; switching it off hides the HUD line and button and ends the per-pass error checks (`PainterDiagnostics.stop()`), so a player who is not the owner never pays for them. Texts in English and German.

## Non-goals

- No change to what any pass computes: goldens, `BALANCE_VERSION` and replays stay.
- No change to the Canvas 2D painter or the GPU simulation's own passes.
- No server-side admin setting: the switch is the device's, the owner check is the token's (as the admin area's link is).

## Acceptance

1. `drawColony` and `drawEffects` never enable `SCISSOR_TEST`; each draws its quad with `uBox` set to the clip-space box of the old scissor rectangle (painter spec with the fake context).
2. `canvasBox` returns the whole-pixel box `scissorCanvas` used: cut to the target, rounded out at a fractional scale, empty for a box out of view (spec).
3. A box out of view draws nothing.
4. The settings show the GL switch only to the owner; with it on, the HUD shows the GL line and the "Save GL layers" button; off, neither (specs of the settings component, `GlDebugService` and the stage frame).
5. `?gldebug` still turns the diagnostic on for the session, owner or not.
6. Manual check in Chromium on `?sim=gpu-int`: the arena looks as before (screenshot in the PR).
7. Manual check on the owner's Pixel 8 Pro after the deploy: a match on `?sim=gpu-int`, the switch on, a screenshot, and the layer PNG if it still smears.

## Open questions

- If the phone still smears, the trail itself is the next suspect (the floor's fade blending a kept RGBA8 target): the next step would then render the trail into two targets in turn instead of keeping one.
