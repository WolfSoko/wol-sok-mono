# Spec: Bacteria specs fail under parallel Jest load; Jest workers do not exit gracefully

Issue: [#3149](https://github.com/WolfSoko/wol-sok-mono/issues/3149)

## Goal

The bacteria specs named in the issue, and the one found along the way, pass
on a busy machine. Each one waits for what it actually waits for and no
assertion spends seconds of the test's time budget on its own.

## Analysis

Reproduced on the 20-core runner host, either with 20 busy loops running or
with `nx run-many -t test -p feat-shared-bacteria-engine feat-lazy-bacteria-game`:

- **`replay-pack.spec.ts`** (engine), "fits an hour of both sticks moving
  every tick into the caps": failed 1 of 3 runs under load. The test reads
  back an hour of inputs (432 000 steers) and compares it with
  `toEqual`, and Jest's deep equality alone takes about 7 s of it. Reading
  the bytes takes about 1.7 s. The default timeout is 5 s.
- **`local-game-replays.spec.ts`** (game lib): its `settle()` answers the
  fake storage over five fixed macrotask turns. `submit` and the reads
  compress and decompress through `CompressionStream`/`DecompressionStream`,
  which Node runs on its thread pool, so on a busy machine the work can
  still be going on after the fifth turn. The test then sees nothing stored.
- **`watch-page.component.spec.ts`** (game lib), found under `nx run-many`:
  its first test ran past 5 s in a 29 s suite. Its `settle()` runs five
  fixed turns of change detection whatever the page needs (its replay
  source is a fake, so no decompression runs there), and the first test
  also pays for compiling the viewer and for `recordedReplay()` (about 0.3 s
  alone).
- **"A worker process has failed to exit gracefully"** shows only under that
  parallel load, never in a run on its own. `--detectOpenHandles --runInBand`
  over the whole game lib reports no open handle, and every interval in the
  lib's sources is cleared on destroy. Jest's pool force-exits a worker that
  is still busy (coverage written, teardown) 500 ms after asking it to stop,
  and that is what the warning reports on an overloaded machine. No leak was
  found to fix.
- **The load itself.** `nx.json` runs 6 tasks at a time (`parallel: 6`), and
  each Jest task starts one worker per core minus one. On an Nx Cloud worker
  (`extra_large`, 8 vCPU) that is up to 42 Jest processes. This is the shared
  cause of all the above, and it affects every project's tests, not only the
  bacteria ones (see Open questions).

## Decisions

1. **Hour test: compare the header deeply and the inputs as JSON.**
   `toEqual` on the header keeps a readable diff; the inputs are compared as
   `JSON.stringify` strings, which takes milliseconds. The whole packed
   replay cannot be compared as JSON: `unpackReplay` rebuilds the header in
   its own key order. The test gets an explicit 30 s timeout
   (`HOUR_TIMEOUT_MS`), since packing and inflating an hour is seconds of
   real work.
2. **Local replays: answer the storage until the work is done.** `settle()`
   becomes `answered(work)`: it flushes the fake storage on every turn until
   the promise it was given has settled, then once more. No fixed count of
   turns.
3. **Watch page: wait for the page instead of five fixed turns.** `open()`
   settles until the page shows its result (the viewer, or the message for a
   missing replay) or a 3 s limit runs out with a message naming what it
   waited for. This is the same pattern `my-matches.component.spec.ts`
   already uses (`settleUntil`), so it moves into one shared test helper in
   `src/testing/` that both specs use.
4. **The worker warning gets no code change.** No handle leaks. The analysis
   above goes into the PR.

## Non-goals

- Changing Jest's worker count or `nx.json`'s `parallel` for the workspace:
  it changes every project's test timing and needs CI numbers. It is raised to
  the manager as a follow-up.
- Raising `testTimeout` for a whole project.

## Acceptance

1. `replay-pack.spec.ts`'s hour test checks the same things as before (both
   caps, header and inputs read back equal) and passes in under 5 s on an
   idle machine.
2. `local-game-replays.spec.ts` has no fixed-count settle loop.
3. `watch-page.component.spec.ts` and `my-matches.component.spec.ts` wait
   through one shared `settleUntil` helper; neither has a fixed-count settle
   loop for loading a replay.
4. Three runs of `nx run-many -t test -p feat-shared-bacteria-engine
   feat-lazy-bacteria-game --skip-nx-cache` pass on the runner host.
5. `nx affected -t test,lint,typecheck-specs` is green, and CI is green.

## Open questions

- Should the workspace cap Jest workers per task (`maxWorkers` in
  `jest.preset.cjs`) so that 6 parallel tasks do not oversubscribe the CPU?
  Recommended: a follow-up of its own with CI timings before and after.
