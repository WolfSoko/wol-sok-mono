# Plan: GridSimulation, composition over inheritance (CellPasses)

Spec: `docs/specs/2790-arch-gridsimulation-composition-over-inheritance-cellpasses.md`.
Branch: `claude/epic-allen-ir45fm` off `main`. Every task ends green on
`npx nx run-many -t test,lint -p feat-shared-bacteria-engine,feat-lazy-bacteria-game`,
with the goldens' specs among them.

1. **`ArenaFixtures`**
   - Files: `state/arena-fixtures.ts`, `state/arena-fixtures.spec.ts`.
     `BacteriaSimulation` and `GridSimulation` delegate map, pellets,
     effects, walls and events to it.
   - Tests: the new spec (the wall advance and its gate events, the
     getters). `golden-replay.spec.ts` stays green, which proves `cpu` is
     unchanged.
   - Commit: `refactor(feat-shared-bacteria-engine): share the arena fixtures of both simulations`.
2. **`CellPasses` and `GridWar` with the integer adapter**
   - Files: `state/grid/cell-passes.ts`, `state/grid/grid-war.ts` (from
     `grid-simulation.ts`), `state/grid/grid-war.spec.ts` (stub port),
     `state/gpu-int/int-reference-passes.ts` (from `int-simulation.ts`), its
     spec (from `int-simulation.spec.ts`), and `intSimulation` returning a
     `GridWar`.
   - Delete `IntSimulation`. Move the engine's callers and the game's
     specs (`player.service.spec.ts`, `replay-viewer.component.spec.ts`,
     `sim-golden.spec.ts`, the bench) to `intSimulation`. Update the
     `index.ts` exports.
   - `grid-simulation.ts` stays only until task 3, for `GpuSimulation`.
   - Tests: the `grid-war.spec.ts` cases of acceptance 2; `self-test-golden`,
     `sim-golden` and `golden-replay` stay green.
   - Commit: `refactor(feat-shared-bacteria-engine): run the grid war over a CellPasses port`.
3. **GPU adapters**
   - Files: `gl/gpu-cell-passes.ts` (from `gpu-simulation.ts`) and
     `gl/gpu-rules.ts` (`gpuIntRules`, `gpuFloatRules`), with
     `gpuSimulation(gl, …)` returning a `GridWar`.
   - Move `GlArenaPainter.createSimulation`, `gpu-self-test.ts`, the
     cross-check harness, `simulation-choice.ts` and `stage-frame.ts`
     over.
   - Delete `gpu-simulation.ts` and `grid-simulation.ts`.
   - Tests: a spec for `gpu-rules.ts` (seed, lag, readback policy) and the
     existing game specs. Build the lib, then run the GPU cross-check:
     `npx nx run feat-lazy-bacteria-game:e2e-ci` (or its atomized target)
     on SwiftShader.
   - Commit: `refactor(feat-lazy-bacteria-game): split the GPU simulation into cell passes and rules`.
4. **Docs and cleanup**
   - Files: the game lib's `CLAUDE.md`, comments that still name
     `GridSimulation`, `GpuSimulation` or `IntSimulation` (engine, game,
     functions, `tools/perf`), and `architecture-deepening.md` if it marks
     candidates as done.
   - Checks: `npx nx format:write`; the pinned oxfmt `--check` on the
     changed files; `npx nx affected -t lint,lint-templates,test`; the engine's
     `perf`.
   - Commit: `docs(feat-lazy-bacteria-game): describe GridWar and its CellPasses`.
5. **PR**
   - Rebase on `main` first.
   - Open the PR (`Closes #2790`) with spec, plan and code. List the
     acceptance points with their results, and the real-device check as
     open for the owner.
   - Review with a fresh subagent, then test, rebase again, and send the
     `merge` request.
