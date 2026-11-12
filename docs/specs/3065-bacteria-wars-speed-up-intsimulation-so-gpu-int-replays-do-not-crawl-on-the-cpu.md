# 3065 — Bacteria Wars: speed up IntSimulation so gpu-int replays do not crawl on the CPU

Issue: [#3065](https://github.com/WolfSoko/wol-sok-mono/issues/3065)

## Cause

A `gpu-int` replay (every daily ranked attempt, the whole gallery) plays on
`IntSimulation`, the TypeScript twin of the integer shaders, wherever the
device has no trusted GPU, and the Cloud Functions' verification
(`boards/verify.ts`) always plays it there. The engine bench measures the
golden replay at 2596 ms on `gpu-int` against 306 ms on `cpu` (8.5x), the
large map (`expanse-heavy`, 640x360) at 14.9 s on `gpu-int` against 1.36 s
on `cpu`.

A CPU profile of the golden replay on `gpu-int` shows where it goes:

|    Share | Where                                                                                                                                                                                                                                                                                    |
| -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     ~60% | `intClaimAndApply`, run 6-7 times a tick (divide plus about 5.3 move steps): every step scans the whole grid three times (the `free` map, the intents, the apply after a full `out.set(state)` copy), although only 5-9% of the cells hold a bacterium and only the claimed cells change |
|      14% | `intCombat` (per bacterium, 8 neighbours, `strength.fill`)                                                                                                                                                                                                                               |
|     6.5% | `unitQ14` with the bit-by-bit `isqrt` and its halving/doubling loops                                                                                                                                                                                                                     |
|     5.7% | `intFeed`, a gather of 8 neighbours' records for every cell                                                                                                                                                                                                                              |
| the rest | crush, report, hunt, influence                                                                                                                                                                                                                                                           |

## Goal

`IntSimulation` plays a match at least twice as fast on the CPU, with a
result that stays byte-equal: every state, hash, report and replay outcome
as before, so no golden, balance or self-test version changes.

## Non-goals

- The shaders (`gl/int-*.ts`) and the GPU path: they stay as they are.
- The `cpu` ruleset (`BacteriaSimulation`).
- Measuring phones or the deployed functions (no such device or access in
  CI); the bench's ratios are the measure.
- Changing the verification budget, how `verify.ts` slices its work, or
  which device plays which ruleset.
- Fusing crush, combat and feed into one pass: it would win more, but the
  reference would no longer read as the shaders' passes one by one, which is
  what makes it checkable against them.

## Decisions

1. **The claim and apply steps of a tick run in place on one state.** A
   tick reads once, after feeding (and once before escaping, where a wall
   moved), which cells are free and which hold a bacterium
   (`beginIntClaimSteps`), and each step (`intClaimStep`) visits only the
   bacteria in that list, collects the cells it claimed, applies only those
   and keeps the free map and the list up to date (a mover leaves its cell
   free, a child joins the list). In place is safe: a claimed cell was free,
   so it is nobody's source, and a bacterium has one intent, so it moves or
   divides at most once. The visiting order does not matter, since a claim
   goes to the highest draw and on a tie to the lowest neighbour index,
   neither of which depends on the order. The escape steps run on a copy, so
   the grid's state stays as it was.
2. **`intClaimAndApply` keeps its signature and contract** (a new state,
   the grid left alone) as a thin wrapper over the two: the specs and the
   GPU cross-check's single-pass scenarios use it.
3. **`isqrt` takes `Math.floor(Math.sqrt(n))`**: a double's square root is
   correctly rounded, so for every uint (below 2^52) its floor is exact, as
   the shader's bit-by-bit loop. `unitQ14` scales in one shift from
   `Math.clz32` instead of its loops: halvings floor, and floors of halvings
   compose, so the result is the same.
4. **`intFeed` scatters from the kills instead of gathering for every
   cell:** each cell first gets the food of its own record, then each kill,
   which are few, feeds the bacteria of its killer around it. Capping each
   addition at 0xffff caps the sum the same way, since every addition is
   positive.
5. **`intCombat` copies the state once** (an empty cell keeps its texel),
   reads an inner cell's neighbours by offset without bounds checks and
   zeroes the four attackers' strengths in a loop instead of `fill` (locals
   measured no faster).
6. **The bench's baseline goes down in its own commit**
   (`perf(feat-shared-bacteria-engine): ...`), with the ratio from the CI run's
   `perf` output on this PR, as the performance-gate rules ask; the
   checksums stay.
7. **The bench gets no `gpu-int` run of the heavy fixture**: it would add
   about a minute to a target that runs alone on its worker; the speed-up
   there is measured by hand and noted in the PR.

## Acceptance

1. Byte-equal: the golden specs stay green unchanged (`golden-replay.spec.ts`
   on both rulesets, `golden.spec.ts`, `sim-golden.spec.ts`,
   `self-test-golden.spec.ts`), the bench reports the same checksums, ticks
   and outcomes, and `BALANCE_VERSION`, `GPU_SELF_TEST_VERSION` and the
   golden files are untouched. The GPU cross-check (`e2e-ci` of the game lib)
   stays green.
2. Speed: the bench's `golden-gpu-int` takes at most half its time before
   (ratio at most about 30 against the baseline's 61); the heavy fixture on
   `gpu-int` at most half its time before, measured by hand.
3. New specs pin each equivalence: `intClaimStep` run in place step after
   step equals `intClaimAndApply` from step to step (move, escape, divide,
   with effects); `isqrt` against the bit-by-bit loop around every square
   and at the bounds; `unitQ14` against the loop scaling over short and long
   vectors; `intFeed` against the gather, edges and the 0xffff cap included;
   `intCombat` at the grid's edges and corners.
4. `nx affected -t lint,test` green; the engine bundle spec still passes.

## Still open after this

- Crush, the report, influence and hunt are full-grid passes too (about 15%
  together after this change); fusing them is the next step if needed.
- Phone and server timings are still unmeasured.
