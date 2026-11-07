# Spec #2828: Stored replay documents still copy the playback rule

Found by the `/simplify` altitude pass on PR
[#2827](https://github.com/WolfSoko/wol-sok-mono/pull/2827)
([#2813](https://github.com/WolfSoko/wol-sok-mono/issues/2813)).

## Goal

Whether a replay plays back is decided in one place, the engine's
`playbackRefusal` (`libs/features/bacteria-engine/src/lib/state/replay.ts`),
also for what is stored about a replay without its bytes: the row in "My
matches" and the gallery's pick (`fitsGallery`). Today both check the balance
table only:

- "My matches" (`replays/my-matches.component.ts`) shows the play icon for a
  row of another format, ruleset or ladder, and says "older" only once tapped.
- `featureBest` (`gallery/candidates.ts`, `fitsGallery`) can publish a match
  the gallery viewer then refuses as "older" (`replays/public-replays.ts`):
  after a `LADDER_VERSION` bump without a `BALANCE_VERSION` bump (as PR
  [#2710](https://github.com/WolfSoko/wol-sok-mono/pull/2710) made), or for a
  stored format that does not play.

## Non-goals

- **`nextWin`** (`boards/verify-endless.ts`) keeps its balance check. An
  endless run's win stores only `balanceVersion`; the check only saves a read
  before `replayVerdict`, which applies the whole rule to the replay itself.
  Storing more per win is a change to the run documents for no gain.
- **`replayFromHash`** (`state/replay-link.ts`) keeps its balance check: a
  ghost race takes formats and simulations playback refuses (version 1, the
  float GPU), so it is a different rule, not a copy of this one.
- No change to what the gallery viewer, the replay viewer or the boards
  accept, and no new user-facing text: an unplayable row keeps the
  "older" notice and the `history` icon it has today.
- No backfill of stored documents.

## Decisions

- **`playbackRefusal` takes the header fields it reads**, a new
  `PlaybackHeader = Pick<ReplayHeader, 'version' | 'simulation' |
  'balanceVersion' | 'ladder'>`, not the whole `Replay`. `canPlayBack(replay)`
  passes `replay.header`; `replayVerdict` likewise. Nothing in the rule
  changes, so the existing table of refusals in `replay.spec.ts` keeps
  holding.
- **One parse for the stored side**, in the engine's `state/cloud-records/`
  (where shapes both the functions and the game read live):
  `StoredPlayback { balanceVersion; replayVersion; simulation?; ladder? }` and
  `storedPlaybackRefusal(stored)`, which maps `replayVersion` to `version` and
  asks `playbackRefusal`. The row and `fitsGallery` call it; neither keeps a
  rule of its own.
- **The functions store `ladder`** on `replays/{id}` at accept time
  (`ReplayRecord`, `replays/accept-plan.ts`), only when the header has one, as
  the header does. `simulation` and `replayVersion` are stored already (since
  PR [#2622](https://github.com/WolfSoko/wol-sok-mono/pull/2622)).
- **Old documents without `ladder`** are taken as the current ladder (no
  ladder check), as `playbackRefusal` does for a header without one. That is
  safe: `BALANCE_VERSION` 7 (PR
  [#2725](https://github.com/WolfSoko/wol-sok-mono/pull/2725), 2026-10-31)
  came after `LADDER_VERSION` 2 (PR #2710, 2026-10-27), so every document on
  the current balance was recorded with ladder 2 or none; the next ladder bump
  finds the field stored. An absent `simulation` (none exists, but the game
  parses what it reads) is a refusal (`ruleset`), not a guess.
- **The game's listing carries `simulation` and `ladder`** (`ReplayListing`):
  the Firestore parse (`listingOf`) reads them, the local store
  (`local-game-replays.ts`, for guests without the cloud) writes them from the
  header and tolerates old entries without them as above, and so does the
  spec fake (`testing/fake-game-replays.ts`). `MatchRow.playable` becomes
  `storedPlaybackRefusal(listing) === null`.
- **`GalleryReplay` picks `replayVersion`, `simulation` and `ladder`** from
  `ReplayRecord`; `fitsGallery` replaces `balanceVersion === BALANCE_VERSION`
  with `storedPlaybackRefusal(doc) === null`. The privacy policy is untouched:
  the ladder version is no personal data, stored beside the balance version.

## Acceptance

1. `playbackRefusal` takes a `PlaybackHeader`; `canPlayBack`, `replayVerdict`
   and every caller compile and their specs pass unchanged in what they
   assert.
2. `storedPlaybackRefusal` gives the same refusal as `playbackRefusal` for a
   stored record of each case in `replay.spec.ts` (balance, format, ruleset,
   ladder, gpu, playable), null for a record without `ladder`, and `ruleset`
   for one without `simulation`.
3. `planAcceptance` stores `ladder` for a header with one and leaves it out
   for a header without one (`accept-plan.spec.ts`).
4. `fitsGallery` refuses a document on the current balance but another
   ladder, a ghost format, or the float GPU, and takes one without `ladder`
   (`candidates.spec.ts`).
5. "My matches" shows the `history` icon and the "older" notice without
   loading the bytes for a row on the current balance but another ladder or
   format (`my-matches.component.spec.ts`), and the play icon for a playable
   one.
6. `listingOf` and the local store read `simulation` and `ladder`, and an
   entry without `ladder` still lists (their specs).
7. `npx nx affected -t test,lint,lint-templates,typecheck-specs` and
   `npx nx test-emulator bacteria-wars-functions` pass.

## Open questions

None.
