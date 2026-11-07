# Spec: account erasure, pairs and adminCommands keep a deleted player's uid

Issue: [#2816](https://github.com/WolfSoko/wol-sok-mono/issues/2816), follow-up of
[#2784](https://github.com/WolfSoko/wol-sok-mono/issues/2784) (PR
[#2809](https://github.com/WolfSoko/wol-sok-mono/pull/2809)).

## Goal

A deleted account leaves no uid in `pairs` or `adminCommands`: the
`account` part of the erasure (`deletePlayerBoards` → `erasePart` →
`deleteAccount`) erases both, and `PLAYER_DATA` records how instead of
`keep`.

## Today

- `pairs/{day}_{uidA}_{uidB}` (`boards/rank-online.ts`) counts a day's
  ranked online matches of two players (`count`, capped by
  `PAIR_RESULTS_PER_DAY`), `expireAt` 2 days. Its id names both uids, its
  fields none, so nothing can find the pairs of one player. The privacy
  policy names it among what still holds the uid after a deletion ("the
  notes of how many online matches were counted (up to 2 days)").
- `adminCommands/{id}` is written by the owner (`AdminCommandsService`),
  run by `adminCommand` (`admin/command.ts`), TTL after a day. It keeps
  `target` (`{ uid }`, or `{ boardId, entryId }` for an entry), `reason`
  and `args` (a ban's `until` and reason code). `runAudited` audits it as
  `adminAudit/{commandId}`, same id, with `target.uid` filled in once
  found. `scrubAudit` scrubs `before`/`after` of the audit, so the ban's
  end and reason code survive in the command for up to a day, and the
  privacy policy does not name commands at all.

## Decisions

1. **Erase both, do not just document them.** A deleted account plays no
   more matches and receives no more commands, so neither document serves
   its purpose after the deletion; keeping it would only need text in the
   privacy policy. Erasing is cheap and matches "the erasure deletes all
   personal data" in section 12.
2. **`pairs` get a `uids` field** (`[host, guest]` sorted, the same pair as
   the id) and a `field` entry in `PLAYER_DATA` that matches it by
   `array-contains`. The id stays as it is, so the cap counts on unchanged
   and no migration is needed. A `ByField` entry gains `contains: true` for
   an array field; `eraseListed` then queries `array-contains`, which
   single-field indexes cover by default (no `firestore.indexes.json`
   change). Pairs written before the release lack `uids` and go by TTL
   within 2 days; no backfill.
3. **`adminCommands` are deleted, not scrubbed**: the audit is the record
   of what the owner did, the command only its transport; the owner's view
   reads a result only while waiting for it. `runAdminCommand` writes the
   target as found (with the player's `uid`) back on the command with its
   result, so a command by board entry names its player too, and
   `adminCommands` becomes a plain `field` entry (`target.uid`) in
   `PLAYER_DATA`, part `account`. Its result write ignores `not-found`: the
   erasure may take a command while it runs. The fields `uids` of `pairs`
   gets an index override with only `array-contains`.
4. **Privacy policy (section 12, German and English)**: "the notes of how
   many online matches were counted (up to 2 days)" leaves the list of
   what still names the uid; the erased list gains the owner's moderation
   commands about the account. Section 4 needs nothing.
5. `CLAUDE.md`'s erasure line for `account` names pairs and commands.

## Non-goals

- The owner's own uid in `adminCommands.uid` and `adminAudit.by`: the
  owner's account is not erased by this flow.
- Changing the pair's id or the cap's logic.
- A command by board entry that has not run yet when the account is
  erased: it has no audit entry yet, names no uid (only `boardId` and
  `entryId`), and goes by its 1-day TTL.
- A ranked online match whose ranking runs in the moment between the
  `account` and the `replays` part may still write a pair; it expires in 2
  days as today (covered by the policy's "what a device still stores"
  clause).

## Acceptance

1. `rankOnline` writes `uids` (sorted) on every pair it counts; the boards
   emulator spec checks it.
2. `erasePart('account', …, 'ada')` deletes every `pairs` document whose
   `uids` holds `ada` and leaves `bob`'s (table-driven plain entry test in
   `erasure.emulator.ts`, seeding the array).
3. `erasePart('account', …, 'ada')` deletes `adminCommands` with
   `target.uid == 'ada'` and keeps those about `bob` (table-driven plain
   entry); a command by board entry gets `target.uid` once it ran.
4. `PLAYER_DATA` has no `keep` entry for `pairs` or `adminCommands`;
   `player-data.spec.ts` lists `pairs/{id}` among the account part's plain
   entries.
5. Privacy policy section 12 updated in both languages, its spec green.
6. `nx test bacteria-wars-functions`, `test-emulator`, lint and format
   green; `bacteria-game-remote` privacy spec green.

## Open questions

None.
