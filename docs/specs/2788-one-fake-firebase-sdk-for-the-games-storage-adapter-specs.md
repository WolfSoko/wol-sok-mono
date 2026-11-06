# One fake Firebase SDK for the game's storage adapter specs

Issue: [#2788](https://github.com/WolfSoko/wol-sok-mono/issues/2788), candidate 12 of [`docs/bacteria-game/architecture-deepening.md`](../bacteria-game/architecture-deepening.md).

## Goal

The six Firestore adapter specs of the game lib (`libs/features/lazy/bacteria-game/src/lib/storage/firestore-game-{replays,ranked,rooms,social,storage,moderation}.spec.ts`) each build a private fake of the SDK surface `FirebaseConnection.dbSdk` exposes, and three of them copy a `FakeTimestamp`. One fake, `src/testing/fake-firebase-sdk.ts`, replaces all of them, so each spec keeps only its scenario setup and a new adapter spec gets a faithful SDK for free.

## Non-goals

- No change to the adapters or the ports, nor to `FirebaseConnection`.
- `rtdb-game-presence.spec.ts`, `firebase-game-account.spec.ts` and the admin lib's specs keep their own fakes (not named by the issue; raised as a follow-up if worth it).
- The rules emulator suite (`bacteria-game-remote:test-emulator`) stays the real check of the rules; the fake only stands in for the SDK's behaviour.

## Decisions

- **A class `FakeFirebase`, built with `new FakeFirebase({ docs, refused, serverTime })`**, its `connection({ rtdb })` handing an adapter the `FirebaseConnection`. A class, not a bare `fakeConnection()` function, because the specs need the store and the switches after the adapter was built (seed a document, refuse a path, go offline).
- **Documents by path, refs with `path` and `id`.** `doc(db, ...segments)`, `doc(collectionRef)` (auto id `auto1`, `auto2`, …), `doc(collectionRef, id)`, `collection(db, ...segments)`.
- **Server time as the SDK writes it.** `serverTimestamp()` returns the exported sentinel `SERVER_TIMESTAMP`; a write stores it as `FakeTimestamp.fromMillis(serverTime)`, so `instanceof Timestamp` holds as in production. The write log keeps the data as the adapter sent it.
- **One `FakeTimestamp`** shaped like the SDK's: `(seconds, nanoseconds)`, `fromMillis`, `toMillis` keeping the fraction (the browser SDK's behaviour, which `millisOf` floors).
- **Queries are evaluated, not only recorded:** `where` (`==`, `>=`, `>`, `<=`, `<`, `array-contains`), `orderBy`, `limit` filter the direct children of the collection; an operator the fake does not know throws, so it never answers wrongly in silence. Each query is also logged for specs that check the constraints the rules want.
- **Live listeners.** `onSnapshot(ref, [options,] next, error)` on a document or a collection or query emits at once and again on every write to the path or a direct child; `resend()` emits again (a metadata change). `fromCache` sets the snapshots' metadata. `pending` holds paths whose first snapshot waits for a write, as from the server.
- **Refusals by path:** a path in `refused` fails every read and write on it, listeners and transactions included, with `permission-denied`.
- **Transaction switches:** `offline` (fails with `unavailable`, as server reads do), `hanging` (never answers), `lateCommit` (commits, the answer never arrives), `hangingReads` (`getDoc`/`getDocs` never answer). Transaction writes are staged and applied after the function resolved.
- **Writes log:** every applied write as `{ kind: 'set' | 'update' | 'delete', path, data }`.
- **`updateDoc` on a missing document rejects with `not-found`**, as the SDK does; `setDoc` takes `merge` and `mergeFields`; `writeBatch` stages and commits.
- **Realtime Database part for the moderation mirror:** `ref`, `onValue`, `putValue(path, value)`; `connection({ rtdb: false })` gives `rtdb: null`.
- **Every spec keeps its scenarios and assertions;** only the fake under them changes. Where an assertion read a fake-specific field (`'now'` for the server time, `writes` as tuples), it reads the shared fake's equivalent.

## Acceptance

1. `src/testing/fake-firebase-sdk.ts` exists with its own spec covering paths and ids, server time, queries, listeners with refusal, transactions with each switch.
2. None of the six adapter specs declares a `FakeFirestore`, `FakeBackend`, `FakeTimestamp` or `FakeBytes` of its own; all use `FakeFirebase`.
3. Every scenario of the six specs is still there and passes: `npx nx test feat-lazy-bacteria-game`.
4. Lint and format pass on the changed files.
5. `CLAUDE.md` names the fake where it describes the game's tests, if it describes them.

## Open questions

None.
