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
  through `update` with a merge that can only gain: a better medallion is
  kept, never a worse one. That lets a Firestore backend run `update` as a
  transaction, and lets concurrent writers converge.
- Specs for a service that stores data also run it against an asynchronous
  fake `GameStorage`, so a service that depends on local storage answering
  synchronously fails a test.
