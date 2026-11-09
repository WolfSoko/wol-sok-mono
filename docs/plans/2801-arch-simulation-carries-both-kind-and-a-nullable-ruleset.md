# Plan: one `variant` in place of `kind` and `ruleset`

Spec: [docs/specs/2801-arch-simulation-carries-both-kind-and-a-nullable-ruleset.md](../specs/2801-arch-simulation-carries-both-kind-and-a-nullable-ruleset.md)

One commit for the type change: removing two fields from an interface does
not compile in halves.

1. **Engine type and helpers** — `libs/features/bacteria-engine/src/lib/state/simulation.ts`:
   `SimulationVariant`, `GridVariant`, `rulesetOf`, `runsOnGpu`; `Simulation.variant`.
   Test first: `simulation.spec.ts` for the helpers over all four variants.
2. **Engine implementations** — `bacteria-simulation.ts` (`variant = 'cpu'`),
   `grid/cell-passes.ts` (`variant: GridVariant`), `grid/grid-war.ts`
   (`variant` from the passes), `gpu-int/int-reference-passes.ts`
   (`cpu-int`), `simulation-provider.ts` if it reads them. Specs:
   `grid-war.spec.ts`, `int-reference-passes.spec.ts`,
   `simulation-provider.spec.ts`.
3. **Game lib** — `gl/gpu-cell-passes.ts` (variant from its rules),
   `hud-perf.ts` (`simulationLabel(variant)`), `stage/stage-frame.ts`
   (`runsOnGpu`, `data-simulation`), `state/player.service.ts`
   (`rulesetOf`, `runsOnGpu`), `analytics/match-analytics.ts` and
   `game-analytics.ts` (drop `ruleset`). Specs: `hud-perf` (new or
   existing), `stage-frame.spec.ts`, `player.service.spec.ts`,
   `game-state.service.spec.ts`, `match-analytics.spec.ts`,
   `simulation-choice.spec.ts`.
4. **E2E and docs** — `apps/bacteria-game-remote/e2e/bacteria-game-remote.spec.ts`
   (`data-simulation` `gpu-int`), `docs/analytics.md`.
5. **Checks** — `nx affected -t lint,lint-templates,test,typecheck-specs`,
   `nx format:check`; commit
   `refactor(feat-shared-bacteria-engine): fold the simulation's kind and ruleset into one variant`.
