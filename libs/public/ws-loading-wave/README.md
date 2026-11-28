# @wolsok/loading-wave

A calm loading effect for Angular: a grid of small dots behind any element,
crossed again and again by a round wave front that lights the dots it
passes. It lies in the background, so it shows that something loads without
pulling the eye away from the content.

Try it in the [playground](https://angularexamples.wolsok.de/loadingWavePlayground).

- **One directive**, a boolean input: `[wsLoadingWave]="loading()"`.
- **On the GPU where there is one:** a WebGL2 shader draws the wave as a
  ripple through water: the dots refract through its slope, shine as small
  lit beads and bloom, and an echo trails the front. Or pick one of five
  built-in shaders (circuit traces, a data bus, a chip powering up, an
  oscilloscope, electric arcs), or bring your own fragment shader (see
  [Shaders](#shaders)).
- **Everywhere else on a 2D canvas:** without a GPU (or when the browser
  would render WebGL on the CPU), when the shader fails, when more than 8
  waves run on one page or when the GPU context is lost.
- **After loading** the dots fade away (`'hide'`) or stay as a quiet dotted
  background (`'keep'`).
- **Small elements too:** on a button or a chip the grid gets finer by
  itself, and a round spinner comes in the same style (see
  [Small elements](#small-elements) and [Spinner](#spinner)).
- **Polite:** no wave with `prefers-reduced-motion`, paused off screen,
  nothing on the server, `aria-busy` on the host while loading, the canvas
  hidden from assistive technology.

## Install

```bash
npm install @wolsok/loading-wave
```

Peer dependency: `@angular/core` 22 (the version it is built with). No other dependency.

## Use

```ts
import { Component, signal } from '@angular/core';
import { LoadingWaveDirective } from '@wolsok/loading-wave';

@Component({
  selector: 'app-results',
  imports: [LoadingWaveDirective],
  template: `
    <section class="results" [wsLoadingWave]="loading()">
      @if (loading()) {
        <p>Loading results…</p>
      } @else {
        <app-result-list />
      }
    </section>
  `,
})
export class ResultsComponent {
  protected readonly loading = signal(true);
}
```

The directive puts one canvas behind the host's content (`z-index: -1` in a
stacking context of the host: it gives the host `isolation: isolate`, and
`position: relative` where it was `static`). Give the host a size and,
for the look of the video, a dark background.

### Options

Per element with `[wsLoadingWaveOptions]`, or app-wide with
`provideLoadingWave(…)` in your providers:

```html
<header
  [wsLoadingWave]="intro()"
  [wsLoadingWaveOptions]="{ afterLoading: 'keep', dotSpacing: 24 }"
>
```

```ts
bootstrapApplication(AppComponent, {
  providers: [provideLoadingWave({ color: 'var(--mat-sys-primary)' })],
});
```

| Option           | Default        | What it does                                                                                                                                              |
| ---------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `afterLoading`   | `'hide'`       | `'hide'`: dots and wave fade out, the canvas goes. `'keep'`: the wave fades out, the dots stay.                                                           |
| `dotSpacing`     | `28`           | distance between two dots, CSS pixels                                                                                                                     |
| `dotSize`        | `1.5`          | diameter of a dot at rest, CSS pixels                                                                                                                     |
| `autoscale`      | `true`         | `true`: a finer grid on small hosts, see [Small elements](#small-elements). A number: spacing and dot size times it. `false`: as set                      |
| `origin`         | `'left'`       | `'left'`: the front sweeps in from the left. `'center'`: it grows from the host's middle, a ripple                                                        |
| `color`          | host's colour  | any CSS colour, variables included; unset, the dots take the host's `currentColor`                                                                        |
| `accentColor`    | dots' colour   | any CSS colour for the lit dots and the wave itself                                                                                                       |
| `sweepMs`        | `1600`         | one sweep of the wave across the element, milliseconds                                                                                                    |
| `frontRoundness` | `0.5`          | 0 (a straight front) to 1 (a half circle): how far the front's ends lag its middle, as a share of `min(height / 2, width)`; from the `'left'` origin only |
| `renderer`       | `'auto'`       | `'auto'`: the shader on a GPU; `'webgl'`: also in software; both fall back to the 2D canvas. `'canvas'`: never WebGL                                      |
| `shader`         | `rippleShader` | the fragment shader the WebGL renderer draws with, see [Shaders](#shaders)                                                                                |

Before 0.0.2 the front was nearly straight on a wide host; `frontRoundness:
0.05` gives about that look again.

The dots follow the host's colour through theme changes (a class or
attribute on `<html>` or `<body>`, or the system's colour scheme).

`exportAs: 'wsLoadingWave'` gives the template the directive; its
`activeRenderer()` signal says what draws right now (`'webgl'`, `'canvas'` or
`null`).

### Small elements

On a button, a chip or an icon button the wave works as it does on a
section: put the directive on it.

```html
<button mat-flat-button [wsLoadingWave]="saving()">Save</button>
```

With `autoscale: true` (the default) the grid gets finer where the host's
shorter side holds fewer than six dots (below 168 px with the default
spacing): spacing and dot size shrink together, a dot never below 1 px, and
the wave's tail and push follow the spacing. Larger hosts keep the grid as
set. A number scales spacing and dot size by that factor on every host
(`autoscale: 0.5` halves them), `false` keeps them as set. The canvas takes
the host's `border-radius`, so a rounded button clips the wave to its
corners.

### Spinner

`<ws-loading-wave-spinner>` is a round loading spinner in the same style: a
dish of dots that a ripple from its middle lights again and again
(`origin: 'center'`, a sweep of 1.2 s). It spins while it is there, so show
it with `@if`:

```ts
import { LoadingWaveSpinnerComponent } from '@wolsok/loading-wave';
```

```html
@if (saving()) {
<ws-loading-wave-spinner [diameter]="24" label="Saving" />
}
```

| Input      | Default     | What it does                                                         |
| ---------- | ----------- | -------------------------------------------------------------------- |
| `diameter` | `40`        | width and height, CSS pixels                                         |
| `label`    | `'Loading'` | the `aria-label` of its `role="progressbar"`                         |
| `options`  | unset       | wave options laid over the spinner's ripple (unset values keep them) |

The app-wide options of `provideLoadingWave` apply to it too, and its dots
take its `currentColor` unless `color` is set.

## Shaders

On the GPU the wave is drawn by a fragment shader, `rippleShader` unless
you pass another one as `shader`. The 2D canvas fallback always draws the
dot wave.

### Built-in shaders

Beside `rippleShader` (from `@wolsok/loading-wave`, the default) five
built-in shaders come from the secondary entry point
`@wolsok/loading-wave/shaders`, so an app loads only those it imports. Each
runs from left to right with the front, on the dot grid's spacing, and lies
faintly at rest:

| Shader                | Looks like                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `circuitTracesShader` | a printed circuit board: the front energises copper traces, current pulses with comet tails run on them                       |
| `dataBusShader`       | a logic analyser: buses of lanes whose bits idle dim ahead of the front and flip and stream behind it, the front a clock edge |
| `dieScanShader`       | a chip powering up: blocks with micro patterns flicker on as the front reaches them, their rails glow                         |
| `signalTraceShader`   | an oscilloscope: square-wave signals drawn by the front with a phosphor head and a decaying trail                             |
| `sparkFrontShader`    | electric arcs: the front as a crackling bolt whose branches strike the dots near it                                           |

```ts
import { circuitTracesShader } from '@wolsok/loading-wave/shaders';
```

```html
<section
  [wsLoadingWave]="loading()"
  [wsLoadingWaveOptions]="{ shader: circuitTracesShader }"
>
```

### Your own shader

```ts
import { LoadingWaveShader } from '@wolsok/loading-wave';

const scanShader: LoadingWaveShader = {
  fragment: `
    uniform float u_speed;
    vec4 wsShade(vec2 point) {
      vec2 center = ws_cellCenter(ws_cell(point));
      float lit = ws_waveIntensity(center);
      float core = ws_dotDisk(point, center, 0.5 * ws_dotSize * (1.0 + 2.0 * lit));
      float scan = lit * (0.5 + 0.5 * sin(point.y * 0.5 - ws_time * u_speed));
      vec4 ink = ws_ink(lit);
      float dots = core * ink.a * mix(WS_REST_ALPHA, WS_LIT_ALPHA, lit);
      float glow = 0.15 * scan * ws_accent.a;
      float alpha = dots + glow;
      return vec4((ink.rgb * dots + ws_accent.rgb * glow) / max(alpha, 1.0e-4), alpha);
    }
  `,
  uniforms: { u_speed: 8 },
};
```

```html
<section
  [wsLoadingWave]="loading()"
  [wsLoadingWaveOptions]="{ shader: scanShader }"
>
```

or app-wide with `provideLoadingWave({ shader: scanShader })`.

**The contract.** `fragment` is GLSL ES 3.00 that defines
`vec4 wsShade(vec2 point)`: the colour and opacity at `point`, in CSS
pixels from the host's top left corner (y down), as straight (not
premultiplied) RGBA. The lib puts `#version 300 es`, `precision highp
float`, the uniforms and helpers below before it and a `main` after it, so
the fragment holds neither. It is drawn over the host's background: draw
with alpha, not by adding light, and it reads in light and dark themes.

- **At rest** (`ws_wave == 0`) draw the resting state, without `ws_time`:
  that is what `afterLoading: 'keep'` leaves and what
  `prefers-reduced-motion` shows.
- **Own uniforms** are declared in the fragment and given in `uniforms`
  (a number, or 2 to 4 numbers for a `vec2` to `vec4`). Changing only
  `uniforms` updates a running wave, and a uniform left out goes back to 0
  (as before it was first set); another `fragment` starts the wave over. The `ws_` prefix is the
  lib's: `uniforms` never set a `ws_` uniform.
- **When it fails** to compile or link, the lib warns once per fragment in
  the console with the GPU's log (its line numbers count from the
  fragment's first line) and draws on the 2D canvas; `activeRenderer()` says
  `'canvas'`.

| Uniform                                          | Type    | Holds                                                                                                  |
| ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| `ws_size`                                        | `vec2`  | the host's size, CSS pixels                                                                            |
| `ws_pixel`                                       | `float` | CSS pixels per device pixel, for anti-aliasing                                                         |
| `ws_spacing`                                     | `float` | the dot spacing in use (after `autoscale`)                                                             |
| `ws_dotSize`                                     | `float` | a resting dot's diameter in use (scaled with the spacing)                                              |
| `ws_color`                                       | `vec4`  | the dots' colour, straight RGBA 0 to 1                                                                 |
| `ws_accent`                                      | `vec4`  | the accent colour (the dots' colour when unset)                                                        |
| `ws_center`                                      | `vec2`  | the centre of the front's circle (left of the host, or its middle with `origin: 'center'`)             |
| `ws_frontRadius`                                 | `float` | the front's radius now                                                                                 |
| `ws_echoRadius`                                  | `float` | the echo's radius, negative while there is none                                                        |
| `ws_travel`                                      | `float` | how far the radius grows in one sweep                                                                  |
| `ws_falloff`, `ws_rise`, `ws_tail`, `ws_maxPush` | `float` | the wave's lengths: dimming behind the front, lighting up ahead of it, the lit tail, the farthest push |
| `ws_phase`                                       | `float` | the share of the sweep passed, 0 to 1                                                                  |
| `ws_time`                                        | `float` | seconds since loading started                                                                          |
| `ws_previousSweep`                               | `float` | 1 once a sweep went before, else 0                                                                     |
| `ws_wave`                                        | `float` | the wave's strength, 0 to 1 (fades in and out, 0 at rest)                                              |

| Helper                                                                 | Gives                                                                |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `float ws_behindFront(vec2 p)`                                         | how far `p` lies behind the front, negative ahead of it              |
| `float ws_waveIntensity(vec2 p)`                                       | the wave's light at `p`, 0 to 1, scaled by `ws_wave`                 |
| `float ws_echoGlow(vec2 p)`                                            | the echo's light at `p`                                              |
| `float ws_behindEcho(vec2 p)`                                          | how far `p` lies behind the echo, far negative while there is none   |
| `float ws_frontGlow(float behind)`, `float ws_afterglow(float behind)` | the two parts of `ws_waveIntensity`                                  |
| `vec2 ws_cell(vec2 p)`, `vec2 ws_cellCenter(vec2 cell)`                | the grid cell of `p` and where its dot sits                          |
| `float ws_dotDisk(vec2 p, vec2 center, float radius)`                  | anti-aliased coverage of a disk                                      |
| `float ws_segment(vec2 p, vec2 a, vec2 b, float width)`                | anti-aliased coverage of a line                                      |
| `float ws_segmentDistance(vec2 p, vec2 a, vec2 b)`                     | the distance from `p` to a segment                                   |
| `float ws_band(float away, float width)`                               | anti-aliased coverage of a band of `width` at `away` from its middle |
| `float ws_hash(vec2 p)`, `vec2 ws_hash2(vec2 p)`                       | stable pseudo-random numbers in [0, 1), say per cell                 |
| `vec4 ws_ink(float lit)`                                               | the dots' colour mixed towards the accent                            |

The constants `WS_REST_ALPHA`, `WS_LIT_ALPHA`, `WS_LIT_GROWTH`,
`WS_FRONT_LINE_ALPHA`, `WS_AFTERGLOW`, `WS_AFTERGLOW_FADE_START` and
`WS_ECHO_STRENGTH` give the
dot wave's own look. The built-in shaders' sources are fuller examples.

## License

MIT
