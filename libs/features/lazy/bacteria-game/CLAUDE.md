# Bacteria game

Rules for working on `libs/features/lazy/bacteria-game`, on top of the repo's
`CLAUDE.md`.

## Persistence: local storage or Firebase, behind ports

The game keeps the player's progress (medallions, campaign, XP, achievements,
totals) in its own Firebase project once one is configured, and in local
storage until then. Settings stay with the device either way.

- Everything the game stores goes through a port in `src/lib/storage/`.
  Nothing else touches `localStorage`, `sessionStorage`, IndexedDB or Firebase
  directly.
  - `GameStorage` is the player's storage and follows their account:
    `FirestoreGameStorage` with a project, `LocalGameStorage` without.
  - `DeviceStorage` is this device's storage, always `LocalGameStorage`. The
    settings (`GameSettingsService`) live there, so sound, controls and
    graphics stay per device whoever signs in.
  - `GameAccount` says who plays (`FirebaseGameAccount`, or `DeviceAccount`
    without a project) and signs in and out.
- The project is named with `provideGameCloud(environment.gameCloud)` in the
  providers of the remote's entry route, not in its app config: inside the
  shell only the entry routes are loaded. The game's services sit in the root
  injector and would not see a provider on that route, so `GameStorage` and
  `GameAccount` ask the root `GameCloud`, which the route's initializer sets
  before the game starts. `gameCloud: null` keeps everything local.
- Firebase comes through AngularFire (`@angular/fire`): `provideGameCloud`
  provides the game's own named app (`bacteria-wars`), Auth and Firestore on
  that route, where they stand in for the shell's, which belong to another
  project. The backends call the Firebase SDK itself on the injected
  instances, not AngularFire's wrapped functions: the app is zoneless, where
  the wrapping only adds pending tasks (a write held offline keeps the app
  from turning stable), and it wraps every function argument as a callback,
  which breaks the popup resolver class.
- Online matches meet through the `GameRooms` port (`storage/game-rooms.ts`,
  `FirestoreGameRooms`), asked of `GameCloud.rooms()` - null without a
  project. The match itself goes device to device (`net/`), never through
  Firestore.
- Profiles, friends, challenges and the matchmaking queue go through the
  `GameSocial` port (`storage/game-social.ts`, `FirestoreGameSocial`), the
  online status through `GamePresence` (`RtdbGamePresence`, the Realtime
  Database) - `GameCloud.social()` and `.presence()`, null without a
  project or its database. `SocialService` is the one place the game reads
  them from; specs use `FakeGameSocial` and `FakeGamePresence`
  (`src/testing/`).
- Only `firebase-connection.ts` imports Firebase at runtime, and only
  `provide-game-cloud.ts` imports that file; the rest takes types only, so
  the specs never load the SDK.
- The release pipeline deploys `apps/bacteria-game-remote/firestore.rules`
  and `firestore.indexes.json` beside it, which holds the rooms' TTL policy
  (`bacteria-game-remote:deploy`, config `firebase.bacteria-game-remote.json`).
- Treat the ports as asynchronous, even though local storage answers at once:
  - `watch` may emit later than the subscription, and again when another tab
    or device changes the value.
  - `write` and `update` are fire and forget.
  - Services keep their state in signals, and the game never waits on storage
    during a match.
- Stored values are JSON-plain data with a parser per key (`parseProgress`,
  for example). The parser keeps whatever it can read and drops the rest, so
  a damaged or older entry never throws. Firestore holds each value as a JSON
  string, `players/{uid}/storage/{key}` = `{ json, updatedAt }`; the rules in
  `apps/bacteria-game-remote/firestore.rules` let only that player read and
  write it.
- Data that more than one tab or device writes, such as progress, goes
  through `update`, applied to the latest stored value:
  - Medallions and achievements merge in a way that can only gain: a better
    medallion is kept, never a worse one, and an achievement keeps its
    earliest day. Such a change comes to the same however late or often a
    backend applies it.
  - Counts (the lifetime totals) are added to the stored value, never taken
    from memory, which misses what the storage has not told yet. An adding
    change must land exactly once, so `FirestoreGameStorage` runs `update` as
    a transaction, queued per key. Offline, the change waits to be online and
    runs then. The queue lives in memory: a change made offline is lost when
    the page closes before the device is online again.
- A late answer must not undo the player. A setting the storage does not
  hold and one the player changed before it answered keep their value. A
  match under way keeps its setup; the stored setup waits for the menu and is
  what gets written meanwhile.
- Backends skip writes that leave the stored value as it is, since every write
  to Firestore is billed. Services do not need to cache the stored value for
  that, but they should not call the port without a change either.
- Accounts: a visitor plays as a guest (an anonymous Firebase account) without
  asking. Signing in with Google links the guest, so the uid and the progress
  stay. A Google account that already played elsewhere takes over instead:
  `GameAccount.players` tells a switch with `adoptsGuest`, and
  `ProgressService` adds the guest's progress to the account once
  (`adoptProgress`). Any other switch (signing out starts a new guest) resets
  the service to the next player's progress. A service that keeps the
  player's data has to do the same: listen to `players` and start over.
- `playerIds` follows `players` from the same replaying subject, which keeps
  a switch before it tells anyone: a service that stores right as it hears of
  a switch stores for the next player. Between a sign-out and the next guest
  the player is null; the storage holds back what is stored meanwhile for
  that guest.
- The first cloud player adopts the progress this device kept in local
  storage before the cloud (`moveDeviceProgress`), once.
- Specs for a service that stores data also run it against `LateGameStorage`
  (`src/testing/`, kept out of the lib build), an asynchronous fake, so a
  service that depends on local storage answering synchronously fails a test.
  `FakeGameAccount` adds a player per storage and switches between them.
- Local development against the Firebase emulators:
  `nx run bacteria-game-remote:serve-emulator` (starts
  `firebase-emulators`, a `demo-` project, no credentials needed). The
  emulators use their own ports (`firebase.bacteria-game-remote.json`), apart
  from rollapolla's, which may run on the same Nx Cloud worker.
- The server side is `apps/bacteria-wars-functions` (ADR 0011, ADR 0012):
  Cloud Functions that import the game only through the engine entry
  (`@wolsok/feat-lazy-bac-game/engine`, loaded with `loadEngine()`), so
  anything the engine exports must stay free of Angular, RxJS and
  Firebase. The contracts it shares with the client and the admin area
  are `state/boards.ts`, `state/attempts.ts` and `state/admin-commands.ts`.
  Its `test-rules` target tests `firestore.rules` and
  `database.rules.json` against the emulators, so change a rule together
  with its spec there; `emulators` starts the functions emulator (port 5401) with the others. It is deployed by the release pipeline's non-cdk leg through its own
  `deploy` target, never by the remote's hosting deploy.
- E2E never touches the real project: Playwright serves `serve-e2e`, the
  production build with `environment.e2e.ts` (the emulators), in its own
  `dist/apps/bacteria-game-remote-e2e`, next to `firebase-emulators`. The
  Firestore emulator needs a JVM; the Nx Cloud workers install one
  (`.nx/workflows/workers.yml`). `e2e/cloud-save.spec.ts` covers the cloud:
  each test signs in to accounts of its own (`uniqueEmail`).

## Online matches: keep the engine deterministic

Online matches run in lockstep (`net/lockstep.ts`, ADR 0009): both devices
play the same `MatchEngine` from the same seed and the same inputs. Anything
that changes what a tick does from those - a `Math.random`, the wall clock,
a frame delta, a value only one device has - desyncs every online match, as
it breaks replays. Inputs reach the engine only on the input grid
(`onGrid`, `STEER_STEPS`, `DRAG_STEPS`), and `NET_VERSION` follows
`BALANCE_VERSION`, so two devices with different balance tables refuse to
play each other.

## Balance: the lab and the ladder's computer (ADR 0016)

- Against the computer on the ladder and on generated levels the menus
  pass loadouts and `ladder: LADDER_VERSION` in the plan: the computer then
  plays its place on the difficulty curve (`state/difficulty-curve.ts`) and
  carries `computerLoadout` (`state/computer-opponent.ts`). Such a replay
  is version 4. A change to `SKILL`, `STRENGTH`, the bands or a rule only the ladder's
  profiles switch on (`attacksAtCap`, `pushesAfterCryo`) changes those matches:
  raise `LADDER_VERSION` and take the new fingerprint in
  `golden-match.spec.ts`. A plain match must not move (`BALANCE_VERSION`).
- The balance lab (`state/balance/`, runner `tools/bacteria-game/balance/`)
  plays the stand-in (`REFERENCE_PROFILE`) against that computer. A change
  to the balance, the levels, the bots or the curve re-checks it:
  `nx run feat-lazy-bacteria-game:balance-check` (short, against the
  committed `state/balance/balance-report.json`); a new baseline with
  `tsx tools/bacteria-game/balance/run.ts full --update` (hours; nightly on
  GitHub, `.github/workflows/bacteria-balance.yml`).

## The deterministic simulation (ADR 0015)

- `GridSimulation` (`state/grid-simulation.ts`) is what the GPU simulation
  and its deterministic CPU twin share: walls, zones, pellets, effects, the
  frame's uniforms and what a report means. Change the bookkeeping there,
  once; `GpuSimulation` adds only the shader passes, `IntSimulation` their
  TypeScript reference (`intReferenceTick`, `intReport`).
- A change to the integer passes, the report or the uniforms has to land in
  the shaders and in the reference alike, or the GPU cross-check fails.
  Then regenerate the goldens: `golden-gpu-int.json`, `golden-gpu-sim.json`
  and `SELF_TEST_GOLDEN`, bumping `GPU_SELF_TEST_VERSION`, so devices test
  again.
- Two rulesets (`Ruleset`, `state/simulation.ts`): `cpu`
  (`BacteriaSimulation`) and `gpu-int` (the integer passes: `GpuSimulation`
  with `deterministic`, or `IntSimulation`). `Simulation.ruleset` names a
  simulation's; the float GPU one has none (null) and is never recorded.
- The game picks a simulation with `chooseSimulation`
  (`gl/simulation-choice.ts`): with `DETERMINISTIC_SIMULATION` on (the
  rollout's switch, off until the owner's real-device check), the integer
  GPU passes on a GPU that passed `GpuSelfTestService`'s self-test, the
  `cpu` ruleset otherwise. While it is off, the float GPU simulation plays
  as before. The
  owner's policy: a device without a passing GPU plays and offers only
  `cpu`; `IntSimulation` replays and checks `gpu-int` matches, it does not
  play them live (except as the stand-in when the GPU fails to start in an
  online `gpu-int` match).
- Online, each `hello` names the rulesets the device offers
  (`PlayerService.rulesetOffers`) and the host's `start` the agreed one
  (`agreedRuleset`): `gpu-int` only if both offer it. Ranked attempts are
  `gpu-int` only: a stored replay with an attempt must be one (replay
  version 5, `GPU_INT_REPLAY_VERSION`; it may carry the ladder too).
- The device override for a real-device check: `?sim=gpu-int`, `?sim=cpu`
  or `?sim=auto` in the URL (`SimulationOverrideService`, kept in
  `DeviceStorage`). It changes what local matches play, never what the
  device offers online; while the switch is off, `?sim=gpu-int` is what
  opts a device in (and runs the self-test). The settings ("Screen") show the ruleset local
  matches play and the self-test's verdict (`gl/simulation-check.ts`).

## Texts: English and German

- Every text the player sees goes through `I18nService.t` or the `t` pipe
  (`src/lib/i18n/`), with an English and a German entry in the area's
  `en/` and `de/` files. No literal user-facing strings in templates or
  notices.
- The state and the engine keep ids, not texts: level names, achievement
  texts, colour names and the like are looked up by their id in the
  components, never translated by the engine. The engine stays
  language-free like it stays deterministic.
