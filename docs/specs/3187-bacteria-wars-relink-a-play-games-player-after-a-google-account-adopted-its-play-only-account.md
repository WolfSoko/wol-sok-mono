# Spec: relink a Play Games player after a Google account adopted its Play-only account ([#3187](https://github.com/WolfSoko/wol-sok-mono/issues/3187))

## Goal

A Play Games player P can play on a Play-only account A (a custom-token
session without provider, `playGamesLinks/{P}.uid == A`). When A signs in
with a Google account B that already played elsewhere,
`FirebaseGameAccount.signIn` takes the `credential-already-in-use` path and B
adopts A's progress, but the link stays on A. Afterwards every app start as B
answers `linked-elsewhere`, and after a sign-out the new guest is taken over
by A, which holds only the progress from before the adoption.

After this change the adoption itself moves P's link from A to B, and only
the adoption: a link moves only when A's own session agreed to it moments
before.

## Non-goals

- No general "move" of a link inside `playGamesSignIn`: `settleLink` keeps
  refusing a Google writer while another account holds the player (PR
  [#3186](https://github.com/WolfSoko/wol-sok-mono/pull/3186)).
- No change for a guest (anonymous) adopted by Google: a guest has no link.
- No migration of accounts adopted before this ships (the case is rare; such
  a player keeps `linked-elsewhere` until an owner fixes the link by hand).

## Decisions

- **Two-sided handshake, both halves written by the client as command
  documents.** A's session is gone once B signs in, and A cannot know B's uid
  before, so neither side alone can prove the adoption:
  1. _Release_ - right before `signInWithCredential(google)`, the Play-only
     session A writes `playGamesReleases/{A}` (`uid`, `createdAt`,
     `expireAt`). Rules: the id and `uid` are the writer's, the writer's
     token has the `playGames` claim and `sign_in_provider == 'custom'`, so
     only a Play-only account of a linked player can release itself. Create
     or overwrite (a second try within the day).
  2. _Adoption_ - once signed in as B, the tab writes
     `playGamesAdoptions/{id}` (`uid` = B, `from` = A, `createdAt`,
     `expireAt`). Rules: `uid` is the writer's, `from` is uid-shaped and not
     the writer, the writer's `sign_in_provider == 'google.com'`.
     A release alone moves nothing; an adoption without a fresh release of
     `from` moves nothing. So nobody can take a stranger's link by naming its
     uid.
- **A new trigger `playGamesAdoption`** (`play-games/adoption.ts`, exported
  with `PLAY_GAMES_ON`) runs the adoption through `runCommandDocument` and
  `claimCommand` (the release is consumed, so a second delivery must not run
  it). In one transaction it reads `playGamesReleases/{from}`, refuses
  `no-release` when it is missing or older than `ADOPTION_WINDOW_MS`
  (10 minutes, from its `createdAt`), moves every `playGamesLinks` document
  with `uid == from` to B (`linkedAt` now) and deletes the release. The
  writer must still exist with a provider (`no-account`, `not-google`).
  Not in `playGamesSignIn`: the next Play Games sign-in of B may come days
  later, past every TTL, and would need the device to remember the adoption.
- **Claims follow the link**: B gets the `playGames` claim (as `markLinked`
  does), A loses it, so `guestCleanup` takes A after `GUEST_IDLE_DAYS`, as it
  takes every adopted guest. A's progress was adopted into B by the same tab,
  which is exactly the consent the release records, so the concern of PR
  #3186 (a claim dropped without the progress adopted) does not apply.
- **The client does not wait** for the adoption's answer: the switch goes on
  either way; a failed write is logged, and the player then keeps
  `linked-elsewhere` as before.
- The shapes (`PLAY_GAMES_RELEASES`, `PLAY_GAMES_ADOPTIONS`,
  `parsePlayGamesAdoption`, `PlayGamesAdoptionError`) live in the engine's
  `/cloud` entry next to the sign-in's.
- Both collections get their `PLAYER_DATA` entries (`playGamesReleases`
  `doc` by uid, `playGamesAdoptions` `field` `uid`), TTL on `expireAt` and
  rules tests.

## Acceptance

1. A Play-only session that signs in with a Google account which played
   elsewhere writes a release before and an adoption after the switch
   (spec of `FirebaseGameAccount`); a guest or a linking (no
   `credential-already-in-use`) writes neither.
2. The trigger moves the link from A to B, sets B's claim, drops A's, deletes
   the release (emulator spec).
3. Without a release, with a stale one (> 10 minutes), with a writer without
   Google, or for `from == uid` nothing moves and the result names why.
4. A second delivery of the same adoption changes nothing (`claimCommand`).
5. The rules refuse a release by an anonymous or Google session, for another
   uid, or without the `playGames` claim; and an adoption by a non-Google
   session or for another `uid` (rules test).
6. After the move, `playGamesSignIn` as B answers `keep` (no
   `linked-elsewhere`), and a new guest is taken over by B.
7. `player-data.spec.ts`, `firestore-indexes.spec.ts`, lint, typecheck and
   every affected test stay green.

## Open questions

- None blocking. The 10-minute window is a guess at a slow popup plus a
  slow network; it only bounds how long a release stays usable.
