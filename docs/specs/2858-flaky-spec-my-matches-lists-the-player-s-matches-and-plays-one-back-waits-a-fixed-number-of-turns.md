# Spec #2858: Flaky spec: My matches "lists the player's matches and plays one back" waits a fixed number of turns

Failed once on `main` (CI/CD run 42408725079, right after PR
[#2856](https://github.com/WolfSoko/wol-sok-mono/pull/2856)) and blocked that
release. Related: [#2828](https://github.com/WolfSoko/wol-sok-mono/issues/2828),
[#2857](https://github.com/WolfSoko/wol-sok-mono/issues/2857).

## Goal

`my-matches.component.spec.ts` waits for the replay viewer until it appears,
with an upper bound, instead of running a fixed number of macrotask turns.
Today `settle()` runs 10 `setTimeout(0)` turns plus `fixture.whenStable()`,
while `open()` awaits `replayBytes` (the fake compresses the replay with a
`CompressionStream`) and `replayFromBytes` (a `DecompressionStream`). Both are
zlib work on Node's thread pool, which finishes on no fixed turn: on an idle
machine the viewer shows after 3 to 4 turns (about 100 ms, measured), on a
loaded Nx Cloud worker it can take more than 10.

## Non-goals

- No change to `MyMatchesComponent` or `FakeGameReplays`: the component is
  right, only the spec's wait is not.
- No shared polling helper across the game lib: no other spec of the lib waits
  for a replay to load through the compression streams; a helper moves to
  `src/testing/` once a second spec needs it.
- No fake timers: the streams run on real I/O, which fake timers do not
  advance.

## Decisions

- **`settleUntil(fixture, ready, what)` in the spec file**: settles turn by
  turn (the same turn `settle` runs) until `ready()` holds, failing with
  `Timed out waiting for <what>` after `SETTLE_LIMIT_MS` (3 s, below Jest's
  5 s test timeout, so the failure names what was missing). `settle` itself
  stays for the steps that finish within a turn or two (taps, commands).
- **Only the waits on an asynchronous load use it**: the Watch click of
  "lists the player's matches and plays one back" waits for the viewer. The
  other Watch clicks ("plays no match of an older balance" and the two
  "shows a match of … as older" cases) refuse synchronously before any load
  (`row.playable` is false, `replayBytes` is never called, which the `it.each`
  asserts); they wait for the "older version" notice, the positive outcome,
  so a future asynchronous refusal cannot pass by timing either.
- **#2856 did not slow the path**: it changed only how `playable` is
  computed (`storedPlaybackRefusal`, synchronous) and how the fake lists a
  replay (`storedPlaybackOf`); `open()`, `replayBytes` and `replayFromBytes`
  are unchanged, and the spec uses the fake, not the local listing that now
  parses old guest entries.

## Acceptance

1. "lists the player's matches and plays one back" waits for
   `feat-lazy-bac-game-replay-viewer` by polling, bounded, and no longer by a
   fixed turn count.
2. The other Watch specs wait for the "older version" notice the same way.
3. A wait that never succeeds fails within the bound with a message naming
   what it waited for (checked by hand once with a condition that never
   holds).
4. The spec passes under load: 20 runs of the file in a row, with the CPU
   kept busy by parallel workers, all green.
5. `npx nx test feat-lazy-bacteria-game`, `typecheck-specs`, `lint` and
   `format:check` pass.

## Open questions

None.
