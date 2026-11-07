# Spec: `SimulationProvider`, ruleset to simulation, with fallback

Issue: [#2779](https://github.com/WolfSoko/wol-sok-mono/issues/2779), candidate 3 of
[#2776](https://github.com/WolfSoko/wol-sok-mono/issues/2776)
(`docs/bacteria-game/architecture-deepening.md`, section 3).

## Goal

One engine module answers "which simulation plays this ruleset, and what
stands in when the GPU fails". Today the answer is rebuilt in four places:
`replayEngine` (engine `state/replay.ts`), `PlayerService.init` and
`PlayerService.createSimulation` (game `state/player.service.ts`), and
`engineOf` in `replays/replay-scene.ts`. `PlayerService.useSimulation`
takes five parameters that must agree (`factory`, `fallback`, `ruleset`,
`offers`, `gpuInt`).

After the change:

- The engine has `state/simulation-provider.ts` with the interface
  `SimulationProvider` and the function `createSimulationProvider(sources)`.
- `simulationFor(request, arena?)` returns the `SimulationFactory` for one
  match. `request` is a `Ruleset` (`cpu`, `gpu-int`) or `'device'` (what
  this device plays a match of its own on right now).
- `ruleset()` is the ruleset `'device'` plays by right now (null for the
  float GPU simulation); `offers()` is what the device offers the other
  device of an online match; `gpuIntReady()` says whether `gpu-int` plays on
  the GPU here.
- The provider owns the fallback: when a GPU simulation fails to start (in
  its factory or while being sized to the arena) it disposes of what was
  built, warns, calls `onFallback`, and steps down for good: this match
  plays on the stand-in (`IntSimulation` for `gpu-int`, `BacteriaSimulation`
  for `'device'`), later `'device'` matches play `cpu`, `ruleset()` is
  `cpu`, `offers()` is `['cpu']` and `gpuIntReady()` is false.
- `CPU_SIMULATIONS` (a provider without a GPU) is the engine's default:
  `cpu` plays on `BacteriaSimulation`, `gpu-int` on `IntSimulation`,
  `'device'` on `BacteriaSimulation`.
- The game supplies only the GPU adapter (`gpu: { int, float? }`) and what
  the device plays and offers (`plays()`, `offers()`), worked out from the
  owner's toggle, the self-test and the device override in
  `gl/simulation-choice.ts` (`chooseSimulation` now returns
  `SimulationSources`).
- `PlayerService.useSimulation(...)` becomes
  `useSimulations(sources | null)` (the sources without `onFallback`,
  which the service adds); `PlayerService.init` only turns its options into a request. `replayEngine(replay, onSecond,
simulations)` takes a provider; `replayRun` (MatchRun,
  [#2780](https://github.com/WolfSoko/wol-sok-mono/issues/2780)) builds one
  from the GPU's integer passes, so the replay scene no longer carries a
  fallback of its own.

## Non-goals

- The `Simulation` interface keeps `kind` and `ruleset`
  (`stage-frame.ts`, `match-analytics.ts`, `game-state.service.ts` read
  them). Folding the two is a change to the analytics events and the HUD
  and goes to the manager as a follow-up.
- No change to what any device plays, offers or records, to the tick order,
  the goldens (`golden-replay.json`, `golden-gpu-int.json`,
  `golden-gpu-sim.json`, `SELF_TEST_GOLDEN`) or `BALANCE_VERSION`.
- `MatchRun` (#2780) and `GridSimulation` (#2790) are separate candidates.

## Decisions

1. **Request, not factory, at the call site.** Callers say what they need
   (`'gpu-int'` for a ranked or agreed online match, the device's ruleset
   for a recorded local one, `'device'` otherwise); the provider decides
   the processor. That removes the `devicePicks`/`wanted`/`gpu` branching
   from `PlayerService.init`.
2. **The device's choice is a value, `DevicePlay = Ruleset | 'gpu-float'`.**
   `plays()` is read as each match starts (the owner's toggle may answer
   late; a match keeps what it started with). The provider maps it to a
   factory: `gpu-int` and `gpu-float` on the GPU adapter, `cpu` on
   `BacteriaSimulation`. A GPU value without an adapter plays `cpu`.
3. **Fallback targets keep the ruleset where the match needs it.** A
   requested `gpu-int` falls back to `IntSimulation` (same war); `'device'`
   falls back to `BacteriaSimulation` (as today). A failing CPU or
   `IntSimulation` is not caught: there is nothing left to fall back to.
4. **Sizing in the provider.** `simulationFor(request, arena)` sizes the new
   simulation inside the same `try`, because a GPU that cannot render into
   its formats fails in `resize`. `replayEngine` passes no arena (sizing a
   CPU replay earlier than today would change the order of its setup); the
   replay's GPU adapter sizes itself and disposes of itself when that
   fails, as today.
5. **Side effects through `onFallback`.** The engine stays free of Angular
   and analytics: `PlayerService` builds the provider from the game's
   sources and passes `onFallback`, which tracks `simulation_fallback` and
   drops its `gpuIntReady` signal. The provider's warning goes to
   `console.warn` (fine in Node).
6. **Replays: the provider's fallback, plus the engine's setup guard.**
   `replayRun` (added by #2780 while this was open) builds its
   `SimulationProvider` from `gpuInt`; a GPU failing to start or to be
   sized falls back through the provider. `replayRun` keeps one guard of
   its own for a failure in `MatchEngine`'s setup after the GPU's
   simulation was built: it disposes of what was built and plays on
   `IntSimulation`, as before. Both tell `onGpuFailure` once.
7. **Replace, don't layer.** `useSimulation`'s five parameters, the
   fields `simulationFactory`, `fallbackFactory`, `factoryRuleset`,
   `offers`, `gpuIntFactory` and `createSimulation` go away. The fallback
   cases of `simulation-choice.spec.ts` and `player.service.spec.ts` move
   into `simulation-provider.spec.ts` (engine). The choice cases stay in
   `simulation-choice.spec.ts`, rewritten against `plays()`/`offers()`.

## Acceptance

1. `simulation-provider.spec.ts` covers: the default provider; each request
   with and without a GPU adapter; fallback for `'device'` and `gpu-int`
   (dispose, warn, `onFallback`, step down for later matches, `offers`,
   `ruleset`, `gpuIntReady`); sizing failure falls back; a failing
   stand-in is not swallowed; `plays()` read per match.
2. `simulation-choice.spec.ts` keeps every choice case (toggle, self-test,
   override, no WebGL2) against `plays()`/`offers()`.
3. `PlayerService` specs: online/ranked/recorded matches pick the right
   request; the fallback cases are gone from there.
4. `replayEngine` takes a `SimulationProvider`, and `replayRun` falls
   back through one; `replay-scene` has no fallback of its own.
5. Goldens untouched: `golden-replay.spec.ts`, `golden.spec.ts`,
   `sim-golden.spec.ts`, `self-test-golden.spec.ts` pass with no fixture
   change; no `BALANCE_VERSION` bump.
6. `feat-shared-bacteria-engine` still imports no Angular, RxJS, Firebase
   or DOM.
7. `npx nx affected -t lint,lint-templates,test,build` green;
   `CLAUDE.md` names the provider where it describes the simulations.

## Open questions

None blocking. The `kind`/`ruleset` fold is raised as a follow-up.
