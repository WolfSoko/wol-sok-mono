# Simulation carries both kind and a nullable ruleset

Issue: [#2801](https://github.com/WolfSoko/wol-sok-mono/issues/2801)

## Goal

The engine's `Simulation` (`libs/features/bacteria-engine/src/lib/state/simulation.ts`)
says what runs the war in two fields, `kind` (`'cpu' | 'gpu' | 'int'`) and
`ruleset` (`Ruleset | null`). Of their six combinations only four exist:

| `kind` | `ruleset` | what it is                                       |
| ------ | --------- | ------------------------------------------------ |
| `cpu`  | `cpu`     | `BacteriaSimulation`                             |
| `int`  | `gpu-int` | `GridWar` on `IntReferencePasses` (CPU fallback) |
| `gpu`  | `gpu-int` | `GridWar` on the integer GPU passes              |
| `gpu`  | `null`    | `GridWar` on the float GPU passes                |

Callers combine both (the HUD label, the GPU timer, analytics, the replay's
ruleset). Fold them into one value, `variant: SimulationVariant`
(`'cpu' | 'cpu-int' | 'gpu-int' | 'gpu-float'`), so the impossible pairs can't
be written and each caller asks one question.

## Non-goals

- No change to `Ruleset` itself, to what replays, online messages, boards or
  the Cloud Functions store, or to which simulation a device picks
  (`chooseSimulation`, `createSimulationProvider`).
- No change to how the simulations compute; goldens and `BALANCE_VERSION`
  stay.

## Decisions

1. **One field `variant`** replaces `kind` and `ruleset` on `Simulation`.
   Named `variant`, not `engine`: `engine` is already the `MatchEngine` in
   `PlayerService`.
2. **Two pure helpers beside it** in `simulation.ts`, exported from the engine:
   `rulesetOf(variant): Ruleset | null` (`cpu` → `cpu`, `cpu-int`/`gpu-int`
   → `gpu-int`, `gpu-float` → `null`) and `runsOnGpu(variant): boolean`.
   Callers use those instead of comparing pairs.
3. **`CellPasses` names its variant too**: `variant: GridVariant`
   (`Exclude<SimulationVariant, 'cpu'>`) replaces `kind: 'gpu' | 'int'`, and
   `GridWar.variant` is the passes'. `GpuCellPasses` takes it from its rules
   (`gpu-int` with a report lag, `gpu-float` without). `reportLag` stays: it is
   a number the war needs, not a label. A pass adapter that is `cpu-int`
   without a lag no longer can be described by the type system as "int and
   float"; the spec stub follows the real adapters.
4. **HUD label** is a lookup on the variant: `CPU`, `CPU int`, `GPU int`,
   `GPU float` (unchanged texts).
5. **The arena's `data-simulation` attribute** shows the variant
   (`gpu` becomes `gpu-int` or `gpu-float`, `int` becomes `cpu-int`); the e2e
   that checks it is updated.
6. **Analytics**: match events send `simulation` = the variant and no
   longer a `ruleset` param, since it follows from the variant. The owner
   said the analytics labels don't matter at this stage (issue comment of
   2026-11-08). `docs/analytics.md` is updated; the privacy policy already
   says only "which simulation", so it stays.

## Acceptance

- A1 `Simulation` has `variant` and neither `kind` nor `ruleset`; `CellPasses`
  has `variant` and no `kind`; the code compiles (`typecheck-specs` of the
  game lib, builds of engine, game lib, remote and functions).
- A2 `rulesetOf` and `runsOnGpu` are spec'd for all four variants.
- A3 `BacteriaSimulation` is `cpu`, `GridWar` on `IntReferencePasses`
  `cpu-int`, on the deterministic GPU passes `gpu-int`, on the float ones
  `gpu-float` (specs).
- A4 The HUD shows the same four labels as before (spec).
- A5 The GPU timer still runs only for the GPU variants; `PlayerService`
  still disposes a GPU match when the GPU goes away and reports the same
  ruleset for replays (specs).
- A6 Match events carry `simulation` = variant and no `ruleset`
  (`match-analytics.spec.ts`); `docs/analytics.md` matches.
- A7 Tests of engine, game lib, remote and functions, lint and format pass.

## Open questions

None.
