# Spec: Jest workers oversubscribe the CPU under Nx parallel 6 ([#3172](https://github.com/WolfSoko/wol-sok-mono/issues/3172))

## Goal

A Jest task started by Nx uses no more workers than its share of the
machine's cores, so the Jest tasks Nx runs side by side together fit on the
CPU. Specs then stop timing out because of load from their neighbours, in
CI and in a local `nx run-many`.

## Cause

`nx.json` runs `parallel: 6` tasks at once. `jest.preset.cjs` sets no
`maxWorkers`, so each Jest task starts one worker per core minus one. CI
(`nx affected … -c=ci` in `ci-cd.yml`) passes neither `--parallel` nor
`--maxWorkers`, so on an Nx Cloud `extra_large` worker (8 vCPU nominal;
`os.availableParallelism()` reports 10 there) six Jest
tasks start up to 6 × 9 = 54 workers. Specs close to Jest's 5 s timeout then
time out at random; so far they were fixed one by one (#3149, #3146,
#3124/#3125, #2858).

Reproduced locally with every Jest project pinned to 8 cores (`taskset -c
0-7`, `nx run-many -t test --parallel 6 --skip-nx-cache -c=ci`): the run took
411 s and `AdminShellComponent › signs out, then lets the guard run again`
exceeded 5000 ms.

## Decisions

1. **The share is computed, not hard-coded.** `jest.preset.cjs` sets
   `maxWorkers` to `ceil(cores / parallel)`, with `cores` from
   `os.availableParallelism()` (which, unlike `os.cpus()`, honours the CPU
   affinity a container or `taskset` sets, as Jest itself does) and
   `parallel` read from `nx.json`. Reason: one number per machine size would
   be wrong on the next one (the runner host has 20 cores, a laptop 8, an Nx
   Cloud worker 10), and a change to `parallel` keeps the two in step without
   a second edit. On an Nx Cloud worker that is 2 workers per task (12 for
   six tasks on 10 cores).
   A run that sets `NX_PARALLEL` (which every task inherits) is divided by
   that instead; an unusable value falls back to `nx.json`. A `--parallel`
   flag never reaches the task, so such a run keeps the `nx.json` share.
2. **Rounded up, not down.** Rounding down gives 1 worker on 8 cores, which
   Jest runs in band: no timeouts, but `feat-shared-bacteria-engine` alone
   then took 11 minutes and the whole run 678 s instead of 306 s (table
   below). Two workers per task keep the largest suites parallel at a load
   the timeouts tolerate.
3. **In the preset, not in `nx.json`.** An `nx.json` edit releases every app
   (`release-affected.mjs` keeps Nx's verdict for it); `jest.preset.cjs` is
   an input of the `test` targets only, so the change releases nothing. It
   also covers every Jest project at once: every project's config (53 of them) spreads the preset;
   the root `jest.config.ts` (`projects` mode, not used by Nx) keeps Jest's
   default.
4. **Explicit settings still win.** A project's own `maxWorkers`
   (`portfolio-cdk`, the rules test: 1) overrides the preset as before, and
   `--maxWorkers`/`--runInBand` on the command line override both, so a
   local `nx test <project> --maxWorkers=50%` stays possible.
   The cap holds in `--watch` too (Jest's own watch default is half the
   cores), in line with keeping it on outside CI.
5. **No change to `parallel`.** Six tasks at once keeps lint, typecheck and
   build tasks (single process each) busy beside the tests; the measurement
   below decides only the Jest share.
6. **Vitest is out of scope.** The three Vitest projects and the two Vite
   apps are small; their pools are left as they are.

## Measurement

Every Jest project, Nx cache off, `-c=ci` (coverage on, as in CI), pinned to
8 cores (`taskset -c 0-7`), `--parallel 6`, on the runner host. "Cold" starts
with an empty Jest transform cache, as a fresh Nx Cloud worker does; "warm"
reuses it.

| Workers per task             | Jest cache | Wall time | Timed-out tests           |
| ---------------------------- | ---------- | --------- | ------------------------- |
| Jest default (cores − 1 = 7) | cold       | 411 s     | 1 (`AdminShellComponent`) |
| 2 (this change: ceil(8 / 6)) | cold       | 297 s     | 0                         |
| Jest default (7)             | warm       | 260 s     | 0                         |
| 2                            | warm       | 306 s     | 0                         |
| 1 (rounded down)             | warm       | 678 s     | 0                         |

On the cold cache CI starts with, the change is 28% faster and the timeout
is gone; on a warm cache it is 18% slower, since a warm run is light enough
for the default to fit. In every run the critical path is
`feat-shared-bacteria-engine:test` (92 spec files). A second cold default run
was cut off by a session restart, so the cold comparison rests on one run per
side.

A single project alone (`nx run <project>:test`, warm cache, 8 cores), the
cost of applying the cap outside `run-many` too:

| Project                       | Jest default (7) | This change (2) |
| ----------------------------- | ---------------- | --------------- |
| `feat-shared-bacteria-engine` | 148 s            | 185 s           |
| `feat-lazy-bacteria-game`     | 28 s             | 41 s            |

The cap stays on for single runs and outside CI as well (owner's condition 1
of the approval): Nx gives a task no hint of how many run beside it, and a
local `nx run-many`/`nx affected` flaked the same way (#3172); a CI-only cap
would leave that. Under a minute on the largest project is the price, and
`--maxWorkers=7` takes it back for one run.

CI: an Nx Cloud worker of the PR's run logged `cores 10, parallel 6,
maxWorkers 2` (`tools:test`, cache miss). Summed time of the 50 Jest tasks,
all cache misses: 656 s on #3230's PR run (spread over 12 agents) and 817 s
on this PR's (5 agents, so more tasks shared each agent); the largest,
`feat-shared-bacteria-engine`, 218 s and 278 s. No test failed or timed out
in either. The agent counts differ, so the sums compare loads, not the cap
alone.

## Non-goals

- Raising single spec timeouts or rewriting slow specs.
- Changing `parallel`, the Nx Cloud worker size or the number of workers.
- Vitest pools (decision 6).

## Acceptance

1. `jest.preset.cjs` sets `maxWorkers` to `ceil(availableParallelism /
   nx.json parallel)`; a `tools/ci` test fails when it does not, or when
   `nx.json` has no positive integer `parallel`.
2. A project's own `maxWorkers` and a command-line `--maxWorkers` still take
   precedence (checked by running one project with `--maxWorkers=2` and
   reading Jest's worker count).
3. Every Jest project passes under `nx run-many -t test --parallel 6 -c=ci`
   pinned to 8 cores, with no `Exceeded timeout`.
4. With a cold Jest cache (as on a fresh CI worker) that run is not slower
   than with Jest's default workers (table above).
5. CI is green on the PR, its Jest tasks included.
6. `CLAUDE.md` (Testing) says how many workers a Jest task takes and why.

## Open questions

None.
