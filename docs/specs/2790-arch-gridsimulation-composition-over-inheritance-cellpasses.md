# Spec: GridSimulation, composition over inheritance (CellPasses)

Issue: [#2790](https://github.com/WolfSoko/wol-sok-mono/issues/2790), candidate 14 of
[#2776](https://github.com/WolfSoko/wol-sok-mono/issues/2776) in
`docs/bacteria-game/architecture-deepening.md`. Depends on
[#2779](https://github.com/WolfSoko/wol-sok-mono/issues/2779) (merged as `SimulationProvider`).

## Goal

The grid war's bookkeeping becomes one concrete, testable module, `GridWar`.
It runs over a narrow port, `CellPasses`, and three adapters fill that port.
This replaces the abstract `GridSimulation` with its eight `protected
abstract` hooks and the mutable fields its subclasses write. The parts
`BacteriaSimulation` and `GridSimulation` copy word for word move into one
shared `ArenaFixtures`.

Today:

- `state/grid-simulation.ts` (engine) is an abstract base. `IntSimulation`
  (engine) and `GpuSimulation` (game, `gl/gpu-simulation.ts`, 1257 lines)
  extend it.
- The subclasses write the base's `escapePending`, `maskDirty` and
  `reportStep`. Ordering rules (reports before pellets in a deterministic
  match) live only in comments.
- `GpuSimulation` holds two simulations in one class, switched by
  `deterministic` across programs, match uniforms, frame uniforms, the
  effect format, the seed and the readback policy.

## Non-goals

- No change to what any pass computes, to the tick order or to the number
  of random draws. `golden-replay.json`, `golden-gpu-int.json`,
  `golden-gpu-sim.json` and `SELF_TEST_GOLDEN` stay byte-equal. No
  `BALANCE_VERSION` or `GPU_SELF_TEST_VERSION` bump.
- No change to the shaders' source, to `intReferenceTick` or `intReport`,
  or to the active area's rules (`updateArea`, `activeRects`).
- `BacteriaSimulation`'s cell rules (combat, division, movement, eviction)
  stay as they are. It only takes the shared `ArenaFixtures`.
- `Simulation` keeps its shape (`kind`, `ruleset`, the methods), and so do
  `SimulationProvider` and `chooseSimulation`. Folding `kind` into
  `ruleset` is the follow-up #2779 already raised.

## Design

### `ArenaFixtures` (engine, `state/arena-fixtures.ts`)

The cell-independent part of a match that both `BacteriaSimulation` and
`GridWar` hold, today copied between them:

- the map (`map`, `setMap` stores it; each simulation keeps its own
  reaction: `BacteriaSimulation` restamps and resets at once, `GridWar` waits
  for the next `init`, as today);
- the pellets (`NutrientPellets`, built with the simulation's `random` at
  the same point as today, so no draw moves);
- the weapons' effects (`WeaponEffects`);
- the moving walls: `startWalls(width, height, elapsedSec)` (the walls as
  of match time) and `advanceWalls(width, height, elapsedSec): boolean`
  (moves them on, adds `gatesClosed`/`gatesWarned` to the events, returns
  whether they changed);
- the tick's `events` and `resetEvents()`;
- the read side the `Simulation` interface asks for: `getNutrients`,
  `getActiveEffects`, `addEffect`, `getDynamicWalls`, `getEvents`.

Each simulation delegates those five methods to it. The wall reaction (evict
on the CPU, escape passes on the grid) stays with the simulation.

### `CellPasses` port (engine, `state/grid/cell-passes.ts`)

What `GridWar` needs from whatever runs the cell passes and renders the
report:

```ts
interface CellPasses {
  readonly kind: 'gpu' | 'int';
  /** Integer passes, reports exactly `DETERMINISTIC_REPORT_LAG` ticks old. */
  readonly deterministic: boolean;
  ready(): boolean;
  allocate(arena: GridArena): void; // width, height, report layout
  startMatch(): void;
  loadMask(mask: Uint8Array, hasHill: boolean): void;
  loadState(state: Uint16Array): void;
  uploadFrame(frame: GridFrame): void; // uniforms, counts, delta time
  collectReports(tick: GridTickInfo, sink: ReportSink): void;
  runTick(tick: GridTick, sink: ReportSink): void;
  colonyLayers(colonies: GridColonies, boosts): ColonyLayer[];
  readState(): Uint16Array | null;
  takeGpuWaitMs?(): number;
  attach(host: CellPassesHost): void; // restart after a lost context
  dispose(): void;
}
```

- A `ReportSink` (`take(report, generation, step)`) replaces the
  subclasses' writes of `reportStep` and their calls of `takeReport`.
  `GridWar` is the sink, so the report bookkeeping has one owner. The GPU
  float adapter keeps taking its reports in the middle of `runTick`, at the
  same point as today. Moving that point would change when readback
  buffers free up.
- The tick carries what the passes read from the war: the step, the most
  steps a colony moves, the escape steps (0 when no wall moved), the colony
  count, the report in hand with its step, and the match seed. Adapters read
  no field of `GridWar`. `GridWar` clears `escapePending` and `maskDirty`
  itself after the call that consumed them.
- `deterministic` on the port replaces `GridSimulation`'s option:
  `GridWar` derives `ruleset` (`gpu-int` or null), the report lag and when
  reports are collected from it. The ordering rule "reports before pellets
  in a deterministic match" becomes one named step in `GridWar.step`, and a
  spec covers it.
- `GridWar` fills the effects' circles in both formats every tick: each
  mode's passes read only their own, so nothing a pass computes changes.
  Today's `deterministic` branch goes.

### `GridWar` (engine, `state/grid/grid-war.ts`)

A concrete `Simulation`: `new GridWar(passes, balance, random, matchSeed)`.
It holds what `GridSimulation` holds today, the copied parts going to its
`ArenaFixtures`: walls and zones (mask), pellets and their drain, effects,
the frame uniforms, `takeReport`, block counts, `nearestEnemy`, the bounds
for the painter and the divide budget. Its `kind` is the port's; its
`readState()` and `takeGpuWaitMs()` forward to the port.

### Three adapters

- **Integer reference** (engine, `state/gpu-int/int-reference-passes.ts`):
  today's `IntSimulation` body (state, scratch, report buffers, pending
  reports, `collectBacterias`, `tickInputs`), as a `CellPasses`. The engine's
  `intSimulation` factory returns `new GridWar(new IntReferencePasses(...))`.
  The class `IntSimulation` goes. Its callers (specs, the bench, the
  goldens' specs) build one through `intSimulation`.
- **GPU int / GPU float** (game, `gl/gpu-cell-passes.ts` and
  `gl/gpu-rules.ts`): `GpuCellPasses` keeps the machinery both share today:
  resources, `pass`, `statePass`, `claimAndApply`, the active area, the glow,
  the report and the readbacks. Two `GpuRules` hold what the `deterministic`
  flag switches today: which cell programs are compiled, the match uniforms,
  the frame upload, the effect upload, the seed, the readback lag and whether
  a readback is created when none is free. `gpuIntRules` and `gpuFloatRules`
  are the two adapters; no `deterministic` branch is left in the GPU code.
  The game's `gpuSimulation(gl, balance, random, options)` returns a
  `GridWar`, and `GlArenaPainter.createSimulation`, the self-test and the
  cross-check harness use it. The class `GpuSimulation` goes.
  `GpuSimulationOptions` stays as the factory's options.

## Decisions

1. **The port takes a sink instead of returning reports.** The GPU float
   adapter takes reports between its glow pass and its next readback
   request. A sink keeps that exact point without `GridWar` knowing it.
   Returning a list would move the point.
2. **One `GpuCellPasses` with two rules, not two classes.** About 80% of
   `GpuSimulation` is the same in both modes (resources, area, readbacks).
   Two full adapters would copy it, and a base class would bring back the
   inheritance this issue removes.
3. **The old classes go, and factories stand in their place.** Replace,
   don't layer: `IntSimulation` and `GpuSimulation` are removed rather
   than kept as subclasses or aliases. `instanceof IntSimulation` checks
   become `kind === 'int'`. Comments that name either class are updated.
4. **`ArenaFixtures` keeps each simulation's own reaction.** `setMap` and
   the wall move do different things on the CPU (restamp, evict) and on
   the grid (wait for `init`, escape passes). Unifying them would change
   `cpu` replays.
5. **File layout.** The bookkeeping goes into a folder of its own,
   `state/grid/`, with the port and a spec. The integer adapter stays in
   `gpu-int/` beside the reference it runs.

## Acceptance

1. `GridWar` is concrete and has no `protected abstract` member. No
   adapter writes a field of `GridWar`, and `grid-simulation.ts` is gone.
2. `grid-war.spec.ts` drives `GridWar` with a stub `CellPasses` and checks
   the bookkeeping:
   - a deterministic port gets `collectReports` before the pellets tick
     and before `uploadFrame`; a float one gets it only through `runTick`;
   - `escapeSteps` is non-zero only in the tick after a wall moved, and
     `loadMask` runs once after each change;
   - a report taken through the sink sets the step, the summaries, the
     events (captures, crushed) and drains the pellets of its generation;
   - `ruleset` and the report lag follow `deterministic`;
   - `init` with more colonies than `MAX_GPU_COLONIES` throws.
3. `arena-fixtures.spec.ts` covers the wall advance (changed, gate events)
   and the delegated getters.
4. The integer adapter's spec replaces `int-simulation.spec.ts` and plays
   the same scenarios through `intSimulation`.
5. Goldens untouched: no `golden*.json`, `self-test-golden.ts` or
   `BALANCE_VERSION` in the diff. `golden-replay.spec.ts`, `golden.spec.ts`,
   `sim-golden.spec.ts` and `self-test-golden.spec.ts` pass.
6. No `deterministic` branch is left in the game's GPU code outside the
   two `GpuRules`. The GPU cross-check (`e2e-ci` of the game lib, on
   SwiftShader) passes in CI.
7. The engine stays Node-only (`engine-bundle.spec.ts`), and `perf` reports
   no slowdown above its warning threshold.
8. `lint`, `lint-templates` and `test` pass for the engine, the game lib
   and the functions. The game lib's `CLAUDE.md` describes `GridWar`,
   `CellPasses` and the adapters in place of `GridSimulation`,
   `GpuSimulation` and `IntSimulation`.
9. The PR lists the real-device GPU check as open for the owner: a
   campaign match on the float GPU simulation and a `gpu-int` match (or the
   self-test passing) on a real device. A cloud session has no GPU.

## Open questions

- None that block the work. The real-device check (acceptance 9) can only
  be done by the owner.
