# Bacteria Wars: architecture deepening candidates

Analysis for #2776 (2026-11-06, base `3fa98da`). It uses the vocabulary of
the `codebase-design` skill: a **module** is **deep** when a lot of
behaviour sits behind a small **interface**, and **shallow** when the
interface is nearly as complex as the implementation. A **seam** is where
an interface lives, and an **adapter** fills a seam.

The analysis covers the game lib (`libs/features/lazy/bacteria-game`,
about 46k lines without specs), the engine (`libs/features/bacteria-engine`,
about 24k), the admin lib (`libs/features/lazy/bacteria-wars-admin`, about
5k) and the Cloud Functions (`apps/bacteria-wars-functions`, about 15k).
Earlier architecture work (#2482, #2682) split the libs and the big
components. This document looks one level down: concepts whose knowledge
is spread over many callers.

Each candidate below became a GitHub issue labelled `architecture`, linked
in the table. Line numbers refer to the base commit and will drift.

## Ranking

| #   | Issue | Candidate                                                     | Area                           | Size | Depends on |
| --- | ----- | ------------------------------------------------------------- | ------------------------------ | ---- | ---------- |
| 1   | #2777 | Match rules: one `NextMatch` union and `matchRules()`         | game                           | M    | none       |
| 2   | #2778 | Split `GameStateService`: `MatchRecorder`, `OnlineSeatSync`   | game                           | L    | 1          |
| 3   | #2779 | `SimulationProvider`: ruleset to simulation, with fallback    | engine, game                   | M    | none       |
| 4   | #2780 | `MatchRun`: one runner that plays a match to its end          | engine, game                   | M    | 3 helps    |
| 5   | #2781 | `replayVerdict()`: the engine judges a replay                 | engine, functions              | S    | 4 helps    |
| 6   | #2782 | Cloud records: ban, notice and kind shapes shared once        | engine, game, admin, functions | L    | none       |
| 7   | #2783 | Command documents: one envelope, result and runner            | engine, game, admin, functions | M    | 6 helps    |
| 8   | #2784 | Player data map for account erasure                           | functions                      | M    | none       |
| 9   | #2785 | Settings schema table in `GameSettingsService`                | game                           | M    | none       |
| 10  | #2786 | `playerDocument<T>()` for data that follows the player        | game                           | S-M  | none       |
| 11  | #2787 | `PeerTransport` port and shared online fakes                  | game                           | M    | none       |
| 12  | #2788 | One fake Firebase SDK for the game's storage adapter specs    | game                           | M    | none       |
| 13  | #2789 | Functions emulator harness and one Realtime fake              | functions                      | S    | none       |
| 14  | #2790 | `GridSimulation`: composition over inheritance (`CellPasses`) | engine, game                   | L    | 3          |
| 15  | #2791 | `BotSenses`: the bots' view out of `MatchEngine`              | engine                         | M    | none       |

Smaller findings that need no issue of their own are at the end.

## 1. Match rules

**Today.** The kind of the next match is spread over seven loosely tied
store fields in `state/game.states.ts:98-131`: `ghost`, `matchLevel`,
`dailyDay`, `endlessMatch`, `ranked`, `endlessRanked` and `online`. Every
caller works out the kind and its rules again:

- `matchKind()` in `analytics/match-analytics.ts:133`.
- `playKindOf()` in `flow/play-kind.ts`, fed by `flow/play-flow.ts:137-148`.
- In `state/game-state.service.ts`: `evolves()` (:738), `recordsLocal()`
  (:570), the training check in `endMatch` (:435), the switch in
  `recordMatch` (:593-632), the series rule in `start` (:1067) and
  `planModeOf` (:1235).
- The pause and restart rules in `hud/hud-state.ts:206-213` and the grid
  choice in `stage/arena-stage.ts:139-141`.
- "Is this a training mission" is tested through `getLevel(x).mission` in
  five places (`play-flow.ts:141`, `game-state.service.ts:436`, :575 and
  :746, `match-analytics.ts:136`), and through `level().mission` in two
  more (`winner.component.ts:200`, `hud/hud-state.ts:159`).

Six methods set the one-match fields, and `flow/match-end.ts:72-98` saves
and restores `oneMatch()` around the reset.

**Deeper module.** A pure tagged union
`NextMatch = setup | ghost | mission | daily | endless | online` and one
function `matchRules(next, setup)` that returns the kind, plan mode,
whether the match records, evolves, earns or counts in a series, whether it
can pause or restart, its grid and its locks. It starts in the game lib
(`state/`), since the pause, restart, grid and lock rules and the
`OnlineSeat` and `RankedOutcome` payloads are the game's. Only the parts
the engine's `planMatch` needs, such as the plan mode, move into the engine
beside it.

**Dependency.** In-process.

**Tests.** One table spec of `matchRules` replaces scattered cases in the
service, HUD and analytics specs.

## 2. Split `GameStateService`

**Today.** `state/game-state.service.ts` (1244 lines, about 33 public
members) has four jobs:

- The frame loop. Callers must call `cleanup()`, `init(w, h)` and `start()`
  in that order (`flow/play-flow.ts:416-419`, `bacteria-game.component.ts:227-229`).
- The recording pipeline (:467-578), including the `GameReplays.submit`,
  plus a copy of the replay preferences pushed from three places.
- The online seat sync (:286-374, :1085-1120), with the colour handshake
  split between this service and `OnlineMatchService`.
- The setup and one-match commands.

**Deeper modules.**

- `MatchRecorder` with `begin(plan, mode)`, `sample()` and
  `finish(outcome, engine)`. It owns the submit.
- `OnlineSeatSync`, which turns online events into setup patches.
- `GameStateService.startMatch(arena)`, which owns the lifecycle order.

**Dependency.** In-process. `GameReplays` stays the port behind the recorder.

**Tests.** The recording describes of `game-state.service.spec.ts`
(:917-1426) play 120 frames through the whole service today. They can test
the recorder against a stub engine instead.

## 3. `SimulationProvider`

**Today.** No module answers "which simulation plays this ruleset, and what
stands in when the GPU fails". The answer is rebuilt in four places:

- `replayEngine` in the engine's `state/replay.ts:396-422`.
- `PlayerService.init` (`state/player.service.ts:137-166`).
- `PlayerService.createSimulation` (:370-399), which carries out the
  try/dispose/fallback and sets four fields.
- `replays/replay-scene.ts:40-65`, which repeats that fallback and says so
  in its comment.

`useSimulation` takes five parameters that must agree. The `Simulation`
interface carries both `kind` and a nullable `ruleset`, so callers branch
on both (`player.service.ts:351`, `stage-frame.ts:242`,
`game-state.service.ts:505-514`).

**Deeper module.** An engine `SimulationProvider` with
`simulationFor(ruleset | 'device')`, `offers()` and `ruleset()`. It owns
the fallback: dispose, warn, step down. The engine ships the default
(`cpu` plays on `BacteriaSimulation`, `gpu-int` on `IntSimulation`), and
the game adds the GPU adapter.

**Dependency.** Local-substitutable. WebGL sits behind the factory, and
`IntSimulation` is its in-memory twin.

**Tests.** The fallback cases of `simulation-choice.spec.ts` and
`player.service.spec.ts` move into one provider spec. The goldens stay
untouched.

## 4. `MatchRun`

**Today.** Five places write the same loop,
`while (outcome() == null && tickCount < N) engine.tick(width, height)`:

- `playReplay` (`state/replay.ts:429-452`)
- the balance lab (`state/balance/lab-match.ts:126-163`)
- the replay viewer (`replays/replay-scene.ts:231-251`)
- `GameStateService.advance` (:232-262)
- the game lib's `perf/cpu-simulation.bench.ts:82-99`

Each one has to know that `tick` takes the arena size on every call, that
`dispose()` belongs in a `finally`, how the checksum is formed and how
`onSecond` sampling is wired.

**Deeper module.** `MatchRun`, built from a plan or a replay and a
provider, with `advance(maxTicks, deadline?)`, `seek(tick)`, `result()` and
`dispose()`. The arena size goes into the constructor. `playReplay(replay)`
keeps its signature: the functions and `tools/perf/engine-bench.mjs`
import it.

**Dependency.** In-process.

**Tests.** The loop's edge cases (an outcome on the last tick, the tick
budget) get one spec. The goldens stay byte-equal as long as the tick
order, including the per-tick `resize`, is kept.

## 5. `replayVerdict()`

**Today.** `playReplay` returns `null` without a reason. So
`apps/bacteria-wars-functions/src/boards/verify.ts:59-104` checks
`balanceVersion` again before calling it, repeating a clause of
`canPlayBack` (`state/replay.ts:374-384`). It then compares the ticks,
checksum, `endedBy` and `winnerSeat` against the header field by field,
which is engine knowledge. Five function modules call `verifyReplay`.

**Deeper module.** An engine function `replayVerdict(replay)` that returns
`verified`, `unverified`, `balance-mismatch` or `unplayable`, with the
result. The functions keep only the timing, the timeline thinning and
`medalOf`.

**Dependency.** In-process.

**Tests.** `verify.spec.ts` keeps mocking one seam. The engine gains
verdict specs on the recorded replay fixture plus a tampered header.

## 6. Cloud records

**Today.** The engine's `state/admin-commands.ts` already shows the right
shape: one parser that the admin view and the functions share. Most other
document shapes are written once per side:

- **The ban.** `bans/{uid}` is parsed in four places, and its Realtime
  Database mirror (a number) in two more:
  - `functions/admin/bans.ts:73`
  - inline in `functions/limits.ts:53-71`
  - the game's `storage/game-moderation.ts:77`
  - the admin's `moderation/admin-records.ts:131`
  - the mirror: `holdsInRealtime` in `functions/admin/bans.ts:59` and
    `parseMirroredBan` in `game-moderation.ts:96`
- **The ban rule.** "Does the ban hold" is written four times. The code
  agrees everywhere, but the comments disagree on whether the end is
  inclusive (`bans.ts:87`, `limits.ts:32`) or exclusive
  (`game-moderation.ts:104`).
- **Other shapes.** `NoticeType`, `ReplayKind`, `AdminStats` and the
  hidden-by reasons each exist twice, client and server.

**Deeper module.** A Node-only `state/cloud-records/` in the engine with
plain-millisecond types and parsers: `parseBan(data, toMillis)`,
`banHolds`, the mirrored ban, and the lists of notice types, replay kinds,
replay states, stats fields and hide reasons. A `toMillis` argument keeps
Firebase out of the engine.

**Dependency.** In-process.

**Tests.** One engine spec of the ban edge cases (`until === now`)
replaces four. Each side checks only its own Timestamp mapping.

## 7. Command documents

**Today.**

- **Types.** The replay command types exist three times:
  `functions/replays/command.ts:21,47`, the game's
  `storage/replay-records.ts:82`, and the admin's
  `commands/command-types.ts:7`.
- **The envelope.** `{uid, createdAt, expireAt}` and its 24-hour TTL are
  written twice, in the admin's `admin-commands.service.ts:32` and the
  game's `firestore-game-replays.ts:35`. The Firestore rules cap
  `expireAt` at two days after the write (`firestore.rules:436`), and the
  two comments describe that rule differently (`admin-commands.service.ts:31`
  says "up to 2 days", `firestore-game-replays.ts:32` "a day after").
- **The result.** `adminCommand` writes `result.error` and `replayCommand`
  writes `result.reason`. The admin client works around that
  (`admin-commands.service.ts:136`).
- **The runners.** `runAdminCommand` (`admin/command.ts:82-106`) and
  `runReplayCommand` (`replays/command.ts:73-100`) are near copies with
  different writer checks.

**Deeper module.**

- In the engine: `commandEnvelope(uid, now)`, `COMMAND_TTL_MS`, the command
  type lists, `parseReplayCommand`, and one `CommandResult` with its parser.
- In the functions: one `runCommandDocument(db, path, authId, run)` that
  owns the writer check, the catch and the write-back.

**Dependency.** In-process for the parsers. The runner is local-substitutable
(emulator).

**Tests.** One engine spec for envelope and result. The two runners'
emulator cases (not-writer, internal, duplicate) become one suite.

## 8. Player data map

**Today.** Erasure is composed twice:

- `admin/erase.ts` calls the three parts.
- The three `onDelete` triggers in `main.ts` call them separately.

What gets erased is spread over four files:

- `boards/delete-player.ts`
- `social/delete-player.ts`
- `replays/forget.ts:183-201`
- `admin/accounts.ts:97`

Nobody owns the list. `players/{uid}/attempts` and `notices` are deleted
twice, in `boards/delete-player.ts:40-41` and again inside
`recursiveDelete(players/{uid})` in `social/delete-player.ts:81`. No spec
checks that every uid-keyed path in `firestore.rules` is erased. The rule
"a new collection keyed by uid gets its erasing" lives only in `CLAUDE.md`.

**Deeper module.** A declarative `PLAYER_DATA` table (path, how the uid
appears, delete, anonymise or custom), plus `erasePart(part, db, rt, uid)`.
The triggers and `erasePlayer` go through it.

**Dependency.** In-process for the map, local-substitutable (emulator) for
the erasure.

**Tests.**

- A pure spec reads `firestore.rules` and fails on a uid-keyed path missing
  from the map, as `firestore-indexes.spec.ts` does for indexes.
- The four emulator erase suites become one table-driven test.

## 9. Settings schema table

**Today.** Each of the 22 device settings in `settings.service.ts` (665
lines; `StoredSettings` holds 6 match-setup fields besides) is
written out five times: its stored field (54-110), a signal (162-231), a
setter (274-402; 21 setters with 51 call sites in 7 files), a restore
branch (443-526) and a line in `toStore()` (580-606). The service also
persists the match setup, which is a second job.

**Deeper module.** A `SETTINGS` table of `{ default, parse }` per key, and
a generic `DeviceSettings` with `value(key)`, `set(key, v)`,
`preview(key, v)` and `loaded`. It handles restore-unless-touched,
persistence and analytics once. Match-setup persistence becomes a small
`StoredMatchSetup` of its own.

**Dependency.** Local-substitutable (`DeviceStorage`, faked by `LateGameStorage`).

**Tests.** One generic restore/touch/persist spec over the table replaces a
test per setting.

## 10. `playerDocument<T>()`

**Today.** `progress.service.ts` (:111-173) and `evolution.service.ts`
(:100-112, :309-332) run the same pipeline:

1. Follow the account's players.
2. Switch the document (adopting the guest's data).
3. Move the device copy over once.
4. Track a loaded flag.
5. Merge and write.

The game lib's `CLAUDE.md` (:273-274) asks every new player-data service
to "listen to `players` and start over", which today means writing this
pipeline once more.

**Deeper module.** `playerDocument<T>({ key, parse, merge, adopt, empty })`,
which returns `{ value, loaded, apply(change) }`.

**Dependency.** Local-substitutable (`GameStorage`, `GameAccount`; their
fakes exist).

**Tests.** The switch, adopt and device-move cases are tested once. The
two service specs keep only their domain merges.

## 11. `PeerTransport` and shared online fakes

**Today.** `PeerLink.offer()` and `PeerLink.answer()` are static calls, so
`online-match.service.spec.ts:31` replaces the module with `jest.mock`.
The `OnlineMatchService` surface is faked three times, each copy a little
different:

- `game-state.service.spec.ts:766`
- `online-colors.spec.ts:75`
- `matchmaker.service.spec.ts:22`

Fourteen specs build a partial `GameCloud` by hand.

**Deeper module.**

- An injectable `PeerTransport` port with `offer()` and `answer(offer)`.
  WebRTC is the production adapter, and a `pairedTransport()` in
  `src/testing` is the in-memory one, so two real services can play the
  protocol against each other.
- A shared `FakeOnlineMatch`.
- A `provideFakeGameCloud({ … })` that defaults every backend to null.

**Dependency.** True-external (WebRTC) behind a port with two adapters.

**Tests.** The hello, setup, colours and lockstep protocol becomes one
in-process spec. The three copies go away.

## 12. One fake Firebase SDK for the storage adapter specs

**Today.** The game's storage ports and their fakes in `src/testing` are
good. One level down, each `firestore-game-*.spec.ts` builds its own fake
of the SDK surface that `FirebaseConnection.dbSdk` exposes:

- six private `FakeFirestore` or `FakeBackend` classes:
  - replays (:66)
  - ranked (:24)
  - rooms (:21)
  - social (:16)
  - storage (:11)
  - moderation (:12)
- `FakeTimestamp`, copied three times.

**Deeper module.** One `testing/fake-firebase-sdk.ts` with
`fakeConnection({ docs, refused, serverTime })`. It covers documents by
path, ids, queries, `onSnapshot` with permission-denied, and transactions
with hang and fail switches.

**Dependency.** Local-substitutable. The rules emulator suite stays the
real check.

**Tests.** Each adapter spec keeps only its scenario setup.

## 13. Functions emulator harness

**Today.** All eight `*.emulator.ts` files repeat the project id,
`initializeApp`, `getFirestore` and a `beforeEach` that clears the emulator
(for example `admin/admin.emulator.ts:25-44`). `admin.emulator.ts:52-121`
also keeps a private Realtime fake beside the shared
`testing/fake-realtime.ts`.

**Deeper module.**

- `testing/emulator.ts` with `useEmulatorDb()`.
- The shared Realtime fake, extended with a call log and failure hooks.

**Dependency.** Local-substitutable (emulator).

**Tests.** One fake with one behaviour. The admin suite gets real tree
semantics.

## 14. `GridSimulation`: composition over inheritance

**Today.** `state/grid-simulation.ts` (639 lines) is an abstract base with
eight `protected abstract` hooks and about 30 protected mutable fields.
Ordering rules live only in comments:

- `IntSimulation` writes the base's `escapePending`, `maskDirty` and
  `reportStep`.
- The base's `step` takes reports before pellets only when the match is
  deterministic (:215-220).

`GpuSimulation` (`gl/gpu-simulation.ts`, 1257 lines) holds two simulations
in one class, switched by a `deterministic` flag across programs, uniforms
and readback. The cell-independent parts are also copied word for word
between `BacteriaSimulation` and `GridSimulation`:

- `setMap`
- `getNutrients`
- `getActiveEffects`
- `addEffect`
- `getDynamicWalls`
- `getEvents`
- the wall advance

**Deeper module.** A concrete `GridWar` (walls, pellets, effects,
uniforms, report bookkeeping) over a narrow `CellPasses` port. Three
adapters fill it: the integer reference, GPU int and GPU float. The
copied parts become a shared `ArenaFixtures`.

**Dependency.** Local-substitutable. The TypeScript reference is the
in-memory adapter that already cross-checks the GPU.

**Tests.** These must stay byte-equal, and the GPU cross-check proves it:

- `golden-gpu-int.json`
- `golden-gpu-sim.json`
- `SELF_TEST_GOLDEN`

The bookkeeping gets specs with a stub `CellPasses`. A real-device check
is needed (CI has no GPU).

## 15. `BotSenses`

**Today.** `state/match-engine.ts` (1105 lines) builds the bots' world
next to input recording, ghosts, weapons and scoring. That world is the nav
grid, the floods, the hill and the weapon view (:789-981, about 190 lines,
plus caches at :279-299). `buildBotView` (`bot-controller.ts:524-540`)
takes 15 positional parameters.

**Deeper module.** `BotSenses`, built from the map, the win rule, the
balance and the simulation. Its interface is `viewFor(player, colonies, width)`,
and it owns the caches. `runBots` shrinks to about 15 lines.

**Dependency.** In-process.

**Tests.** The view gets tested against a fake `Simulation`. The match
fingerprints and replay goldens stay unchanged: the same calls run in the
same order.

## Smaller findings, no issue of their own

- **Ranking rule in `main.ts`.** `rankReplay` (`main.ts`, about :395-440)
  decides inline which board a replay ranks on. It can become a pure
  `rankKindOf(before, after)` in `boards/`. This fits with #8 or any
  change to ranking.
- **Result headline.** `WinnerComponent.headline` (`winner-info/winner.component.ts:576-660`)
  is a pure decision inside a component, and it becomes a consumer of #1.
- **Share or copy.** The "share sheet, else copy" logic is copied between
  `winner.component.ts:382-422` and `social/friends.component.ts:93-124`.
- **Replay module.** `replay.ts` mixes the format (:455-903) with playback.
  The split follows from #4 and #5.

## Checked and left as they are

- The `Realtime` port in the functions.
- `sweepGuests`.
- The plan/apply split in `accept-plan.ts` and `forget-plan.ts`.
- `runAudited`.
- The admin command parser.
- The game's `GameX` storage ports.
- `net/lockstep.ts`.
- `levels.ts` and `maps.ts`, which are data tables.

## Rules for every candidate

- Engine refactors keep the tick order. The goldens (`golden-replay.json`,
  the GPU goldens, `SELF_TEST_GOLDEN`) stay byte-equal, and no candidate
  bumps `BALANCE_VERSION`.
- Engine code stays Node-only: no Angular, RxJS, Firebase or DOM.
- Replace, don't layer. Tests move to the new interface, and the old tests
  on shallow modules are deleted.
