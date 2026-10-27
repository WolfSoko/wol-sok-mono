# 14. Performance gates in CI

- Status: proposed
- Date: 2026-10-24
- Scope: CI (`.github/workflows/ci-cd.yml`, `.nx/ci-config.yaml`), the
  apps' `esbuild` budgets, `libs/features/lazy/bacteria-game`,
  `apps/bacteria-game-remote` (e2e), `tools/perf/` (new)

## Context

CI checks that the code is correct (lint, unit tests, builds, e2e), not that
it stays fast. What it measures today:

- **Bundle size, partly.** Each app's `esbuild:production` has an `initial`
  budget (500 kB warning, 1 MB error; `angular-examples` 2.48/2.9 MB) and an
  `anyComponentStyle` budget. The lazy chunks are not covered. In
  `bacteria-game-remote` the whole game is one lazy chunk: 815 kB raw,
  181 kB transferred (production build, 2026-10-24), against an initial
  bundle of 241 kB. It grew by about 33 kB in one PR this week without any
  check noticing. One stylesheet (`evolution.component.scss`, 6.84 kB) is
  already over its 6 kB warning.
- **Nothing at runtime.** The simulation's cost per tick, the frame time in
  the browser and the server-rendered pages' load time are not measured.
  The game is where this hurts: online matches run in lockstep on the CPU
  simulation (ADR 0009), recorded and ranked matches run on the CPU too
  (ADR 0011, 0012), and the Cloud Functions will re-simulate matches within
  a budget of CPU seconds (ADR 0012 sets it from a benchmark). A slower tick
  costs frames on weak phones and money on the server.

Two facts constrain any runtime gate:

- The CI machines are shared and vary. Tasks run on Nx Cloud workers
  (`docker_linux_amd64/extra_large`), several tasks per worker at once, and
  not every run gets the same hardware. An absolute "ms per tick" threshold
  would flake.
- The browsers in CI have no GPU (Chromium falls back to SwiftShader), so
  nothing GPU-bound can be measured there.

## Decision

Four gates, introduced in phases, from cheap and deterministic to noisy.
Only the deterministic ones block a merge from the start; the noisy ones
report first and block only once their numbers have proven stable.

### Gate 1: bundle budgets (blocking, phase 1)

Measured by Angular's own budgets on `esbuild:production`, which `build`
already runs in CI. Deterministic: the same code gives the same bytes.

- **Every app gets an `anyScript` budget** on its largest single script. For
  `bacteria-game-remote` that is the game chunk:
  `{ "type": "anyScript", "baseline": "815kb", "maximumWarning": "5%",
"maximumError": "10%" }`. It caps any one script at that size, so the game
  chunk cannot grow past it; it does not see a smaller chunk grow below it.
- **Every app also gets an `allScript` budget** on the sum of all its
  scripts, initial and lazy, which catches growth in any chunk, and a new
  chunk: `bacteria-game-remote` totals about 1,061 kB raw, so
  `{ "type": "allScript", "baseline": "1061kb", "maximumWarning": "5%",
"maximumError": "10%" }`. The other apps get both forms, measured on
  their own builds.
- **`initial` stays**, tightened to the measured size plus headroom where it
  is far below its limit (`bacteria-game-remote`: baseline 241 kB, warning
  +10%, error +20%), so the shell's and the PWA's start-up cost is
  guarded at the size it has, not at 1 MB.
- **`anyComponentStyle` stays as is.** The `evolution.component.scss`
  warning is fixed in the phase-1 PR, not hidden by a raised limit.
- **The admin area must not reach the game's chunk** (ADR 0012): the
  `check-lazy-admin` check reads the esbuild metafile; it lands with the
  admin lib and runs as part of `build`.

### Gate 2: engine benchmark (blocking, phase 2)

A Node benchmark of the pure engine, the code online matches, replays and
the server all run.

- **What it runs**: `engine.ts`, bundled with esbuild exactly as
  `engine-bundle.spec.ts` does, plays fixed replays to the end:
  - the golden replay (`state/golden-replay.json`), short and small;
  - a heavy fixture: a generated level at the highest daily difficulty, the
    largest map, neutral colonies, the online grid, about 60 s of play. This
    is the same case ADR 0012 benchmarks to set the server's budgets, so
    both use one fixture.
- **How it measures**, to cope with shared machines:
  - Each fixture runs 1 warm-up and then 7 timed runs; the median counts.
  - In the same process, right before and after, a **calibration loop** of
    fixed work (a typed-array loop of the kind the simulation does) is
    timed the same way. The gate compares the **ratio** engine time /
    calibration time, not milliseconds. A slower or busier machine slows
    both, and the ratio stays roughly stable.
  - It also checks the result: the checksum and outcome must match the
    fixture's, so a "faster" engine that plays differently fails.
  - Optionally (`--expose-gc`) it reports the heap a play keeps once it is
    over, as a sign of a leak; reported, not gated.
- **The baseline** is a committed file, `tools/perf/engine-baseline.json`,
  holding the ratio per fixture. The gate:
  - fails when a ratio is more than **20%** above its baseline;
  - warns (job summary) above 10%;
  - says so when a ratio is more than 10% **below** it, so the baseline can
    be lowered and keep the gain.
- **Where it runs**: an Nx target `perf` on `feat-lazy-bacteria-game`
  (`nx:run-commands`, `node tools/perf/engine-bench.mjs`), with
  `"parallelism": false` so no other task shares the worker while it
  measures, and cached on the engine's production files plus `tools/perf/`.
  CI adds `perf` to the `nx affected -t=...` call and to `stop-after` in
  `.nx/ci-config.yaml`; it only runs when the engine is affected.
- **Before blocking**, it runs report-only for two weeks (about 20 runs on
  `main`). If the ratio spreads by more than ±7% between runs of the same
  code, the thresholds are widened or the calibration reworked before it
  blocks.

### Gate 3: frame time in the browser (report-only, phase 3)

A Playwright spec, `apps/bacteria-game-remote/e2e/perf.spec.ts`, plays a
fixed-seed local match on the CPU simulation for 20 s and records:

- the frame interval (p50, p95) from `requestAnimationFrame`;
- long tasks (over 50 ms) from a `PerformanceObserver`;
- the engine's own time per tick, through a debug hook the game exposes
  only when a test flag is set (no cost in normal play).

It also runs the calibration loop in the page and reports ratios, as gate 2
does. The numbers go into the job summary and an artifact. It does not
block: headless Chromium without a GPU on a shared worker says little about
a phone. It shows trends, and catches order-of-magnitude regressions (a
frame that used to take 5 ms taking 50 ms). Whether it ever blocks, and on
what, is decided after a month of data.

The GPU path is not measured in CI. A change to the GPU simulation or the
GL painters gets a manual check on a real device, noted in the PR.

### Gate 4: page load (report-only, phase 4)

Lighthouse CI (`@lhci/cli`) against the production builds of the pages
people land on from search: `portfolio`, `angular-examples`, the
`rollapolla-analog` SSR pages and, once they exist, the public replay pages
of ADR 0011. Assertions on LCP, total blocking time, CLS and total byte
weight, report-only, uploaded to temporary public storage per run. Blocking
is decided after a month, like gate 3.

### Rules for every gate

- **A failing gate is fixed in the code, not in the threshold.** A budget or
  baseline is only raised when the growth is wanted (a new feature that has
  to be in that chunk, a heavier simulation that buys gameplay). Then the PR
  raises it in a commit of its own, `perf(<project>): ...`, and says in its
  body what grew, by how much and why.
- **Lowering is always welcome**: when a gate reports a gain, the PR lowers
  the baseline in the same way.
- **Gates run only where they mean something**: budgets on every production
  build, `perf` only when the engine is affected, the report-only gates only
  on PRs that affect their app.

## Consequences

- Growth of the game's chunk, and a slower engine, become visible in the PR
  that causes them instead of weeks later on a phone.
- The engine benchmark adds a few minutes to runs that touch the engine, on
  a worker it has to itself.
- Raising a limit becomes a decision written into the history, not a
  side effect.
- The benchmark and the server's verification budget (ADR 0012) share one
  fixture, so the server's budgets can be re-derived from the CI numbers.
- Runtime numbers from CI stay indicators. Real-device performance, above
  all on the GPU path, still needs a manual check.

## Rollout

1. **Phase 1, budgets**: `anyScript` and tightened `initial` budgets for
   every app, the `evolution.component.scss` warning fixed. Blocking at once.
   - As built (2026-10-26): `initial`, `anyScript` and `allScript` with a
     `baseline` on all five Angular apps, measured through the federation
     build. The numbers had moved since this ADR: `bacteria-game-remote`'s
     largest script is 622 kB (the game's chunk, split since), all its
     scripts 1,768 kB (the admin area, the replay viewer and the error
     reports came since), initial 227 kB. The stylesheet warnings are three
     by now (`new-game`, `bacteria-game`, `evolution`); they moved to a PR of
     their own, since trimming them needs a look at the screens.
   - The stylesheet warnings, fixed: `evolution` and `new-game` group the
     rules they repeated (panels, display-face titles, the card buttons, the
     panes that fill and scroll); the training's mission list
     (`MissionListComponent`) and the HUD bar above the arena
     (`HudBarComponent`) became components of their own, their styles with
     them. `new-game` 7.37 → about 5.4 kB, `bacteria-game` 6.68 → about
     5.7 kB, `evolution` 6.09 → about 5.9 kB; the screens compared pixel for
     pixel before and after.
2. **Phase 2, engine benchmark**: `tools/perf/engine-bench.mjs`, the heavy
   fixture, `engine-baseline.json`, the `perf` target and the CI wiring;
   report-only for two weeks, then blocking.
   - As built (2026-10-27): the heavy fixture
     (`tools/perf/fixtures/expanse-heavy.json`) differs from the plan.
     Generated levels are always the small map and have no neutral
     colonies, so it plays `expanse` (the large map, with neutrals) against
     the hard computer on the online grid (640×360), with steers, drags and
     a boost from the human seat. It plays 10 s, not 60: the cost grows
     with the bacteria, and 60 s took about 58 s per run, 8 runs per
     fixture. The golden replay is timed twice, on `cpu` and on `gpu-int`
     (`IntSimulation`), since ranked matches and the server's verification
     take `gpu-int`. Each fixture is played on the current
     `BALANCE_VERSION`, as `golden-replay.spec.ts` plays it.
   - The calibration loop proved the noisy half: its first runs were at
     times twice as slow, so it warms up 10 times and takes the median of
     15 runs before and 15 after; esbuild's service is stopped before the
     timing starts. On a developer's machine the ratios still spread by
     about ±10% between runs of the same code; on the Nx Cloud workers two
     runs agreed within 1.3%, but a third measured 40-50% higher ratios
     (the calibration loop faster, the engine slower): the workers are not
     all alike, and the loop does not even out every CPU. The report names
     the CPU it ran on; before the gate blocks, the two weeks of reports
     show whether baselines are needed per CPU model or the calibration
     loop must change. The ratios do not carry over between machines
     or Node versions (CI's were 40-50% below a developer's), so the
     baseline holds CI's. The two weeks of reports decide whether the ±7%
     this ADR allows holds there.
   - The heap figure is the heap a play keeps once it is over (averaged
     over 3 plays), not growth per 1,000 ticks: the replays are a few
     hundred ticks long, and V8's own few hundred KiB either way looked like
     a leak when scaled up.
   - A baseline counts only on the Node major it was measured on (the
     baseline names it): CI runs `.nvmrc`'s Node 24, whose V8 optimises
     otherwise than a developer's Node 22. The baseline holds CI's ratios, the
     mean of two runs' output on this PR (`--update` on a developer's
     machine would write that machine's). A fixture that no
     longer parses or plays back is a failed row, so `--report-only` still
     reports it.
   - The target runs `--report-only` (it never fails) and takes about 1.5
     minutes. To block, drop that flag from the `perf` target.
3. **Phase 3, browser frame time**: `perf.spec.ts` and the debug hook,
   report-only.
   - As built (2026-10-27): the fixed seed comes from the spec, not the
     game: an init script pins `Math.random` to a seeded generator before
     the page loads, which fixes the match's seed and every other draw. The
     debug hook is `state/perf-probe.ts`: the spec puts
     `window.__bacteriaPerfProbe` on the page, and `GameStateService`
     times each tick only when it finds one (one null check per tick in
     play). The match is the campaign's first against the computer, the
     player idle, on `?sim=cpu`. The numbers go to the log and the
     attachment `frame-time.json`; the job summary only where
     `GITHUB_STEP_SUMMARY` is set, which the Nx Cloud workers that run the
     e2e tasks don't have. Two local runs on SwiftShader: frame interval
     p50 66.7 / 66.6 ms, p95 83.4 ms both, tick p50 2.7 / 2.4 ms, 898 / 937
     ticks in 20 s (the game slows its clock when frames run long), about
     260 long tasks: the painting on a software renderer, not the engine,
     sets the pace there.
4. **Phase 4, Lighthouse**: report-only.
   - As built (2026-10-27): a `lighthouse` target on `portfolio`,
     `angular-examples` and `rollapolla-analog`, depending on `build`, in
     `nx affected` and `stop-after` like `perf`. Each app's
     `lighthouse.json` names what to serve and which pages, and
     `tools/perf/lighthouse-run.mjs` adds the shared settings (a relative
     import from an app into `tools/` breaks the module boundaries). They
     warn only, so the run fails only when
     nothing could be measured; Chrome is Playwright's, which the workers
     install for the e2e tasks. The ADR's assertions are on LCP, TBT, CLS
     and total byte weight at Lighthouse's own "good" marks. rollapolla's
     SSR build (Nitro's `firebase` preset) exports a function and listens
     nowhere, so `tools/perf/serve-firebase-function.mjs` serves it the way
     Hosting does: the public folder first, the function for the rest. The
     public replay pages are left out for now: they are a Cloud Function
     behind Hosting and need the functions emulator.
   - First local numbers (mobile, headless, no GPU): `angular-examples` `/`
     LCP about 12 s; its total blocking time was about 139 s while Chrome
     drew the title's shader on software WebGL, and about 4.4 s once
     `--disable-gpu` took WebGL away (the CI workers' containers need it,
     with `--disable-dev-shm-usage`, or the tab crashes).
     The title's shader then got paced (`RenderShaderComponent`'s
     `resolutionScale`, `maxFps`, `startWhenIdle`, `stillOnSlowRenderer`):
     half the resolution, 20 fps, started once the page is idle, and one
     still frame on a software renderer or with reduced motion. Measured
     with WebGL on SwiftShader, TBT went from about 141 s to 7.5-13 s; what
     is left is the app's own start (polyfills, the main chunks), not the
     shader.
     `rollapolla-analog` `/` LCP 8-15 s, TBT about 300 ms, 2.1 MB, `/polls`
     LCP 13-15 s. The portfolio's prerender does not run
     in the development container; CI measures it.

Each phase is its own PR. CLAUDE.md's "Performance gates" section says what
is in place; it is updated with each phase.
