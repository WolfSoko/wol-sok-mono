# Bacteria game

Rules for working on `libs/features/lazy/bacteria-game`, on top of the repo's
`CLAUDE.md`.

## Persistence must stay exchangeable for Firebase

The game keeps its data (settings, medallions, later the campaign, XP and
achievements) in local storage for now. It will move to Firebase later, so
the storage backend must be swappable by providing a different class, with no
changes to the services that use it.

- Everything the game stores goes through the `GameStorage` port in
  `src/lib/storage/game-storage.ts`. Nothing else touches `localStorage`,
  `sessionStorage`, IndexedDB or Firebase directly.
- `LocalGameStorage` is the default backend. A Firebase backend would be
  provided with `{ provide: GameStorage, useClass: FirestoreGameStorage }`.
- Treat the port as asynchronous, even though local storage answers at once:
  - `watch` may emit later than the subscription, and again when another tab
    or device changes the value.
  - `write` and `update` are fire and forget.
  - Services keep their state in signals, and the game never waits on storage
    during a match.
- Stored values are JSON-plain data with a parser per key (`parseProgress`,
  for example). The parser keeps whatever it can read and drops the rest, so
  a damaged or older entry never throws.
- Data that more than one tab or device writes, such as progress, goes
  through `update`, applied to the latest stored value:
  - Medallions and achievements merge in a way that can only gain: a better
    medallion is kept, never a worse one, and an achievement keeps its
    earliest day. Such a change comes to the same however late or often a
    backend applies it.
  - Counts (the lifetime totals) are added to the stored value, never taken
    from memory, which misses what the storage has not told yet. An adding
    change must land exactly once, so a Firestore backend runs `update` as
    a transaction. Offline, it queues the change and applies it once online.
- A late answer must not undo the player. A setting the storage does not
  hold and one the player changed before it answered keep their value. A
  match under way keeps its setup; the stored setup waits for the menu and is
  what gets written meanwhile.
- Backends skip writes that leave the stored value as it is, since every write
  to Firestore is billed. Services do not need to cache the stored value for
  that, but they should not call the port without a change either.
- Account switches are not handled yet. Settings are read once per visit, and
  progress only ever merges, so a second account would inherit the medallions
  of the first. When Firebase sign-in arrives, it has to:
  - reset the services' state on a switch (merging anonymous progress into the
    account once on the first sign-in is fine), and
  - decide whether settings follow the account.
- Specs for a service that stores data also run it against `LateGameStorage`
  (`src/testing/`, kept out of the lib build), an asynchronous fake, so a service that depends on local storage answering
  synchronously fails a test.
