# Spec: loading-wave works for small elements ([#3276](https://github.com/WolfSoko/wol-sok-mono/issues/3276))

## Goal

`@wolsok/loading-wave` (`libs/public/ws-loading-wave`) looks right on small
elements too: buttons, icon buttons, chips, anything interactive. It also
gets a loading spinner in the same style. The playground
(`/loadingWavePlayground`) shows both, and its custom-shader editor becomes
the shader-examples code editor (Ace), opened with room to edit.

Every new option is optional. Code written against 0.0.3 compiles
unchanged. The look changes only on hosts whose shorter side is below
`6 × dotSpacing` (168 px with the defaults), which today show one or two
rows of dots.

## Today (0.0.3)

- The grid takes `dotSpacing` (default 28 px) and `dotSize` (1.5 px) as
  given, whatever the host's size (`waveGeometry` in `wave-model.ts`). On a
  36 px button that is one row of dots. On a 40 px square it is one dot,
  and the tail (4 spacings, 112 px) is longer than the host.
- The canvas fills the host's box (`inset: 0`) with square corners, so on a
  rounded button or chip the dots and the shader's glow show past the
  corners.
- The front always comes from the left: the circle's centre lies left of
  the element. A round, centred effect (a spinner) has no setting.
- The playground's custom fragment is a plain `<textarea>` of 14 rows in
  the 24 rem controls column. Shader-examples
  (`libs/features/lazy/shader-examples`) has an Ace code editor
  (`CodeEditorComponent`, `ngx-ace-editor-wrapper`), but only inside that
  feature lib, which the shell cannot import (it belongs to its remote and
  is skipped in `workspace-federation.js`).

## Decisions

1. **`autoscale: boolean | number`, default `true`.**
   - `true`: the grid shrinks by
     `f = min(1, shorterSide / (MIN_DOTS_ACROSS × dotSpacing))`, with
     `MIN_DOTS_ACROSS = 6`. Hosts with a shorter side of at least 168 px
     (with the defaults) keep `f = 1` and look as before.
   - A number: that factor as given (`0.5` halves the grid, `2` doubles
     it). One that is not a positive finite number falls back to the
     defaults' `autoscale` in `resolveLoadingWaveOptions` (`true` unless
     `provideLoadingWave` sets another), as bad sizes fall back to theirs.
   - `false`: `f = 1`, the 0.0.3 behaviour.

   The spacing becomes `dotSpacing × f`. The dot size becomes
   `dotSize × f`, but not below `MIN_DOT_SIZE = 1` CSS px, or below the
   asked size where that is already under 1 px. Every length derived from
   the spacing (tail, falloff, rise, push) follows it, as it does today.
   The `MAX_DOTS` widening still applies after scaling.

   Reasons: the issue asks for `true/false/scale`. `true` as the default
   makes small elements work without configuration, and changes nothing on
   hosts large enough for the 0.0.3 look. Without the 1 px floor a dot
   would shrink below one device pixel and vanish on a 40 px spinner.

2. **The dot size moves into `WaveGeometry`.** `waveGeometry` computes both
   the scaled spacing and the scaled size from the host's size, and both
   renderers take `geometry.dotSize`. `WaveLook` keeps the colours only.
   Reason: the size now depends on the host's size like the spacing does,
   and is recomputed on every resize. Resolving the colours again on each
   resize would cost a `getComputedStyle` call. The `ws_dotSize` uniform
   of the shader contract stays as it is.
3. **`origin: 'left' | 'center'`, default `'left'`.**
   - `'left'`: the 0.0.3 front.
   - `'center'`: the front's circle sits at the host's centre and grows from
     radius 0 until the tail has left the farthest corner
     (`endRadius = hypot(width / 2, height / 2) + tail`). `frontRoundness`
     does not apply.

   The 2D canvas draws the front's hairline as a full circle in both cases.
   For `'left'` that changes nothing, since the circle's left half lies
   wholly left of the element. Reason: a ripple from the middle is the
   lib's own look (a ripple through water), and it reads as a spinner on a
   round host. Both renderers and every shader take the centre from the
   geometry (`ws_center`), so this needs no shader change.

4. **The canvas follows the host's corners:** `border-radius: inherit` in
   the canvas's style. A rounded button, a chip and a round spinner clip
   the dots to their own shape. Reason: one style line, and it is right for
   every host, square ones included.
5. **`LoadingWaveSpinnerComponent` (`<ws-loading-wave-spinner>`)** in the
   main entry, beside the directive. It is a round element
   (`border-radius: 50%`, `display: inline-block`), `diameter` CSS px on
   each side (input, default 40), with `role="progressbar"` and an
   `aria-label` (input `label`, default `'Loading'`). Its inner element
   carries the directive, always loading, with
   `{ origin: 'center', sweepMs: 1200 }` under the `options` input
   (`Partial<LoadingWaveOptions>`, which wins). The app-wide options of
   `provideLoadingWave` apply as for the directive. Like
   `mat-progress-spinner`, it spins while it is there: an app shows it with
   `@if`. Reasons:
   - The issue asks for a spinner in this style.
   - A component, not a second directive, because the spinner brings its
     own element and size.
   - A few hundred bytes in the main entry is no concern beside the
     directive (L799 concerns heavy optional code such as the shaders).
   - Under `prefers-reduced-motion` its dots rest, as the directive's do.
   - The lib depends on nothing but `@angular/core`, so this is no
     Material UI rebuilt: CLAUDE.md's rule 5 gets an exception line for it.
6. **The code editor moves to `@wolsok/ui-kit/code-editor`**, a secondary
   entry point of `libs/ui-kit` (as `@wolsok/loading-wave/shaders` is one,
   L804), as `CodeEditorComponent`, selector `ws-shared-ui-code-editor`.
   - Shader-examples and the playground both import it.
   - It is not in ui-kit's main entry, because the shell's toolbar imports
     that main entry eagerly, and Native Federation ships an entry point as
     one bundle (L799): Ace (about 700 kB of source) would load on every
     page of the shell.
   - On the move it gets signal inputs and an output (`code`, `mode`,
     `codeTitle`, `changeDebounceMs`, default 1000 ms as today, and
     `codeChange`), replacing the setter that emitted on every input.
   - It loads `brace/mode/glsl`, so GLSL is highlighted, plus the modes its
     callers pass.
   - `minLines` (input, default 1) sets how tall it opens.
7. **The playground's custom shader opens in a full-width card** below
   controls and stages, spanning both grid columns, once "Custom" is
   picked: the code editor with at least 30 lines and the page's full
   width, an "Apply" button, and `changeDebounceMs` 0, so "Apply" takes
   what was typed. The GPU stage stays where it is.
8. **The playground gets a "Small elements" card** in the stages column,
   below the two stages. It holds a flat button, a stroked button, an icon
   button, a chip, and spinners of 24, 40 and 64 px, seven waves in all.
   - All of them follow the Loading toggle and the playground's options,
     with the picked shader and `renderer: 'auto'`.
   - With the shader stage that makes 8 GPU waves, the page budget
     (`MAX_GPU_WAVES`).
   - A new "Autoscale" toggle group (`auto`, `off`, `½`) sets `autoscale`
     to `true`, `false` or `0.5`. It shows in the options JSON.
9. **Docs:** the lib's README (options table: `autoscale`, `origin`; a
   "Small elements" and a "Spinner" section), the portfolio's
   `@wolsok/loading-wave` entry and the playground experiment's
   description (`apps/portfolio/src/app/projects.ts`) name the spinner and
   the small elements. There is no new route, so no sitemap change.
10. **One PR**, one commit per task of the plan.

## Non-goals

- A rotating spinner front, or a determinate (percent) spinner.
- New shaders. The built-in shaders compile and draw with
  `origin: 'center'`, but were drawn for a front from the left.
- Replacing Ace or `ngx-ace-editor-wrapper`.
- Raising `MAX_GPU_WAVES`.

## Acceptance

1. `waveGeometry` with `autoscale: true` on a 120 × 36 host and the
   defaults gives a spacing of `36 / 6 = 6` px and a dot size of 1 px. On
   400 × 300 it gives 28 and 1.5. With `autoscale: 0.5` it gives 14 and
   1 (floor) on any host. With `false` it gives 28 and 1.5 on any host.
2. `resolveLoadingWaveOptions` keeps `true`, `false` and positive finite
   numbers, and replaces `0`, negative, `NaN` and `Infinity` with the
   defaults' `autoscale` (`true` with the lib's own defaults). An
   app's own `LOADING_WAVE_OPTIONS` without `autoscale` or `origin` resolves
   to `true` and `'left'`.
3. `origin: 'center'` gives `centerX = width / 2`, `centerY = height / 2`,
   `startRadius = 0` and `endRadius = hypot(width / 2, height / 2) + tail`.
   A dot at the centre lights first. The 2D canvas strokes the front's
   circle over `0` to `2π`.
4. Both renderers draw the dots at `geometry.dotSize`: the 2D canvas's arc
   radius, and the WebGL renderer's `ws_dotSize` uniform.
5. The canvas the wave mounts has `border-radius: inherit`.
6. `<ws-loading-wave-spinner>` renders a round element `diameter` px wide
   and high, with `role="progressbar"` and its `aria-label`. Its wave runs
   with `origin: 'center'`, and with an `options` input it runs with those
   on top. It loads from creation to destruction.
7. Shader-examples still shows and edits its shaders with the code editor,
   now from `@wolsok/ui-kit/code-editor`. Its old `code-editor/` folder is
   gone.
8. The playground shows the "Small elements" card with the four elements
   and three spinners, each with the wave while loading. A spec checks
   that they take the playground's options and the Autoscale choice.
9. Picking "Custom" opens the code editor in a full-width card with at
   least 30 lines, and "Apply" draws the typed fragment. The playground's
   e2e (built-in shaders draw with WebGL, a broken fragment falls back to
   the 2D canvas) passes with the editor in place of the textarea.
10. The README and the portfolio entries describe `autoscale`, `origin` and
    the spinner.
11. `nx affected -t build,test,lint,lint-templates,typecheck-specs` is green,
    and so is the playground's e2e in `angular-examples`. The production
    builds stay within their budgets. Growth wanted for the editor gets its
    own `perf(...)` commit.
12. Seen in the running apps (screenshots in the PR): the small elements
    and spinners show a readable dot wave, and the editor opens wide.
    Shader-examples (`nx serve shader-examples-remote`, which has no e2e)
    opens its editor and redraws an edited shader.

## Open questions

- Is `autoscale: true` the right default? The alternative is `false`
  (opt-in), which keeps 0.0.3's look everywhere. The proposal takes `true`,
  since today's look on small hosts is broken anyway.
- Is a ripple from the centre (decision 3) the spinner the issue means, or
  a rotating front? The proposal takes the ripple, since it needs no new
  model or shader code.
