# Spec: loading-wave: configurable round wave front, theme-aware showcase, shaded WebGL wave and shader options ([#3272](https://github.com/WolfSoko/wol-sok-mono/issues/3272))

## Goal

`@wolsok/loading-wave` (`libs/public/ws-loading-wave`, built in
[#3265](https://github.com/WolfSoko/wol-sok-mono/issues/3265), spec
[`docs/specs/3265-…`](3265-loading-effect-directive-as-a-public-npm-lib.md))
gets:

1. a rounder wave front, set by a new option;
2. a showcase (`/loadingWavePlayground`) whose stages take the theme's
   background and text colours, in the light and in the dark theme;
3. a WebGL wave that is really shaded: lit beads, a glossy crest, refraction
   and bloom, rather than flat dots with a halo;
4. a choice of shaders: built-in ones, electronic circuit patterns running
   from left to right among them, picked by the user from the proposals
   below before anything is built;
5. one's own fragment shader, attached through the directive's options.

Every new option is optional, and code written against 0.0.1 compiles and
runs unchanged.

## Today (0.0.1)

- The front is an arc of a circle centred at `(-1.5 × max(width, height),
  height / 2)` (`wave-model.ts`, `CENTER_DISTANCE`). On the video's wide
  host (1714 × 484) the arc's ends lag its middle by about 11 px: the front
  reads as a straight line. There is no option for it.
- The playground's stages are hard-coded `#0b0b0b` with `#e6e6e6` text
  (`loading-wave-playground.component.scss`), in both themes; its colour
  choices are fixed hues (cyan, lime, rose) that vanish on a light
  background.
- The fragment shader (`webgl/wave-shaders.ts`) draws flat anti-aliased
  dots: brightness, growth, a push away from the centre, a Gaussian halo,
  an echo front and a hairline. No light, no normals, no surface.
- The shader is fixed; `LoadingWaveOptions` has no way to choose or supply
  one.

## Decisions

1. **`frontRoundness`, a number from 0 to 1, default 0.5.** It says how far
   the ends of the front lag its middle (the arc's sagitta `s`), as a share
   of `min(height / 2, width)`: 0 is a straight front, 1 a half circle on a
   wide host. The circle's radius follows from the sagitta,
   `R = (a² + s²) / (2s)` with `a = height / 2`; its centre lies at
   `(-R, height / 2)`, so at the start of a sweep the front's middle still
   touches the left edge and the sweep still ends once the tail left every
   row (`endRadius` as today). Below a sagitta of 1% of `a` (and for 0) the
   radius is capped at `50 × max(width, height)`, which keeps the GLSL
   floats exact. `resolveLoadingWaveOptions` clamps it into `[0, 1]` and
   replaces a non-finite value with the default, as it does for the sizes.
   Reasons: a share of the height keeps the look the same on hosts of every
   size, which today's `max(width, height)` did not (a tall host got a
   flatter front than a wide one); capping by the width keeps a narrow, tall
   host (a sidebar) from getting a front whose ends never enter it before
   the sweep ends. The default changes the look on purpose, since the user
   asked for a rounder front; `frontRoundness: 0.05` gives about the 0.0.1
   front on a wide host. Both renderers take it from the shared model
   (`waveGeometry`), the Canvas front line included.
2. **`accentColor`, any CSS colour, default the dots' colour.** Lit dots,
   the crest and the circuits' pulses take it; resting dots keep `color`.
   It is resolved like `color` (variables, `light-dark()`, theme changes
   through `observeTheme`). The Canvas renderer mixes each lit dot from
   `color` towards `accentColor` by its intensity. Reason: a shaded wave
   and a circuit's current read far better in a second colour (say
   `var(--mat-sys-primary)` over `on-surface` dots); unset, nothing
   changes.
3. **A shader is an object, passed in the options:**

   ```ts
   export interface LoadingWaveShader {
     /** GLSL ES 3.00 that defines `vec4 wsShade(vec2 point)` */
     readonly fragment: string;
     /** values of uniforms the fragment declares itself */
     readonly uniforms?: Readonly<Record<string, number | readonly number[]>>;
   }
   ```

   `LoadingWaveOptions.shader?: LoadingWaveShader`, unset is the built-in
   `rippleShader` (decision 5). It is set per element through
   `[wsLoadingWaveOptions]="{ shader: circuitTracesShader }"` (the
   directive's options input) or app-wide with `provideLoadingWave({ shader
   })`. The built-in shaders are exported constants of the same type, so
   they are the contract's examples and an app bundles only those it
   imports. Reasons: one input for every way of choosing a shader, the same
   as every other option, instead of a name for built-ins and a second
   input for one's own; and names would force every built-in shader into
   each app's bundle (the shell loads the lib in its initial chunk for the
   route loading wave). A third-party shader is code of the app's
   developer, not of its visitors: no sanitising.

4. **The shader contract.** The lib wraps `fragment` into a program:
   `#version 300 es`, `precision highp float`, the uniforms below, helper
   functions, then the fragment, then a `main` that maps `gl_FragCoord` to
   CSS pixels (y down, as today), calls `wsShade(point)`, takes its result
   as straight (not premultiplied) colour and alpha, multiplies the alpha by
   the grid's fade (`ws_dots`) and writes it premultiplied. The `ws_` prefix
   is the lib's; the fragment names its own uniforms otherwise and declares
   them itself.

   | Uniform                            | Type    | Holds                                                               |
   | ---------------------------------- | ------- | ------------------------------------------------------------------- |
   | `ws_size`                          | `vec2`  | host size, CSS px                                                   |
   | `ws_pixel`                         | `float` | CSS px per device pixel (for anti-aliasing)                         |
   | `ws_spacing`                       | `float` | dot spacing after the dot limit, CSS px                             |
   | `ws_dotSize`                       | `float` | resting dot diameter, CSS px                                        |
   | `ws_color`                         | `vec4`  | dot colour, straight RGBA 0..1                                      |
   | `ws_accent`                        | `vec4`  | accent colour, straight RGBA 0..1                                   |
   | `ws_center`                        | `vec2`  | the front circle's centre, CSS px                                   |
   | `ws_frontRadius`                   | `float` | the front's radius now                                              |
   | `ws_echoRadius`                    | `float` | the echo's radius, negative while there is none                     |
   | `ws_travel`                        | `float` | how far the radius grows in one sweep                               |
   | `ws_falloff`, `ws_rise`, `ws_tail` | `float` | the model's lengths (`WaveGeometry`)                                |
   | `ws_phase`                         | `float` | share of the sweep passed, 0..1                                     |
   | `ws_time`                          | `float` | seconds since loading started; frozen with reduced motion           |
   | `ws_previousSweep`                 | `float` | 1 once a sweep went before, else 0                                  |
   | `ws_wave`                          | `float` | strength of the wave, 0..1 (fades; 0 at rest and on reduced motion) |

   Helpers, mirroring `wave-model.ts`: `ws_behindFront(p)`,
   `ws_waveIntensity(p)` (front glow and afterglow), `ws_hash(vec2)`,
   `ws_hash2(vec2)` (stable per cell), `ws_dotDisk(p, center, radius)`
   (anti-aliased coverage). A shader must draw its resting state at
   `ws_wave == 0`: that is what `'keep'` leaves behind and what reduced
   motion shows. A fragment that does not compile or link is reported once
   with `console.warn` and its info log, and the wave falls back to the 2D
   canvas, as every failing shader does today (`chooseWaveRenderer`).
   Changing `uniforms` alone updates a running wave in place; another
   `fragment` rebuilds its program and starts the wave over, as another
   `renderer` does today.

5. **The default WebGL look, `rippleShader`: a shaded ripple.** The wave
   becomes a height field over the element, a crest right behind the front
   (and a weaker one behind the echo) whose height follows the model's
   intensity. From it the shader takes, per pixel:
   - **refraction:** each dot is displaced by the field's slope, as if seen
     through a ripple on water (replaces today's push);
   - **beads:** each lit dot is shaded as a small sphere (normal from the
     disk, Lambert plus a Blinn-Phong glint) under a light that rides with
     the crest, so dots catch the light as the front passes and dim as it
     moves on;
   - **a glossy crest:** a soft specular band along the front, brightest at
     mid-height, instead of the hairline;
   - **bloom:** a two-scale glow around the brightest dots, in the accent
     colour.

   It is drawn "over" the host's background (straight alpha), never
   additive, so it reads on a light background (darker beads, the glint in
   the accent colour) as on a dark one. The 2D canvas keeps drawing the
   video's dot wave (decision 7).

6. **The built-in shaders beside the default** are picked by the user from
   the proposals below ("Shader proposals"); each picked one becomes an
   exported `LoadingWaveShader` (`circuitTracesShader`, …) with a task of
   its own in the plan. Every one keeps the dot grid's spacing as its
   pitch, draws its resting state faintly at `ws_wave == 0` and runs from
   left to right with the front.
7. **The 2D canvas stays the dot wave for every shader.** It cannot run
   GLSL; it draws the rounder front and the accent colour, nothing of a
   shader. Reason: the fallback has to work everywhere; a Canvas twin per
   shader would double every pattern's code for machines without a GPU.
8. **Built-in shader sources are plain string constants**, written without
   top-level function calls (today's `${glsl(…)}` interpolations become
   literals, checked against the TypeScript constants by a spec), so a
   bundler drops an unused one. Acceptance checks it in the build output.
9. **The showcase follows the theme.** The playground's stages take
   `background: var(--mat-sys-surface-container-lowest)` and `color:
   var(--mat-sys-on-surface)`: near black in the dark theme, white in the
   light one (`body.theme-alternate` switches `color-scheme`, which the
   Material tokens' `light-dark()` follow). The colour choices become theme
   tokens (Text, Primary, Tertiary) for the dots and for the accent, so no
   choice disappears in either theme; the wave recolours on a theme switch
   through the lib's existing `observeTheme`. The playground also gets a
   front-roundness slider, a shader picker with every built-in shader and
   "Custom", and for "Custom" a text field with an example fragment and an
   "Apply" button; the WebGL stage names what draws it (as today), so a
   fragment that fails shows "drawn by: canvas".
10. **Release: one `feat(ws-loading-wave)` change, no breaking change.**
    `nx release` takes conventional commits (`nx.json` `release.version`);
    on 0.x it made #3266's `feat` the patch 0.0.1, so this ships as
    **0.0.2**. Nothing is removed or renamed: `frontRoundness`,
    `accentColor` and `shader` are optional, the other options keep their
    meaning and defaults, the new exports (`LoadingWaveShader`,
    `rippleShader`, the picked shaders) only add. What changes for an app
    that upgrades is the look: the rounder default front and the shaded
    default shader; the README says how to get the flat front back. The
    shell's route loading, the portfolio's hero and rollapolla's pages take
    the new look as they are.
11. **The portfolio's `PACKAGES` and `EXPERIMENTS` entries** for the lib
    and the playground name the shaders and the custom shader in their
    descriptions (CLAUDE.md: a noticeably changed package updates its
    entry).

## Shader proposals (the user picks)

Each runs from left to right with the front, on the dot grid's pitch, and
lies faintly at rest. Recommended: **A** and **B**, both circuits.

- **A. Circuit traces (`circuitTracesShader`), a printed circuit board.**
  Each grid cell hashes to a trace piece (mostly horizontal, now and then a
  45° jog up or down a row, a T to a branch), so the cells join into
  copper traces running left to right, with the dots as pads and vias.
  Ahead of the front the board lies dark; the front energises it: traces
  light up in the accent colour, and current pulses, short bright packets
  with comet tails, run on along them to the right at slightly different
  speeds, then die out in the afterglow. Pads flash as a pulse passes.
- **B. Data bus (`dataBusShader`), a logic analyser.** Lanes of parallel
  horizontal lines, grouped in buses of four to eight with gaps between
  them, some bending by one lane on the way. Bit packets (dashes of two
  lengths, zero and one) stream left to right at a speed per bus; the front
  is a clock edge: as it passes, the bits behind it flip and brighten,
  ahead of it they idle dim. Dense, calm, reads as "data is moving".
- **C. Die scan (`dieScanShader`), a chip powering up.** The element is cut
  into blocks by a hashed recursive split (large cores, small cells, thin
  rails between them), each filled with a micro pattern on the dot pitch
  (rows of dots, stripes, a hatch). The front powers the die on: a block
  flickers on as the front reaches it, the rails between powered blocks
  glow, powered blocks keep a low afterglow.
- **D. Signal trace (`signalTraceShader`), an oscilloscope.** The dot grid
  is the graticule; two or three digital signal lines (square waves with
  hashed timing, a pulse train) are drawn by the front as it sweeps, a
  bright phosphor head at the front and a decaying trail behind it, with a
  slight bloom. The sparest of the circuits, good on small hosts.
- **E. Spark front (`sparkFrontShader`), electric arcs.** The front is a
  crackling band (an arc displaced by noise that changes every few frames)
  whose branches jump to the nearest dots; a struck dot sparks white and
  keeps the afterglow. Electric rather than a circuit; the loudest of the
  set.

## Non-goals

- No Canvas 2D version of any shader (decision 7).
- No WebGL1, no compute, no textures or extra render passes: one fragment
  pass per frame, as today.
- No change to the wave's timing model (`sweepMs`, afterglow, echo, fades),
  the renderer choice, the GPU budget or the directive's placement in the
  page.
- No error display API for custom shaders beyond `console.warn` and the
  fallback that `activeRenderer()` already shows.
- No change to `ws-thanos`, `ws-gl` or the ui-kit.

## Acceptance

1. `frontRoundness` is spec'd in the model: at 0 a dot at the top edge and
   one at mid-height in the same column are lit at nearly the same time; at
   1 the top one is lit later by about half the height's worth of travel;
   at every value the front's middle touches the left edge at phase 0 and
   the sweep ends with every row passed; out-of-range and non-finite values
   resolve to `[0, 1]` and the default.
2. `accentColor` is spec'd: unset, both renderers draw as before; set, the
   Canvas lit dots and the WebGL `ws_accent` take it, and a theme change
   recolours it.
3. The shader contract is spec'd: the assembled program holds the header,
   the helpers, the fragment and `main`; the standard uniforms and a
   shader's own `uniforms` are set per frame; a failing custom fragment
   ends on the 2D canvas with one warning; a `uniforms`-only change keeps
   the program, a `fragment` change rebuilds it; unset `shader` is
   `rippleShader`.
4. Every built-in shader compiles and draws on WebGL2: a Playwright spec of
   angular-examples opens the playground, picks each shader with the WebGL
   stage on `renderer: 'webgl'` (SwiftShader in CI) and sees "drawn by:
   webgl"; a broken custom fragment shows "drawn by: canvas".
5. The built-in shaders' GLSL constants equal the TypeScript model
   constants they mirror (spec), and the production build of
   angular-examples holds the circuit shaders' source only in the
   playground's lazy chunk, not in `main` (checked by searching the build
   output).
6. The playground's stages show the theme's background and text colour in
   the dark and the light theme, and the wave recolours on a switch;
   screenshots of both themes and of each built-in shader, on a real GPU,
   go into the PR.
7. The README documents `frontRoundness`, `accentColor`, `shader`, the
   built-in shaders and the shader contract (uniforms, helpers, resting
   state, fallback); the portfolio's entries name the shaders.
8. `npx nx build ws-loading-wave`, `test`, `typecheck-specs`, lint,
   template lint, format and the affected builds with their budgets pass
   (angular-examples' `initial` and portfolio's `allScript` grow only by
   the default shader).

## Open questions

1. **Which shaders to build** (A to E, any number)? Recommended: A and B.
2. Default `frontRoundness` 0.5 (visibly round), or keep the 0.0.1 look by
   default and let apps opt in? Recommended: 0.5, as the user asked for a
   rounder front.
3. "Rounder wave front" is read as the arc's curvature. If it meant a
   softer edge of the lit band instead (or as well), that is the model's
   `rise`/`falloff`, which could become an option too.
