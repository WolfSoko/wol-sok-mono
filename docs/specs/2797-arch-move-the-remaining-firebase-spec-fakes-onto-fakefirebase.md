# Move the remaining Firebase spec fakes onto FakeFirebase

Issue: [#2797](https://github.com/WolfSoko/wol-sok-mono/issues/2797), follow-up of [#2788](https://github.com/WolfSoko/wol-sok-mono/issues/2788) ([its spec](2788-one-fake-firebase-sdk-for-the-games-storage-adapter-specs.md)).

## Goal

Four specs still build private fakes of the Firebase SDK surface `FirebaseConnection` exposes (`dbSdk`, `rtdbSdk`, `authSdk`):

- `libs/features/lazy/bacteria-game/src/lib/storage/rtdb-game-presence.spec.ts` (a `FakeRtdb`)
- `libs/features/lazy/bacteria-game/src/lib/storage/firebase-game-account.spec.ts` (a `FakeAuth`)
- `libs/features/lazy/bacteria-wars-admin/src/lib/commands/admin-commands.service.spec.ts` (jest mocks of `addDoc`, `onSnapshot`, …)
- `libs/features/lazy/bacteria-wars-admin/src/lib/overview/overview.component.spec.ts` (string refs, canned snapshots)

All four move onto the shared `FakeFirebase` (`libs/features/lazy/bacteria-game/src/testing/fake-firebase-sdk.ts`), which grows the parts they need, so every Firebase adapter spec of the game and the admin runs on one faithful fake.

## Non-goals

- No change to the adapters, the ports, the admin services or `FirebaseConnection`.
- No change to the six Firestore adapter specs #2788 moved, beyond what a renamed fake member needs.
- The rules emulator suite stays the check of the rules.

## Decisions

- **The fake is split by SDK part, `FakeFirebase` stays the one entry.** `fake-firebase-sdk.ts` is about 650 lines of Firestore already; the Realtime Database moves into `testing/fake-realtime-database.ts` (`FakeRealtimeDatabase`) and Auth goes into `testing/fake-firebase-auth.ts` (`FakeFirebaseAuth`). `FakeFirebase` builds both and hands them out as `realtime` and `auth`; `rtdbSdk`, `authSdk`, `putValue` and `listened` keep working as today, so the moderation spec does not change. `connection()` gives the adapter all three parts.
- **Realtime Database, as presence uses it:** `ref`, `onValue(ref, next, cancel?)` with snapshots that have `val()` and `child(key).val()`, `set`, `remove`, `serverTimestamp()` (a sentinel stored as the server time), and `onDisconnect(ref)` with `remove()` and `cancel()`. A path the rules refuse (`refused`, as `rtdb:<path>` in the same `refused` set the Firestore part uses, matching the `rtdb:` prefix of `listened`) cancels the listener with `permission_denied` and drops it, as the database ends a refused listener for good; a refused write rejects. `.info/connected` is an ordinary value a spec sets (`putValue('.info/connected', true)`); `disconnect()` runs the armed `onDisconnect` removals, as a dropped connection does. Every write is logged in `realtime.writes`. Listeners are told asynchronously, like the Firestore part (`settleSnapshots()`).
- **Presence's writes get specs.** The current spec covers only `watch`; with the fake's writes, `set` (written once connected, armed to clear on disconnect, cleared for another player and for null) is covered too.
- **Auth, as `FirebaseGameAccount` uses it:** `onAuthStateChanged`, `onIdTokenChanged`, `getIdTokenResult` (tokens by uid, a plain Google token by default), `signInAnonymously` (guests `guest-1`, `guest-2`, …, `refusesGuests` fails it with a code), `signOut`, `linkWithPopup`, `signInWithPopup` and `signInWithCredential` as jest mocks the spec answers, `GoogleAuthProvider` with `credentialFromError`, and `currentUser` on the `auth` instance the connection carries. The spec helpers `become(user)`, `newToken()` and the user builders `guestUser(uid)`, `googleUser(uid, name)` move into the fake file. The jest mocks need `jest` at runtime, which every Jest spec of both libs has.
- **Firestore gains `addDoc`** (an auto id under the collection, like `doc(collection)` then `setDoc`, logged as a `set`) for the admin commands. The overview takes `doc`, `collection`, `query`, `orderBy`, `limit` and `onSnapshot` as they are; its spec seeds `adminStats/now` and the hourly documents and checks what the component shows from the query the fake evaluates, instead of canned answers that ignore the query.
- **The admin lib reaches the fake through a testing entry of the game lib**, `@wolsok/feat-lazy-bac-game/testing` (`libs/features/lazy/bacteria-game/src/testing.ts`), exporting `FakeFirebase` and its helpers only, like `@wolsok/feat-shared-bacteria-engine/testing`. It is excluded from the lib's build (`tsconfig.lib.json`) and skipped in `tools/federation/workspace-federation.js` beside the lib's other entries, and `CLAUDE.md` names it in the Native Federation line that lists those entries.
- **Every scenario stays,** with its assertions reading the shared fake's equivalents (`realtime.listened`/`listened` for listens, `writes` for the command document, `auth.become` for a user switch).

## Acceptance

1. `FakeRealtimeDatabase` and `FakeFirebaseAuth` exist with specs of their own (listen and refusal, writes, `onDisconnect` and `disconnect()`; auth state and token listeners, guests, refused guests, user switch), and `fake-firebase-sdk.spec.ts` covers `addDoc`.
2. None of the four specs declares a fake of `dbSdk`, `rtdbSdk` or `authSdk` of its own; all build their connection from `FakeFirebase`.
3. Every scenario of the four specs is still there and passes; presence's `set` has specs. `npx nx test feat-lazy-bacteria-game` and `npx nx test feat-lazy-bacteria-wars-admin` pass, as does `npx nx run feat-lazy-bacteria-game:typecheck-specs`.
4. `@wolsok/feat-lazy-bac-game/testing` resolves in the admin lib's specs, is skipped in `workspace-federation.js`, and the game lib's and the admin remote's builds do not contain it (`npx nx run bacteria-game-remote:build` passes, its lazy-admin check included).
5. Lint and format pass: `npx nx affected -t lint,lint-templates`, `npx nx format:check`.
6. `CLAUDE.md` names the testing entry where it lists the game lib's entries.

## Open questions

None.
