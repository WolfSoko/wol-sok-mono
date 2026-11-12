# Plan 3065 — A faster IntSimulation, byte-equal

Spec: [docs/specs/3065-bacteria-wars-speed-up-intsimulation-so-gpu-int-replays-do-not-crawl-on-the-cpu.md](../specs/3065-bacteria-wars-speed-up-intsimulation-so-gpu-int-replays-do-not-crawl-on-the-cpu.md)

All paths below are in `libs/features/bacteria-engine/src/lib/state/gpu-int/`.
Each step: specs first (red where the behaviour is new, pinned against the old
code where it is a rewrite), then the change, then the engine's specs and the
bench's checksums.

1. **Pin the equivalences** before touching the passes: add the specs of
   acceptance 3 that compare against reference copies of today's code kept in
   the spec files (bit-by-bit `isqrt`, loop-scaled `unitQ14`, gather
   `intFeed`), plus edge and corner cases for `intCombat`.
   Files: `int-math.spec.ts`, `int-reference.spec.ts`, `int-combat.spec.ts`.
2. **`isqrt` and `unitQ14`** (`int-math.ts`). Commit:
   `perf(feat-shared-bacteria-engine): integer square root and unit scaling without loops`.
3. **In-place claim steps** (`int-reference.ts`: `IntPassScratch` with the
   occupied list, `beginIntClaimSteps`, `intClaimStep`, `intClaimAndApply`
   as wrapper; `int-tick.ts` runs them). Spec: in-place steps equal the
   wrapper step by step, in `int-reference.spec.ts`. Commit:
   `perf(feat-shared-bacteria-engine): claim and apply steps in place over the bacteria`.
4. **Feed by scatter, combat without the per-cell copy and fill**
   (`int-reference.ts`). Commit:
   `perf(feat-shared-bacteria-engine): feed from the kills, combat over inner offsets`.
5. **Checks**: `nx format:write`, `nx affected -t lint,test`, the bench
   (`node tools/perf/engine-bench.mjs --report-only`) and the heavy fixture
   on `gpu-int` by hand, numbers into the PR.
6. **Baseline**: once CI's `perf` output on the PR is there, lower
   `golden-gpu-int` in `tools/perf/engine-baseline.json`. Commit:
   `perf(feat-shared-bacteria-engine): lower the gpu-int bench baseline`.
7. **Docs**: the engine's replay-verification note in the root `CLAUDE.md`
   ("about 7 ms a tick on `intSimulation`") gets the new figure.
