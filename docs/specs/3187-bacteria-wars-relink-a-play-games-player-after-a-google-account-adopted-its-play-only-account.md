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
before, in the same tab, and A's progress is in B.

## Non-goals

- No general "move" of a link inside `playGamesSignIn`: `settleLink` keeps
  refusing a Google writer while another account holds the player (PR
  [#3186](https://github.com/WolfSoko/wol-sok-mono/pull/3186)).
- No change for a guest (anonymous) adopted by Google: a guest has no link.
- No migration of accounts adopted before this ships (the case is rare; such
  a player keeps `linked-elsewhere` until an owner fixes the link by hand).

## Decisions

The manager approved the handshake with five conditions (request 1549);
they are folded in below.

- **Two-sided handshake, bound to the tab by a nonce.** A's session is gone
  once B signs in, and A cannot know B's uid before, so neither side alone
  can prove the adoption:
  1. _Release_ - right before `signInWithCredential(google)`, the Play-only
     session A writes `playGamesReleases/{A}` (`uid`, `nonce`, `createdAt`,
     `expireAt`). The `nonce` is random (128 bits), made in the tab and kept
     in memory across the switch. Rules: the id and `uid` are the writer's,
     the writer's token has the `playGames` claim and
     `sign_in_provider == 'custom'`, the writer is not banned. Create or
     overwrite; nobody reads it, so the nonce never leaves the tab but in
     the release and the adoption.
  2. _Adoption_ - once signed in as B **and once A's progress landed in B**,
     the tab writes `playGamesAdoptions/{id}` (`uid` = B, `from` = A,
     `nonce`, `createdAt`, `expireAt`). Rules: `uid` is the writer's, `from`
     is uid-shaped and not the writer, the writer's
     `sign_in_provider == 'google.com'`, the writer is not banned.
     An adoption moves nothing without a fresh release of `from` holding the
     same nonce, so a Google account that knows A's uid cannot race the real B.
- **Progress first** (condition 2). The adoption reuses the nonce as the id
  of the switch's progress adoption: every player document (progress,
  evolution) adopts A's value into B by `storage.update(..., { once: nonce })`,
  which lists the id in `players/B/storage/{key}.applied` - also for an
  empty value, so the server can check every key. The account collects
  each document's landing on the switch and writes the adoption only when
  all landed; when one failed or the switch was cancelled it writes none and
  leaves the release to its TTL. **The trigger checks it on the server
  too**: every `players/A/storage/{key}` must have
  `players/B/storage/{key}.applied` listing the nonce, or it answers
  `not-adopted` and moves nothing. A document no page adopted (a service not
  started) therefore keeps the link where it is.
- **A new trigger `playGamesAdoption`** (`play-games/adoption.ts`, exported
  with `PLAY_GAMES_ON`, which is `true` on `main`, so it goes live with the
  merge) runs the adoption through `runCommandDocument` and `claimCommand`
  (the release is consumed, so a second delivery must not run it). In one
  transaction it reads `playGamesReleases/{from}`, refuses `no-release` when
  it is missing, older than `ADOPTION_WINDOW_MS` (10 minutes, from its
  `createdAt`) or holds another nonce, checks the progress (above), moves
  every `playGamesLinks` document with `uid == from` to B (`linkedAt` now)
  and deletes the release. The writer must still exist with a provider
  (`no-account`, `not-google`). Not in `playGamesSignIn`: the next Play Games
  sign-in of B may come days later, past every TTL.
- **Bans follow the player** (condition 3): if A or B is banned, the
  adoption moves nothing and answers `banned`; the rules also refuse the
  release of a banned A. So a ban on A is never left on an account that
  loses its claim.
- **Claims follow the link**: B gets the `playGames` claim (as `markLinked`
  does), A loses it, so `guestCleanup` takes A after `GUEST_IDLE_DAYS`, as it
  takes every adopted guest - only after the server saw A's progress in B.
- The shapes (`PLAY_GAMES_RELEASES`, `PLAY_GAMES_ADOPTIONS`,
  `ADOPTION_WINDOW_MS`, `parsePlayGamesAdoption`, `PlayGamesAdoptionError`)
  live in the engine's `/cloud` entry next to the sign-in's.
- Both collections get their `PLAYER_DATA` entries, TTL on `expireAt` and
  rules tests. The privacy policy's section 6 (en/de) says that the link
  moves to the adopting Google account and that both documents are deleted
  after use or within a day; the root and lib `CLAUDE.md` and the spec of
  #3175 say where `linked-elsewhere` no longer applies.

## Acceptance

1. A Play-only session that signs in with a Google account which played
   elsewhere writes a release before and, once every player document landed
   its adoption, an adoption after the switch; a failed landing, a guest or
   a linking (no `credential-already-in-use`) writes none.
2. The trigger moves the link from A to B, sets B's claim, drops A's, deletes
   the release (emulator spec).
3. Nothing moves, and the result names why, without a release, with a stale
   one (> 10 minutes), with a wrong or missing nonce (the race), with a
   writer without Google, for `from == uid`, with A or B banned, or with a
   storage document of A whose adoption B does not list.
4. A second delivery of the same adoption changes nothing (`claimCommand`).
5. The rules refuse a release by an anonymous or Google session, for another
   uid, without the `playGames` claim or while banned, and let nobody read
   it; and an adoption by a non-Google session, for another `uid`, for
   `from == uid` or while banned.
6. After the move, `playGamesSignIn` as B answers `keep` (no
   `linked-elsewhere`), and a new guest is taken over by B.
7. Privacy section 6 names it in both languages; `player-data.spec.ts`,
   `firestore-indexes.spec.ts`, lint, typecheck and every affected test stay
   green.

## Open questions

- None blocking. The 10-minute window is a guess at a slow popup plus a
  slow network; it only bounds how long a release stays usable.
