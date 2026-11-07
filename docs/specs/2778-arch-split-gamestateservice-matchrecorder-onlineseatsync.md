# Spec #2778: split `GameStateService`: `MatchRecorder`, `OnlineSeatSync`

Candidate 2 of [#2776](https://github.com/WolfSoko/wol-sok-mono/issues/2776)
(`docs/bacteria-game/architecture-deepening.md`, section 2). Paths are in
`libs/features/lazy/bacteria-game/src/lib/`.

## Goal

`state/game-state.service.ts` (1244 lines) keeps four jobs behind one wide
interface. Move two of them into deep modules of their own and give the
third a single entry point:

- **`MatchRecorder`** (`state/match-recorder.ts`): the recording pipeline
  (today `replay`, `recording`, `sample`, the fields `recordedAs`,
  `rankedMatch`, `onlineRef`, `samples`, `planEvolved`, the replay
  preferences and the `GameReplays.submit`).
- **`OnlineSeatSync`** (`net/online-seat-sync.ts`): the online seat
  (today `onOnline`, `endOnline`, `shareSetup`, `onlineMatch`,
  `guestColors`, the guest's colour offer in `updateSetup` and
  `leaveOnline`), so the colour handshake lives in one place.
- **`GameStateService.startMatch(arena)`**: the one call that starts a
  match, owning the order `cleanup()`, `init(w, h)`, `start()`.

## Non-goals

- No change to what a match plays, records, earns or uploads: replays,
  checksums, goldens (`golden-replay.json`, the GPU goldens,
  `SELF_TEST_GOLDEN`) stay byte-equal, no `BALANCE_VERSION` bump.
- No change to the match-kind rules (`recordsLocal`, `evolves`,
  `planModeOf`, the `recordMatch` switch, the training checks): that is
  [#2777](https://github.com/WolfSoko/wol-sok-mono/issues/2777). They stay
  in `GameStateService`, which hands the recorder only the decision.
- No change to the engine lib, the frame loop's pacing, or `MatchAnalytics`
  beyond its call sites.

## Decisions

1. **Recorder interface.** `begin(plan, start)` with
   `start = { as: 'local' | 'online' | null, ranked, onlineRef, evolved }`;
   `sample` (the `onSecond` callback, a bound arrow);
   `finish(outcome, tape)` returns the `MatchRecording | null`, sets
   `lastRecording` and submits; `replay(tape, outcome)` gives the
   unsubmitted replay for
   `lastReplay` (ghost to fight). `lastRecording` moves to the recorder;
   `GameStateService` no longer exposes it, the two replay components
   inject `MatchRecorder`. Reason: the recorder is the only writer, so it
   is the owner.
2. **`MatchTape`, a narrow port to the engine:**
   `{ ruleset, tickCount, recorded, players }`. `PlayerService` fills it
   as it is (it gained a `ruleset` getter), so `GameStateService` passes
   it straight on.
   Reason: the recorder specs run against a stub tape instead of 120
   frames through the service (the issue's test goal).
3. **Replay preferences live in the recorder** (`setPrefs`; the service's
   `recordsLocal` reads `recorder.prefs().recordLocal`), and
   `GameSettingsService` writes them through one private
   `syncReplayPrefs()` instead of three spread calls. The settings cannot
   be injected by the recorder: `GameSettingsService` injects
   `GameStateService`, which would close a cycle.
4. **`GameReplays` stays the port** behind the recorder, asked of the
   injector only at submit time, as today (`GameCloud` must answer after
   the route named the project).
5. **`OnlineSeatSync`** subscribes to `OnlineMatchService.events$` and
   emits typed seat changes on `changes$`:
   `{ kind: 'patch', patch: Partial<GameStateState> }` (the game applies
   it and spawns the idle board anew; empty when only the board is to be
   spawned, as for a guest's colours that leave the pair) or
   `{ kind: 'ended' }`. It sends to the peer itself (`share`,
   `offerColors`) and exposes `setupChanged(previous)` (host shares, guest
   offers its colours), `matchStart(seat)` (the seed, lockstep, ruleset,
   room ref and the seat to play on), `connected` and `leave()`.
   `GameStateService` applies the patches and on `ended` ends the match
   as a forfeit. Reason: the store and the match end stay the service's;
   the seat protocol becomes testable against a fake `OnlineMatchService`
   without spawning colonies.
6. **`startMatch(arena: { width, height })`** replaces the three calls in
   `flow/play-flow.ts`; `init` becomes private. No production code calls
   `start` any more, but about 40 specs drive a match with it and
   `advance` without a frame loop, so it stays public for them, documented
   as such. `cleanup()` stays for `BacteriaGameComponent.ngOnDestroy`.
7. **Replace, don't layer:** the recording describes of
   `game-state.service.spec.ts` (`the recording`, `local recordings`,
   ranked recordings) move to `match-recorder.spec.ts` against a stub
   tape; the online seat cases move to `online-seat-sync.spec.ts`. The
   service spec keeps one wiring test per seam (a vs-computer match ends
   with a recording; a peer's setup respawns the colonies).

## Acceptance

1. `MatchRecorder` and `OnlineSeatSync` exist with the interfaces above,
   each with its own spec; `GameStateService` holds none of the moved
   fields or methods.
2. `play-flow.ts` starts a match with one `startMatch` call.
3. The replay preferences are written to one place by one settings method.
4. Every existing behaviour the moved specs covered is still covered by a
   spec of the new module (no test dropped without a replacement).
5. `nx affected -t test,lint,lint-templates,build` green; the GPU
   cross-check and golden specs unchanged and green.
6. The game plays a local match against the computer and the replay screen
   shows its recording (production build, checked in a browser).
7. `CLAUDE.md` files that describe these parts name the new modules.

## Open questions

- **#2777 first?** The issue depends on it. This split leaves the
  match-kind rules where they are, so either order works; the second PR
  rebases over the first. Recommendation: build now, rebase on `main`
  before opening and before merging.
