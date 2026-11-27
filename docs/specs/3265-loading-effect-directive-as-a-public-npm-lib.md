# Spec: loading-effect directive as a public npm lib ([#3265](https://github.com/WolfSoko/wol-sok-mono/issues/3265))

## Goal

A published Angular package, `@wolsok/loading-wave`, whose directive lays a
calm loading effect behind any element: a grid of small dots on the
element's background, crossed again and again by a curved wave front that
lights the dots it passes, as in the video attached to the issue. When
loading ends the dots either fade away or stay as a quiet dotted background,
as the user of the directive chooses. Where a GPU is there, a WebGL2 shader
draws a richer wave; without one, a Canvas 2D renderer draws the effect of
the video.

## What the video shows (findings)

`LoadingEffect.mp4` (1714 × 484, 1.5 s, one sweep):

| Part       | Seen                                                                                                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background | near black, untouched by the effect                                                                                                                                                                                                                                         |
| Dot grid   | a square grid, about 30 px pitch, dots of about 1.5 px, light grey at low opacity                                                                                                                                                                                           |
| Wave front | a vertical arc, bulging to the right: part of a circle whose centre lies far left of the element, so the front is a ripple from off-screen                                                                                                                                  |
| Lit dots   | the dots just behind the front are brighter and a bit larger; within two or three columns they dim to an afterglow that the passed dots keep (measured along one row: background 11, front column 75, afterglow 47, dots ahead fading from 38 to 24 towards the right edge) |
| Front line | a hairline along the arc, fainter than the dots                                                                                                                                                                                                                             |
| Motion     | the front sweeps from the left edge to the right edge in about 1.5 s, slowing a little towards the right; the clip shows one sweep, no loop                                                                                                                                 |

## Decisions

1. **A new published lib `libs/public/ws-loading-wave`** (project
   `ws-loading-wave`, package `@wolsok/loading-wave`, tags `shared`,
   `published`, `ui`, selector prefix `ws`, MIT), built with
   `@nx/angular:ng-packagr-lite` and tested with Jest exactly as
   `ws-thanos`. Reason: `ws-thanos` is the workspace's one published Angular
   directive; the same layout keeps `nx release` (`tag:published`), the npm
   leg and the federation skip-list working unchanged. A package without a
   manifest at the last deploy counts as bumped (`bumped-packages.mjs`), so
   the first release publishes it. Peer dependency `@angular/core`
   `^20.0.0 || ^21.0.0 || ^22.0.0`, no other runtime dependency (CLAUDE.md:
   `public → own deps only`), so it cannot reuse `@wolsok/ws-gl` or the
   ui-kit's `RenderShaderComponent`; its WebGL setup is its own, about a
   hundred lines.
2. **API: one directive, a boolean input, an options input, global
   defaults.**

   ```html
   <section
     [wsLoadingWave]="loading()"
     [wsLoadingWaveOptions]="{ afterLoading: 'keep' }"
   >
     …
   </section>
   ```

   `LoadingWaveOptions` (all optional): `afterLoading: 'hide' | 'keep'`
   (default `'hide'`), `dotSpacing` (CSS px, default 28), `dotSize` (CSS px,
   default 1.5), `color` (any CSS colour, default the host's `currentColor`,
   so it fits light and dark themes), `sweepMs` (one sweep, default 1600),
   `renderer: 'auto' | 'webgl' | 'canvas'` (default `'auto'`).
   `provideLoadingWave(options)` sets app-wide defaults through an injection
   token, as `provideWsThanosOptions` does. Reason: the issue asks for a
   directive "for ease of use"; a boolean is what every call site already
   has.

3. **The wave model is one pure function, shared by both renderers.**
   `waveIntensity(x, y, elapsedMs, geometry)` gives a dot's brightness boost
   (0..1) from its distance behind a front that is an arc of a circle centred
   at `(-R, height / 2)` with `R = 1.5 × max(width, height)`, moving from the
   left edge to past the right edge in `sweepMs`, then repeating. Right behind
   the front the boost is 1 and falls off exponentially (1/e at 1.5 dot
   spacings) to an afterglow of 0.45 that the passed dots keep for the first
   45% of a sweep, then fading until the next front comes. The video's
   single sweep shows the front column and the afterglow (dots it passed stay
   lit at one level); it shows no loop, so the fading afterglow is how the
   effect loops: from the second sweep on, the dots ahead of the front carry
   the fading afterglow of the last one, and on the first sweep nothing ahead
   of the front is lit (nor the shader's echo, until the front ran its lag
   ahead). Reason: the curve, speed and fall-off are then tested once
   in Jest, and the GLSL mirrors a function with a spec rather than a guess.
4. **Shader analysis (acceptance 1): yes, a shader makes the wave more
   impressive, at no extra cost to the page.** The Canvas 2D renderer draws
   about 1 000 dots (1714 × 484 at 28 px) with one `arc` each a frame; it
   can afford brightness and size per dot, little more. A fragment shader
   computes every pixel in one full-element pass, so per dot it can also:
   - **displace** the lit dots a little along the wave's direction, so the
     front visibly pushes the grid like a ripple through a medium;
   - draw a **soft glow halo** around lit dots (a second, wider falloff);
   - add a weaker **echo ripple** trailing the main front by a third of a
     sweep, whose interference with the main front gives the waves depth;
   - draw every dot anti-aliased at the device pixel ratio.

   Those four are the WebGL renderer's extras; the Canvas renderer draws the
   video's effect (brightness, size, front line) and the displacement, which
   costs it nothing. The angular-examples toolbar's title shader (`ui-kit`
   `RenderShaderComponent`) shows the pattern but cannot be imported (decision
   1); the lib's shader is a single fragment shader over a full-element
   triangle, with uniforms for size, time, spacing, colour and the fade.

5. **Renderer choice and GPU fallback (acceptance 2).** `'auto'` asks for a
   WebGL2 context with `failIfMajorPerformanceCaveat: true`, which the
   browser refuses when it would render on the CPU (no GPU, blocklisted
   driver, SwiftShader). The Canvas 2D renderer takes over when that
   context is refused, when the shader fails to compile or link, when more
   than 8 effects hold a WebGL context at once (a module-level budget like
   `ws-thanos`'s `GpuContextBudget`, since browsers drop the oldest context
   at about 16) and when the context is lost while running. `'webgl'` asks
   without `failIfMajorPerformanceCaveat`, so it takes a software-rendered
   context too, and still falls back rather than showing nothing; `'canvas'`
   never touches WebGL. The shader maps the drawing buffer the GPU gave onto
   the host, which may be smaller than asked for on a tall host.
6. **How the effect sits in the page.** The directive inserts one `<canvas>`
   as the host's last child (hydration finds the host's own nodes from its first child): `position: absolute; inset: 0;
   pointer-events: none; z-index: -1`, `aria-hidden="true"`. It gives the
   host `isolation: isolate` (so `z-index: -1` stays above the host's own
   background, under its content), and `position: relative` only where the
   host's computed position is `static`. It sets `aria-busy="true"` on the
   host while loading. The canvas follows the host's size through a
   `ResizeObserver`, at the device pixel ratio capped at 2.
7. **When loading ends.** `afterLoading: 'hide'`: the dots and the wave fade
   out over 400 ms, then the canvas is removed and the GPU context
   released. `'keep'`: the wave fades out over 400 ms, the dots stay at rest
   brightness, and the render loop stops; the static grid is redrawn only on
   a resize. Loading again restarts the sweep from the left edge.
8. **Costs and courtesy.** The loop runs on `requestAnimationFrame` only
   while the effect is visible (an `IntersectionObserver` pauses it off
   screen; the browser pauses hidden tabs). With
   `prefers-reduced-motion: reduce` no wave moves: the dots show at rest,
   and the host's `aria-busy` and its own content tell that it loads. On the
   server (SSR) the directive does nothing; it starts in `afterNextRender`.
   Destroying the host stops the loop, disconnects the observers and frees
   the context.
9. **Where the apps use it** (issue: "where appropriate"):
   - **angular-examples**: a playground page `/loadingWavePlayground` (as
     `/thanosPlayground` for `@wolsok/thanos`): toggle loading, both
     `afterLoading` modes, renderer, spacing, size, colour and speed; and the
     shell's content section shows the wave while a lazy route or a remote
     loads (Router `NavigationStart` until `NavigationEnd`, `Cancel` or
     `Error`, shown only after 150 ms so quick navigations don't flash).
     The new page goes into `sitemap.xml`, `seo.service.spec.ts` and the
     portfolio's `EXPERIMENTS` and `PACKAGES` in `projects.ts`. Like
     `@wolsok/thanos`, the lib is neither shared specially nor skipped in
     `workspace-federation.js`: only the shell imports it.
   - **rollapolla-analog**: behind the spinners that wait for data, on the
     poll page (`poll/[pollId].page.ts`), "My polls" (`my-polls.page.ts`)
     and the admin page, with `afterLoading: 'hide'`. Not behind the
     `@defer` placeholders of the welcome page: on the server they render as
     placeholders and hydrate in place, so a wave there would only start in
     the browser to stop at once.
   - **portfolio (wolsok.de)**: a decorative dotted background behind the
     home page's hero (manager's answer to the spec request), with
     `afterLoading: 'keep'`: once the page runs in the browser, the wave
     sweeps across the hero twice, then the dots stay at rest. The
     prerendered HTML holds no canvas; the hero's own look (`.dish`) stays.
   - **pacetrainer**: not used; it keeps its data on the device and has no
     loading state.
10. **Two PRs of this issue** (guideline G9): PR 1 the lib, the
    angular-examples playground and route loading, and the portfolio's
    entries; PR 2 the rollapolla adoption. Reason: the lib with its specs is
    a full review on its own; rollapolla is proprietary and deploys on its
    own.

## Non-goals

- No replacement of `mat-spinner` or `mat-progress-bar`: the wave lies
  behind them; they keep saying what loads.
- No WebGL1 path: WebGL2 or Canvas 2D.
- No measurement of loading progress: the wave loops until loading ends.
- No change to `ws-thanos`, `ws-gl` or the ui-kit.

## Acceptance

1. `npx nx build ws-loading-wave` builds a partial-compilation package with
   `README.md` and `LICENSE`; `npx nx test ws-loading-wave` and
   `typecheck-specs` pass.
2. `waveIntensity` is spec'd: highest just behind the front, dimming to the
   afterglow within about 2.5 spacings, the afterglow fading in the second
   half of the sweep, ahead of the front only that fading afterglow (least
   right before it), the front curved (a dot at the top
   or bottom edge is lit later than one at mid-height in the same column),
   repeating every `sweepMs`.
3. The directive's spec shows: canvas inserted as last child with
   `aria-hidden`, `aria-busy` toggled, `position: relative` only on a
   static host, `afterLoading: 'hide'` removes the canvas after the fade,
   `'keep'` keeps it and stops the loop, destroy cleans up, nothing happens
   on the server, reduced motion draws no wave.
4. Renderer choice is spec'd: WebGL2 refused, shader failing to compile,
   budget exhausted and context lost each end on Canvas 2D; `'canvas'`
   never asks for WebGL.
5. Shader analysis: the WebGL renderer shows displacement, glow and echo
   ripple; the playground lets both renderers be compared side by side.
6. Fallback without GPU: in the playground under Chromium with
   `--disable-gpu` the effect runs on Canvas 2D (shown on the page as the
   active renderer).
7. angular-examples: `/loadingWavePlayground` works, is in `APP_ROUTES`,
   `sitemap.xml` and `seo.service.spec.ts`; a navigation to a lazy page that
   takes longer than 150 ms shows the wave in the content section.
8. Portfolio: `EXPERIMENTS` and `PACKAGES` list the playground and
   `@wolsok/loading-wave`; the home hero shows two sweeps after start, then
   a resting dot grid; the prerendered HTML has no canvas; its specs and
   budgets pass.
9. rollapolla (PR 2): the wave shows behind the poll page's, "My polls"'
   and the admin page's loading spinners and is gone once the data is
   there; SSR output contains no canvas.
10. Lint, template lint, format and the affected builds and budgets pass.

## Answered questions

1. Portfolio and pacetrainer: the manager asked for a decorative
   `afterLoading: 'keep'` background on the portfolio (decision 9);
   pacetrainer stays out.
2. The name `@wolsok/loading-wave` with selector `wsLoadingWave` stays.
