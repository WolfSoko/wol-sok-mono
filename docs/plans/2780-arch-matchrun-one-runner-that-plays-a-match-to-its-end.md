# Plan: `MatchRun`, one runner that plays a match to its end

Spec: `docs/specs/2780-arch-matchrun-one-runner-that-plays-a-match-to-its-end.md`.
Branch off `main`, rebased on `main` before the PR opens and before it merges.

## 1. `MatchRun` in the engine, test first

- Files: `libs/features/bacteria-engine/src/lib/state/match-run.ts`,
  `match-run.spec.ts`, `src/index.ts` (export).
- Tests: the loop's edge cases on a fake engine (outcome on the last tick,
  tick budget, `maxTicks`, deadline, seek on and back, clamping, dispose)
  and on a real match: seek on and back reaching the same war (moved from
  `replay-viewer.component.spec.ts`).
- Commit: `feat(feat-shared-bacteria-engine): add MatchRun, the loop that plays a match on`.

## 2. `playReplay` and the balance lab on `MatchRun`

- Files: `state/replay.ts` (`replayRun`, `playReplay` on it),
  `state/balance/lab-match.ts`, `state/replay.spec.ts` (the
  `replayEngine` tick-by-tick spec rewritten for `replayRun`).
- Tests: `replay.spec.ts`, `lab-match.spec.ts`, `golden-replay.spec.ts`,
  `golden-match.spec.ts` unchanged and green.
- Commit: `refactor(feat-shared-bacteria-engine): play replays and lab matches through MatchRun`.

## 3. Replay viewer and CPU bench on `MatchRun`

- Files: `libs/features/lazy/bacteria-game/src/lib/replays/replay-scene.ts`,
  `replay-viewer.component.spec.ts` (moved seek specs deleted),
  `libs/features/lazy/bacteria-game/perf/cpu-simulation.bench.ts`.
- Tests: `replay-viewer.component.spec.ts` (GPU fallback, restart, useGpu)
  green; the bench runs (`npx tsx` as its header says) and prints a line.
- Commit: `refactor(feat-lazy-bacteria-game): run the replay viewer and the CPU bench on MatchRun`.

## 4. Docs

- Files: `CLAUDE.md` (replay line), the deepening doc's candidate 4 noted
  as done.
- Commit: `docs(feat-shared-bacteria-engine): describe MatchRun`.

## 5. Checks

- `npx nx format:write`, `npx nx affected -t lint,lint-templates,test`,
  `npx nx run feat-lazy-bacteria-game:e2e-ci` GPU cross-check not needed
  (no shader change), `npx nx run bacteria-game-remote:build -c production`
  (budgets), `npx nx run feat-shared-bacteria-engine:perf --report-only`.
