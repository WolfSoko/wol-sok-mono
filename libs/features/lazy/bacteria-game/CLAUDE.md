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
- The Firebase SDK loads with a dynamic import, only when a project is set, as
  its own named app (`bacteria-wars`) next to the shell's default app, which
  belongs to another project. Native Federation shares `firebase/*` with the
  shell through the import map.
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
  `firebase-emulators`, a `demo-` project, no credentials needed).
