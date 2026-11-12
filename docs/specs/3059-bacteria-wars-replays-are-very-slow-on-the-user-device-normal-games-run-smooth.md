# 3059 — Bacteria Wars: replays are very slow on the user device, normal games run smooth

Issue: [#3059](https://github.com/WolfSoko/wol-sok-mono/issues/3059)

## Cause

Daily ranked attempts play only the `gpu-int` ruleset, and the gallery
(`/replays`, "Matches of the day" in the main menu) features the day's best of
them. Its replays open in `/watch/{publicId}` (`WatchPageComponent`), which
passes no `gpu` to `ReplayViewerComponent`. A `gpu-int` replay there always
plays on `IntSimulation`, the TypeScript twin of the integer shaders on the
CPU: about 6 to 9 times slower per tick than the `cpu` ruleset
(`BacteriaSimulation`), as measured in [#2705](https://github.com/WolfSoko/wol-sok-mono/pull/2705).
The arena view caps each frame at three ticks' worth of time (`MAX_FRAME_MS`),
so playback slows down rather than piling up ticks.

A normal game on the same device plays the float GPU passes (or, with a trusted
GPU, the integer ones), so it runs smoothly.

This is not a regression of #2705. That PR moved `gpu-int` replays onto the GPU
in "My matches" and after a match, and left `/watch` on the CPU on purpose,
because `/watch` runs no self-test and loads no `DeviceStorage`.

## Goal

A `gpu-int` replay opened in `/watch` plays on the viewer's GPU wherever the
device's GPU passed the deterministic self-test, as it already does in
"My matches". It then runs as smoothly as a normal game.

## Non-goals

- Making `IntSimulation` itself faster (CPU fallback for untrusted GPUs).
- Snapshots for faster backward seeking.
- Analytics on `/watch` (the narrow entry stays free of it).
- Changing how the game itself runs or stores the self-test.

## Decisions

1. **`/watch` reads the stored verdict of the game's self-test** from the
   device's local storage (`bacteria-game.gpu-self-test`), through
   `@wolsok/utils-browser-storage` (coding rule 11), not through `DeviceStorage`.
   The watch entry stays free of the storage backends (oxlint override for the
   watch entry). The page is served from the game's own origin, so a device
   that played the game has the verdict already.
2. **Without a verdict that still holds, `/watch` runs the self-test itself**
   once the browser idles, and stores the result under the same key and in the
   same shape as `GpuSelfTestService`. A first-time visitor from the gallery
   gets GPU playback too, and the game later reuses the result. Until the
   verdict is there the replay plays on the CPU, and `ReplayScene.useGpu`
   moves it onto the GPU where it was, as in "My matches". The test runs only
   for a `gpu-int` replay.
3. **The stored self-test's shape and rules move into a storage-free module**
   (`gl/stored-self-test.ts`: key, record, parser, `storedResultHolds`, the
   device, the record built from a result). `GpuSelfTestService` and the watch
   page share it, so the two cannot drift apart.
4. **The viewer shows where the war runs** (the manager's condition on
   approving this spec): a small "GPU" or "CPU" badge among the controls,
   with a title that says a CPU replay plays slower. So a slow replay tells
   why, and the real-device check can see the GPU path at work.
5. **Trust stays as it is:** `gpuTrusted(verdict)` (passed, on hardware), and
   the viewer plays on its painter only where the painter's renderer equals the
   trusted one.

## Acceptance

1. On `/watch`, with a stored verdict that holds and passes on hardware, the
   viewer gets that renderer as `gpu`, so a `gpu-int` replay plays on the GPU
   (spec on the watch page's GPU source).
2. A stored verdict that failed, ran on a software renderer, is older than
   `SELF_TEST_MAX_AGE_MS`, or belongs to another browser, test version or
   balance gives no `gpu` (spec).
3. Without a usable stored verdict, the self-test runs once on idle for a
   `gpu-int` replay, its result is stored as `GpuSelfTestService` stores it, and
   a passing result gives the renderer (spec). A `cpu` replay runs no test.
4. `GpuSelfTestService` behaves as before (its specs stay green).
5. The watch entry still imports no storage backend, Firebase or analytics
   (`nx lint feat-lazy-bacteria-game` with the watch override).
6. `bacteria-game-remote` production build passes its budgets and
   `check-lazy-admin`.
7. The replay viewer shows "GPU" while a replay plays on the GPU and "CPU"
   otherwise, also after a fall back or a lost context (spec).
8. Manual check on a real device (CI has no GPU): open a gallery replay in
   `/watch`, it plays smoothly at 1× and 4×.

## Open questions

- If the owner's GPU fails the self-test, gallery replays stay on the CPU and
  stay slow; only a faster `IntSimulation` would help there (separate ticket).
