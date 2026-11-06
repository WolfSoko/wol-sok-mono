# Spec: `MatchRun`, one runner that plays a match to its end

Issue: [#2780](https://github.com/WolfSoko/wol-sok-mono/issues/2780), candidate 4 of
[#2776](https://github.com/WolfSoko/wol-sok-mono/issues/2776)
(`docs/bacteria-game/architecture-deepening.md`).

## Goal

One engine module, `MatchRun` (`libs/features/bacteria-engine/src/lib/state/match-run.ts`),
owns the loop that plays a `MatchEngine` on: the arena size it ticks with,
the tick budget (the match's last tick), "over" (an outcome or the last
tick), playing a frame's ticks under an optional deadline, seeking (forwards
by playing on, backwards by building the engine anew), the result with its
checksum, and disposing once. Its callers stop writing
`while (outcome() == null && tickCount < N) engine.tick(width, height)`.

Interface:

```ts
export interface MatchArena {
  width: number;
  height: number;
}

// state/replay.ts, beside replayEngine (match-run.ts imports nothing of replays):
export function replayRun(
  replay: Replay,
  options?: ReplayRunOptions
): MatchRun | null;

export class MatchRun<E extends RunnableEngine = MatchEngine> {
  public constructor(build: () => E, arena: MatchArena, lastTick: number);
  public get engine(): E;
  public get tickCount(): number;
  public get over(): boolean;
  public get seeking(): boolean;
  public get shownTick(): number;
  public advance(maxTicks: number, deadline?: () => boolean): number;
  public seek(tick: number): void;
  public result(): MatchRunResult; // players, outcome, ticks, checksum
  public dispose(): void;
}
```

`RunnableEngine` is the slice of `MatchEngine` the run needs (`tick`,
`outcome`, `tickCount`, `players`, `dispose`), so the loop's edge cases are
tested on a small fake as well as on real matches.

## Callers moved onto it

| Caller                                     | Today                                           | After                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `playReplay` (`state/replay.ts`)           | own loop, `try`/`finally`, checksum             | `replayRun(...)`, `advance(Infinity)`, `result()`; signature unchanged                                                   |
| balance lab (`state/balance/lab-match.ts`) | own `for` loop to `maxTicks`                    | `MatchRun` with `lastTick = maxTicks`, measuring after each `advance(1)`, stops on a stall                               |
| replay viewer (`replays/replay-scene.ts`)  | own `step`, seek target, deadline loop, rebuild | `MatchRun` built from the scene's engine factory (GPU with CPU fallback); `advance(ticks, deadline)` and `seek` delegate |
| `perf/cpu-simulation.bench.ts`             | own `for` loop                                  | `MatchRun`, timing each `advance(1)`                                                                                     |

## Non-goals

- `GameStateService.advance`. It ticks through `PlayerService` (local or
  online engine), gated by `canTick()` for the peer's inputs, with the match
  clock, the perf probe, `desync` and `endMatch` around each tick: it is not
  the same loop, and #2778 is splitting that service in parallel. Moving the
  live match onto `MatchRun` waits for that split (open question 1).
- `SimulationProvider` (#2779): `replayRun` keeps taking the `gpuInt`
  factory `replayEngine` takes today.
- `replayVerdict()` (#2781).
- Any change to the tick order or to what a tick computes.

## Decisions

1. **Built from an engine factory, not an engine.** Seeking back needs a
   fresh engine (the war plays forwards only); the factory is how the run
   rebuilds without knowing about replays, plans or GPUs. The viewer's
   factory keeps its GPU-to-CPU fallback, so a GPU that fails on a rebuild
   still falls back.
2. **Arena size and last tick in the constructor.** Every caller passed the
   same size on every tick and checked the same budget.
3. **`advance(maxTicks, deadline?)` returns the ticks played.** While a
   seek is under way it plays towards the seek's tick instead of
   `maxTicks`, as the viewer did. The deadline is a predicate checked after
   each tick, so at least one tick is played per call and the engine stays
   free of `performance` (Node and browser alike).
4. **`result()` forms the checksum** (`matchChecksum(players)`), the one
   way it is formed.
5. **`dispose()` is idempotent and ends the run**: `advance` and `seek`
   do nothing afterwards.
6. **`replayRun` lives in `replay.ts`, `replayEngine` stays exported.**
   `playReplay` uses the run, so the run must not import replays (no
   import cycle). The viewer's GPU factory needs `replayEngine`. Its
   tick-by-tick spec moves to `replayRun`.
7. **Replace, don't layer.** The seek specs of `replay-viewer.component.spec.ts`
   that test seeking itself (on and back, no further than the replay) move
   to `match-run.spec.ts`; the viewer keeps the ones about the scene (GPU,
   restart, painting).

## Acceptance

1. `match-run.spec.ts` covers: an outcome on the last tick, the tick budget
   (stops at `lastTick` without an outcome), `advance` playing at most
   `maxTicks`, a deadline stopping after the tick it expires on, seeking
   forwards and back (rebuilding only for back, clamped to `0..lastTick`),
   `result()` with its checksum, and `dispose` (once, and no ticks after).
2. `playReplay`, `playLabMatch`, `ReplayScene` and the CPU bench run on
   `MatchRun`; none of them loops on `engine.tick` any more.
3. `golden-replay.json`, `golden-gpu-int.json`, `golden-gpu-sim.json` and
   `SELF_TEST_GOLDEN` are byte-equal; no `BALANCE_VERSION` bump.
4. `playReplay(replay)` keeps its signature; `tools/perf/engine-bench.mjs`
   and the functions' `verify.ts` are unchanged and their specs pass.
5. The engine stays Node-only (no Angular, RxJS, Firebase or DOM).
6. `nx affected -t lint,lint-templates,test` and the production build of
   `bacteria-game-remote` pass; the replay viewer plays, seeks and ends a
   replay as before (its spec).
7. `CLAUDE.md` names `MatchRun` where it describes replays (the
   "Re-running a replay" line).

## Open questions

1. Should the live match (`GameStateService.advance` through
   `PlayerService`) move onto `MatchRun` once #2778 has split the service?
   Recommended: yes, as a follow-up after #2778, since the online gating
   would have to become a hook of the run.
