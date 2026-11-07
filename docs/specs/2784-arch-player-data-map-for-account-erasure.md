# Spec: player data map for account erasure

Issue: [#2784](https://github.com/WolfSoko/wol-sok-mono/issues/2784), candidate 8 of
[#2776](https://github.com/WolfSoko/wol-sok-mono/issues/2776)
(`docs/bacteria-game/architecture-deepening.md`).

## Goal

One module in `apps/bacteria-wars-functions` owns the list of where a
player's data lives and how a deleted account leaves it. The three
`auth.user().onDelete` triggers and `erasePlayer` (`guestCleanup`) go
through that module, and a pure spec fails when a uid-keyed path of the
Firestore or Realtime Database rules is missing from the list.

## Today

- Erasure is composed twice: `admin/erase.ts` calls the three parts
  (`deleteAccount`, `forgetPlayerReplays`, `deletePlayerSocial`), the three
  triggers in `main.ts` call them one each.
- What gets erased is spread over `boards/delete-player.ts`,
  `social/delete-player.ts`, `replays/forget.ts` (`withdrawPending`) and
  `admin/accounts.ts`; nobody owns the list.
- `players/{uid}/attempts` and `players/{uid}/notices` are deleted twice:
  by `deletePlayerBoards` and again by `recursiveDelete(players/{uid})` in
  `deletePlayerSocial`.
- No spec checks the rules against the erasure; the rule "a new collection
  keyed by uid gets its erasing" lives only in `CLAUDE.md`.

## Design

A new folder `src/erasure/`:

- `player-data.ts`: `PLAYER_DATA`, a declarative, readonly table. One entry
  per place: `store` (`firestore` or `realtime`), `path` (with `{uid}` for
  the player and other `{name}` wildcards), `part` (`account`, `replays`,
  `social`: the trigger that erases it, `null` for kept data), and `erase`:
  - `doc`: delete the document at the path (uid is its id);
  - `tree`: delete the document and everything below it;
  - `field`: delete every document of the collection whose `field` equals
    the uid;
  - `node`: remove the Realtime Database node;
  - `custom`: erased (deleted or anonymised) by the part's own code, with
    `how` saying what it does and where;
  - `keep`: holds no player data, or stays on purpose, with `why`.
- `erase-listed.ts`: `eraseListed(ctx, uid, part)` runs the `doc`, `tree`,
  `field` and `node` entries of one part and returns how many documents it
  deleted. Every delete runs, then the first failure is thrown
  (`settleAll`), as today.
- `erase.ts` (moved from `admin/erase.ts`): `ErasurePart`,
  `ErasureContext` (`db`, `realtime`, `now`, `tombstone`, `uncounted?`),
  `erasePart(part, ctx, uid)` (the one entry point per trigger, returns the
  counts for the log) and `erasePlayer(ctx, uid)` (every part through
  `erasePart`, then the first failure is thrown).

The part modules keep their custom steps and call `eraseListed` where their
order needs it:

- `account` (`admin/accounts.ts` `deleteAccount` with
  `boards/delete-player.ts`): reads `boardMembers` and `moderation` and
  claims the count first, then erases the listed entries (`boardMembers`,
  `limits`, `moderation`, `endlessRuns` by `uid`) beside the custom steps
  (board entries and `dailyRuns` through `boardMembers.boards`, the audit
  scrub, the tombstones, then `bans/{uid}` in both stores).
- `replays` (`replays/forget.ts`): erases the listed `replaySubmissions`
  and `replayCommands` (by `uid`) first, as `withdrawPending` does today,
  then forgets the replays and anonymises the public copies (custom).
- `social` (`social/delete-player.ts`): reads `listedBy` and the player's
  lists first, then erases the listed entries (`players/{uid}` tree,
  `profiles`, `queue`, `invites` by `from`, the four Realtime nodes) beside
  the custom steps (the player in other players' lists and mirrors, open
  rooms).

The triggers in `main.ts` call `erasePart('replays' | 'social' |
'account', …)`; `guestCleanup` calls `erasePlayer`.

## Decisions

- **The table drives the plain deletes, code keeps the rest.** Board
  entries, other players' lists, open rooms, replays and bans need reads,
  filters, transactions or a fixed order; a table of callbacks would only
  move that code. They stay `custom` entries that name their code, so the
  table is still the one list.
- **Each part calls `eraseListed` itself**, since the parts need it at
  different moments (replays first, account and social after their reads).
  A fixed "reads, then table" pipeline would not fit `replays`.
- **`attempts` and `notices` go once**, with the `players/{uid}` tree of
  `social`; `deletePlayerBoards` no longer deletes them. The table has one
  entry per path, and the spec fails on a path listed twice.
- **The rules spec checks every path, not a guessed set of uid-keyed
  ones.** Every `match` path of `firestore.rules` (nested ones joined) and
  every top-level node of `database.rules.json` must be covered by an
  entry: the same path (wildcard names ignored), or a `tree` entry above
  it. Data without a player gets a `keep` entry with its reason. Telling
  uid-keyed paths apart by wildcard names (`uid`, `owner`, `from`, …) would
  miss the next one named otherwise. Collections only functions write
  (`limits`, `dailyRuns`, `endlessRuns`, `adminAudit`, …) are not in the
  rules; they are in the table all the same.
- **One emulator suite.** `erasure/erasure.emulator.ts` replaces the erase
  suites of `boards.emulator.ts` (`deletePlayerBoards`),
  `admin.emulator.ts` (`deleteAccount`), `social.emulator.ts`
  (`deletePlayerSocial`, `erasePlayer`) and `replays.emulator.ts`
  (`deletePlayerReplays`, pending documents). Its table-driven part seeds
  one document of the player and one of another player for every `doc`,
  `tree`, `field` and `node` entry, runs `erasePart` and checks the first
  is gone and the second stays. The custom behaviour keeps its cases
  (board entries, other players' lists and mirrors, rooms, replays kept
  anonymised, tombstones, the count lowered once), called through
  `erasePart` / `erasePlayer`. Other suites that erase a player as part of
  their story call `erasePart('replays', …)`.
- **Function names stay.** `deletePlayerReplays`, `deletePlayerData` and
  `deletePlayerBoards` keep their export names: a renamed function is
  deleted and deployed anew.

## Non-goals

- No change to what is erased, kept or anonymised, apart from the double
  delete of `attempts`/`notices`.
- No change to the triggers' number, names, secrets or regions.
- No new erasure for data found missing: a gap the rules spec turns up is
  raised as a follow-up, not fixed here.
- Nothing in the game client, the rules or the engine.

## Acceptance

1. `PLAYER_DATA` in `src/erasure/player-data.ts` lists every place of a
   player's data in both stores, each with its part and way of erasing.
2. `player-data.spec.ts` fails when a `match` path of `firestore.rules` or
   a top-level node of `database.rules.json` has no entry, when a path is
   listed twice, or when a `doc`/`tree`/`node` entry has no `{uid}`.
3. The three `onDelete` triggers and `erasePlayer` go through `erasePart`;
   `admin/erase.ts` is gone.
4. `players/{uid}/attempts` and `notices` are deleted once.
5. The erase emulator suites are one: `erasure/erasure.emulator.ts`, with a
   table-driven case per listed entry; the old suites are deleted.
6. `bacteria-wars-functions:test`, `:test-emulator`, `lint` and `build`
   pass; the `test` target takes both rules files as inputs.
7. `CLAUDE.md` names the map and the spec where it describes account
   deletion.

## Open questions

None.
