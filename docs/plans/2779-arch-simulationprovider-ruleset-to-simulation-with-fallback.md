# Plan: `SimulationProvider`, ruleset to simulation, with fallback

Spec: `docs/specs/2779-arch-simulationprovider-ruleset-to-simulation-with-fallback.md`.
Branch `claude/epic-allen-az7uzm` off `main`, one PR.

1. **Engine provider, test first.**
   Files: `libs/features/bacteria-engine/src/lib/state/simulation-provider.ts`,
   `simulation-provider.spec.ts`, `src/index.ts` (exports
   `SimulationProvider`, `SimulationSources`, `SimulationRequest`,
   `DevicePlay`, `GpuSimulations`, `createSimulationProvider`,
   `CPU_SIMULATIONS`).
   Tests: the provider spec (acceptance 1).
   Commit: `feat(feat-shared-bacteria-engine): add SimulationProvider`.

2. **`replayEngine` takes a provider.**
   Files: engine `state/replay.ts`, `replay.spec.ts` where it passes a
   factory.
   Tests: `replay.spec.ts`, `golden-replay.spec.ts` unchanged and green.
   Commit: folded into task 4 (one refactor commit with its callers).

3. **Device choice returns sources.**
   Files: game `gl/simulation-choice.ts` and its spec: `chooseSimulation`
   returns `SimulationSources` (`gpu`, `plays`, `offers`); the fallback
   cases leave the spec.
   Tests: `simulation-choice.spec.ts`.

4. **`PlayerService` and the replay scene on the provider.**
   Files: `state/player.service.ts` (`useSimulations`, request from the
   options, `onFallback`), its spec (fallback cases removed, request cases
   kept), `stage/arena-stage.ts`, `bacteria-game.component.ts`,
   `replays/replay-scene.ts` (no own fallback), specs calling
   `useSimulation` (`game-state.service.spec.ts`, `stage-frame.spec.ts`,
   `ranked.service.spec.ts`).
   Tests: `nx test feat-lazy-bacteria-game` and
   `nx test feat-shared-bacteria-engine`.
   Commit (tasks 2-4):
   `refactor(feat-lazy-bacteria-game): choose simulations through the SimulationProvider`.

5. **Docs.** `CLAUDE.md` (where the simulations are described),
   `docs/bacteria-game/architecture-deepening.md` untouched.
   Commit: `docs(feat-lazy-bacteria-game): ...` with spec and plan.

6. **Checks.** `npx nx format:write`,
   `npx nx affected -t lint,lint-templates,test,build`, the pinned oxfmt check, goldens
   unchanged (`git diff --stat` shows no `golden*.json`).
