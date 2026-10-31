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
    without a project) and signs in and out. Its `owner` (the admin claim,
    a verified email and a Google sign-in in the current token) only shows
    the main menu's way to `/admin` on the game's own site.
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
  Firestore. Once the link opened, the host swaps the room for its stub
  (`OpenRoom.take`, ADR 0011), which the functions bind an online replay's
  players to: without it every online upload is refused. Only a room
  nobody joined is deleted (`close`).
- Profiles, friends, challenges and the matchmaking queue go through the
  `GameSocial` port (`storage/game-social.ts`, `FirestoreGameSocial`), the
  online status through `GamePresence` (`RtdbGamePresence`, the Realtime
  Database) - `GameCloud.social()` and `.presence()`, null without a
  project or its database. `SocialService` is the one place the game reads
  them from; specs use `FakeGameSocial` and `FakeGamePresence`
  (`src/testing/`). It watches a friend's status only while the
  friendship is mutual: the status becomes readable by friends only (ADR
  0012, owner's decision of 2026-10-26), a refused read ends the Realtime
  Database listener, so `RtdbGamePresence.watch` listens again a few
  times (the functions write the reader mirror a few seconds late). A new
  status read follows the same rule.
- The leaderboards (ADR 0012) are read through the `GameBoards` port
  (`storage/game-boards.ts`, `FirestoreGameBoards`), asked of
  `GameCloud.boards()` - null without a project - and only by
  `BoardsService` (`boards/`). The functions write every board; the game
  only reads: the top document live, pages of `entries` (`status in`
  `VISIBLE_STATUSES`, ordered `sort` desc, `atHour` asc, the document id,
  as the one entries index and the rules want; a new query goes into
  `GAME_QUERIES` in `apps/bacteria-game-remote/src/firestore-indexes.spec.ts`),
  and the player's own row from `boardMembers/{uid}`: `boards` says which
  boards they are on (the entry ids exist for every kind at once), a
  refused `get` of their entry reads as hidden, a missing one (the rules
  let it through as not found) as no counted result yet, and a position
  below the top 50 is one `count()`. An own row
  the owner hides says it is hidden, never that it does not count (ADR
  0012, owner's decision of 2026-10-25). Specs use `FakeGameBoards` and
  its `topRowsOf` (`src/testing/`). The main menu shows the screen with the
  cloud while the `leaderboards` toggle is on.
- Recorded matches (ADR 0011) go through the `GameReplays` port
  (`storage/game-replays.ts`), asked of `GameCloud.replays()`:
  `FirestoreGameReplays` once the project takes them
  (`GameCloudOptions.replays`, on in the remote's production and emulator
  environments), else `LocalGameReplays` on this device (the newest 20);
  `cloud` tells which. The client never writes `replays`: it writes
  `replaySubmissions` and `replayCommands`, which the functions carry out,
  and reads its own replays back (`listMine`, one query in `GAME_QUERIES`).
  `listingOf` reads the functions' fields of `replays/{id}` - the seat from
  `seats` (online, host 0), `rankedReason` (`ARRIVAL_REASONS`,
  `ONLINE_REASONS` in `state/replay-reasons.ts`, exported through
  `engine.ts`, where the functions take their reason types from),
  `galleryOut`, `publicId` - and leaves out what it does not know. A new
  reason needs its text in the `replay.reasons` area (a `satisfies` there
  fails to compile without it). In the cloud
  `remove` ("Keep out of the gallery") keeps a match out of the gallery
  and deletes nothing; "Delete" sends `forget` (ADR 0012, owner's
  decision of 2026-10-26): the functions take the player out of the
  replay (`players`, seats) and its public copies, so it leaves
  `listMine`, while the replay stays anonymised for the statistics.
  `FirestoreGameReplays` sends it while a ban holds, as the rules allow;
  it answers `ranking` while the boards may still rank the match (the
  screen says it can be deleted later) and `not-found` for one that no
  longer names the player (read as deleted). On this device both delete
  for real. "Delete" takes two taps, like the HUD's "Give up", both
  through `armedTap` (`armed-tap.ts`): the first arms that match's button
  for `ARMED_MS` (3 s), the second deletes; the button stays the same
  element, so keyboard focus stays on it. The privacy page (`apps/bacteria-game-remote/src/app/privacy`)
  says what each does: keep it in step. "My matches" (`replays/my-matches.component.ts`)
  and the match just played (`replay-screen.component.ts`) are stage
  screens; specs use `FakeGameReplays` (`cloud`, `change` and
  `forgetAnswer`).
- The result screen's replay note (`replays/replay-note.component.ts`)
  says once per device, after the first match against the computer the
  cloud saved (not online, not ranked), that such matches are saved and
  that Settings -> Matches turns it off (owner's decision of 2026-10-26:
  recording stays on by default). The device setting
  `recordingHintShown` keeps it shown; the note decides only once
  `GameSettingsService.loaded` says the stored settings are read.
- A local match against the computer is recorded on every simulation
  resolution (owner's decision of 2026-10-26), but only one on the online
  grid (`onOnlineGrid`, `state/replay.ts`) goes to `GameReplays`: the
  stored parse and the functions take no other. On the online grid a
  recorded match plays a ruleset (`recordedSeats` in `PlayerService.init`:
  `cpu` where the device would pick the float GPU); on another grid it
  plays what the device picks unrecorded, and a float GPU match leaves no
  recording - recording never moves a match off the GPU there. Such a
  recording stays in `lastRecording` for "Watch replay", the note says it
  is not saved and why (`replay.status.notSavedGrid`), and the viewer lays
  a replay out on its own grid (`simResolutionOf`, `state/arena-size.ts`).
- Ranked daily attempts and endless runs (ADR 0012) are declared through
  the `GameRanked` port (`storage/game-ranked.ts`, `FirestoreGameRanked`),
  asked of `GameCloud.ranked()` - null without a project - and only by
  `RankedService` (`ranked/`). A declaration is a transaction (it fails
  offline instead of waiting in the cache) that writes `{ at:
serverTimestamp(), expireAt }` and nothing else - what the rules'
  `isDeclaration` wants - then reads `at` back with `getDocFromServer`,
  3 s in all (`DECLARE_TIMEOUT_MS`; past it one more read from the server
  takes a declaration that committed late), `at` floored to whole ms
  (`millisOf`, `storage/firestore-values.ts`) as the server reads it; the
  seed is `attemptSeed(uid, id, at)`, the match `rankedPlan` on the online
  grid, on the level of the attempt's own day, `gpu-int`, no restart and
  no pause (the deadline runs from the declaration; the HUD's "Give up",
  two taps, is its way out), uploaded whatever the
  recording settings say, with the attempt in the header and the
  submission. Ranked play is offered by
  the owner's toggles (`rankedDaily`, `rankedEndless`: off hides the
  switch) on a device whose GPU passed the self-test and has the integer
  passes (`deviceReady`), to a signed-in player no ban holds; the
  player's choice is the device setting `ranked`. The store's `ranked`
  holds the start's outcome: the declared match (`rankedMatch`) and what
  the result screen says of it (`note`, ids, texts in `boards.ranked`).
  Specs use `FakeGameRanked`.
- The owner's moderation reaches the player through the `GameModeration`
  port (`storage/game-moderation.ts`, `FirestoreGameModeration`), asked
  of `GameCloud.moderation()` and read by `ModerationService`
  (`moderation/`): `bans/{uid}` live with its Realtime Database mirror
  (either holding is a ban, ended by itself at `until`) and
  `players/{uid}/notices`, deleted when dismissed. A ban takes away what
  the rules' `notBanned()` refuses: `FirestoreGameStorage` holds the
  player's writes until it ends (as offline), `FirestoreGameReplays`
  sends nothing, `SocialService` writes nothing and takes the status
  back, matchmaking stops, the lobby, profile editor and friends shut,
  ranked play is refused. A new client write path follows the ban too.
  Specs use `FakeGameModeration`; a spec that mocks `GameCloud` gives it
  `moderation: () => null` (or a fake) where `SocialService` is in play.
- The replay viewer (`replays/replay-viewer.component.ts`) plays a
  `ReplayScene` (`replay-scene.ts`) on an `ArenaViewComponent` by itself
  (its frames drawn by `arenaContent`, `arena/arena-content.ts`, like the
  game's):
  its own `MatchEngine` from `replayEngine` (`state/replay.ts`, beside
  `canPlayBack` and `playReplay`, which the functions import through
  `engine.ts`: keep its signature), nothing of the game's state. A
  `gpu-int` replay plays on the viewer's own GL painter (the third
  argument of `replayEngine`) where its renderer is the host's `gpu`
  (`GpuSelfTestService.trustedRenderer`: "My matches" and the match just
  played; `/watch` runs no self-test and stays on `IntSimulation`).
  `ReplayScene.useGpu` moves the war between the GPU and the CPU where it
  was: onto the painter once it is there, off it before its context goes;
  a GPU that fails to set up falls back to `IntSimulation` and is not
  asked again.
  The timeline and the 10 s buttons seek (`ReplayScene.seek`): the war only
  plays forwards, so back restarts it, and the frames after a seek play on
  to its tick within `SEEK_FRAME_MS` each, the view running while paused.
  The viewer is a video player: it fills the box it is given (the stage's
  screen, the `/watch` page), fits the arena into it by width and height,
  and lays its controls over the arena, which hide a few seconds into
  playback (`CHROME_HIDE_MS`); the controls, the keys and the fullscreen
  (on its own element) are listed in the component's JSDoc. The match just
  played and "My matches" show it alone on the screen (`:host.playing`,
  `screen.player`), the list or the header only while nothing plays.
  Specs draw with `recordingPainters` and play `recordedReplay` (`src/testing/`).
- `/watch/{publicId}` (the remote's `app.routes.ts`, outside the entry
  route with the cloud) loads `WatchPageComponent` from the narrow entry
  `@wolsok/feat-lazy-bac-game/watch` (`src/watch.ts`), skipped by
  federation like `admin-kit`. Keep that entry free of the stage, the
  storage backends and Firebase: it reaches the public replay through
  `loadPublicReplay` (`storage/public-replays.ts`, plain `fetch` of
  `/replays/{id}/replay.json`, base64 `bytes`), nothing else. An oxlint
  override in `.oxlintrc.json` guards the imports of the files it pulls
  in; a new one goes into its `files`.
- The profile's `publicName`, `boardOptOut` and `galleryOptOut` (all off
  by default) are saved by `FirestoreGameSocial.saveProfile` with
  `mergeFields`: only the fields the player changed (a first profile
  whole), each whole (an avatar must not merge into the last one), and
  nothing else touched. The editor's switches and save wait for
  `SocialService.profileLoaded`: the stored profile read, or the server's
  word that there is none (`watchProfile` holds back a miss only the cache
  tells), so the defaults shown meanwhile never overwrite stored flags.
- The owner's feature toggles (ADR 0012) come through the `GameToggles`
  port (`storage/game-toggles.ts`): `RemoteConfigGameToggles` with a
  project, `NoGameToggles` (`{}`, the defaults) without, asked of
  `GameCloud.toggles()`, which starts no other backend. The game reads them
  from `FeatureTogglesService.toggles` only: `FEATURE_TOGGLES` at first,
  merged with what Remote Config says once it answered. The game asks
  (`FeatureTogglesService.start()`) after its first render, so Remote
  Config stays off the start. A feature that must not change midway reads
  its toggle as it starts (the simulation per match). Specs use
  `provideGameToggles` (`src/testing/fake-game-toggles.ts`).
- Remote Config is reached only through `FirebaseConnection.remoteConfig()`
  in `firebase-connection.ts`: the SDK is imported on demand there (off the
  start), set up once on the game's named app, fetched at most hourly and
  activated; null against the emulators or where it is unsupported, and it
  never rejects: it is the one place that catches Remote Config's errors
  and keeps its answer, so the callers neither catch nor cache. A parameter
  whose source is `static` counts as unset.
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
- Guests are offered the Google sign-in in `guest/` (owner's decision of
  2026-10-26). `SignIn` is the one way every button signs in and out; it
  waits for `ProgressService.loaded`. The main menu has
  `AccountChipComponent` (sign in, or the player's picture to the profile)
  and `GuestBannerComponent`; `GuestSignInComponent` is the line on Friends,
  Leaderboards, My matches and, once per device after a success, the
  result screen. `GuestNotice` counts the days the game was opened on the
  device (`GUEST_NOTICE_KEY` in `DeviceStorage`) and shows the banner, which
  says an unused guest account goes after `GUEST_IDLE_DAYS` (keep it equal
  to the functions' constant), from the third day or at once after a pause
  of more than 30 days; "Later" puts it away for two weeks, and the install
  offer waits behind it. The privacy page names what the device keeps.
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
  profiles switch on (`attacksAtCap`, `pushesAfterCryo`) changes those matches,
  as does one to what the computer buys (its budget, a character, the gene
  or weapon costs it spends along): raise `LADDER_VERSION` and take the new
  fingerprints in `golden-match.spec.ts`. A plain match must not move (`BALANCE_VERSION`).
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
- `GpuSimulation` runs its cell passes on the active area
  (`updateArea`) in deterministic matches too (ADR 0015, step 10): it
  must hold every cell a bacterium can reach since the report the area
  comes from, that report's own tick included, and the cells of the last
  `AREA_HISTORY` ticks. A change to how far a bacterium gets in a tick (a
  new pass that moves one, a longer escape) grows `recentReach` with it;
  the self-test and the cross-check's `roomy` scenario play on the area
  and catch one far too small, not one a tick short.
- Two rulesets (`Ruleset`, `state/simulation.ts`): `cpu`
  (`BacteriaSimulation`) and `gpu-int` (the integer passes: `GpuSimulation`
  with `deterministic`, or `IntSimulation`). `Simulation.ruleset` names a
  simulation's; the float GPU one has none (null) and is never recorded.
- The game picks a simulation with `chooseSimulation`
  (`gl/simulation-choice.ts`): with the owner's toggle
  `deterministicSimulation` on (default on since the owner's real-device
  check, `FEATURE_TOGGLES`; read as each match starts and in each online
  `hello`), the integer
  GPU passes on a GPU that passed `GpuSelfTestService`'s self-test on
  hardware (`gpuTrusted`, `gl/simulation-check.ts`), the `cpu` ruleset
  otherwise. A software renderer (SwiftShader, llvmpipe) passes the test
  but takes hundreds of ms a tick, so it plays `cpu`; CI has only
  SwiftShader, and its GPU e2e opts in with `?sim=gpu-int`. Switched off, the float GPU simulation would
  play as before ADR 0015. The owner's policy: a device without a passing GPU plays and offers only
  `cpu`; `IntSimulation` replays and checks `gpu-int` matches, it does not
  play them live (except as the stand-in when the GPU fails to start in an
  online `gpu-int` match).
- A software renderer paints the arena with Canvas 2D, not WebGL2
  (`createArenaPainter`, asked of a throwaway context through
  `webGlRenderer`, `gl/renderer.ts`): there it draws two to three times
  as fast, with every pixel. Without a GL painter the war has no GPU
  either, so such a device plays `cpu` whatever the toggle says. Only the
  device override `gpu-int` keeps WebGL2 on it (`ArenaLayout.softwareWebGl`,
  part of the canvas key, so changing the override builds a fresh
  canvas): CI's GPU e2e runs that way on SwiftShader.
- Online, each `hello` names the rulesets the device offers
  (`PlayerService.rulesetOffers`) and the host's `start` the agreed one
  (`agreedRuleset`): `gpu-int` only if both offer it. An agreed `gpu-int`
  match plays on the GPU (`SimulationChoice.gpuInt`) whatever the toggle
  says by the time it starts. Ranked attempts are
  `gpu-int` only: a stored replay with an attempt must be one (replay
  version 5, `GPU_INT_REPLAY_VERSION`; it may carry the ladder too). A
  ranked match plays the integer GPU passes whatever the toggle says
  (`PlayerService.init` with `ruleset: 'gpu-int'`, no lockstep), so it is
  offered only where the GPU is trusted (`RankedService.deviceReady`).
- The device's choice of simulation: "Simulation" (Auto, GPU, CPU) in
  the settings ("Screen"), or `?sim=gpu-int`, `?sim=cpu` or `?sim=auto`
  in the URL (`SimulationOverrideService`, kept in `DeviceStorage`). It
  changes what local matches play, also with the owner's
  `deterministicSimulation` off, never what the device offers online.
  The settings show the ruleset local matches play and the self-test's
  verdict (`gl/simulation-check.ts`).

## Usage statistics

- The game measures through `injectGameAnalytics()`
  (`analytics/game-analytics.ts`), typed by `GameEvents`; the calls do
  nothing unless the remote's app config provides analytics and the player
  said yes. A new event goes into `GameEvents`, `docs/analytics.md` and the
  privacy page (section 11).
- Matches: `GameStateService` tells `MatchAnalytics` when a match starts,
  ends and is left; what the match was (mode, level, ruleset) and what it
  earned is worked out there, not in the state. `MatchAnalytics` injects
  nothing of the game: `GameSettingsService` injects `GameStateService`, and
  its constructor changes the match setup, so free play is a user property
  set from the stage (`reportUserProperties`).
- Screens: the stage's panel gives the `screen_view`s (`trackScreenViews`),
  `match` while one runs.
- Settings: `GameSettingsService.changed` reports the keys in
  `REPORTED_SETTINGS` (`analytics/setting-change.ts`), not the match setup,
  the volumes or what the game remembers for itself.
- The consent question (`StatsBannerComponent`, `StatsConsent`) comes before
  the guest and install banners and only once `GameAds.consentSettled`.
  `/watch` stays free of analytics (the narrow entry); its page view comes
  from the router.

## Texts: English and German

- Every text the player sees goes through `I18nService.t` or the `t` pipe
  (`src/lib/i18n/`), with an English and a German entry in the area's
  `en/` and `de/` files. No literal user-facing strings in templates or
  notices.
- The state and the engine keep ids, not texts: level names, achievement
  texts, colour names and the like are looked up by their id in the
  components, never translated by the engine. The engine stays
  language-free like it stays deterministic.

## Busy indicator

- A tap that sets heavy work off runs it through `StageBusy.run`
  (`busy/stage-busy.ts`): the stage shows its spinner
  (`StageBusyComponent`), the browser paints it, and only then the work
  runs; a tap meanwhile is dropped, a key ignored (`onKeyDown`). The menus
  wrap their steps (New game, the training, a mode, a mission, a level,
  Next); a match is started by the stage through `startOnTap`, which asks
  for the fullscreen on the tap itself first (WebKit takes it nowhere
  else) and keeps the spinner up until the match runs, a ranked
  declaration included. Back, the stepper's header, taps during a match,
  the host's online start (lockstep) and the result screen's ways on
  stay immediate. Specs await `fixture.whenStable()` after such a
  tap; the stage's specs, which leave its template out, hold the work
  with a spy on `run` instead.

## Clearing the arena (the vaporize effect)

- The stage clears the arena after a match through `resetGame$`
  (`bacteria-game.component.ts`): `resetting` is true while the
  `@wolsok/thanos` directive on `.thanos-container` turns the last frame
  to dust, and the panel shows nothing meanwhile. Whatever the effect
  does, the stage must come back: the effect runs on the stage's own
  subscription to the directive's cold `vaporize$` and is cancelled at
  the set length plus `VAPORIZE_SLACK_MS` (a capture that finishes later
  must not lay its canvas over the menu), an effect that fails - at once
  included - is logged and the reset goes on, and `resetting` is cleared
  even when `GameStateService.reset()` throws.
- The directive fades its element back in by itself when it is done. The
  stage hides `.arena-frame` the moment the effect is over
  (`hideArenaUntilPainted`) and shows it again only once both the stage
  rendered what follows (`afterNextRender` in `resetGame$`) and the arena
  painted its next frame (`arenaScene.painted`), whichever comes last
  (`revealArenaWhenReady`): a paint alone lands on the next animation
  frame, often ahead of a slow change detection, and would show the old
  level under no menu. So it never flashes up between the dust and the
  menu screen, or before the next match's first frame. A new vaporize
  reveals it first (`revealArena`), so the snapshot is never taken of a
  hidden arena.
