# Cloud records: ban, notice and kind shapes shared once

Issue: [#2782](https://github.com/WolfSoko/wol-sok-mono/issues/2782), candidate 6 of
[`docs/bacteria-game/architecture-deepening.md`](../bacteria-game/architecture-deepening.md).

## Goal

The documents the functions write and the game and the admin read are described once, in the
engine, the way `state/admin-commands.ts` already describes the admin commands:

- **The ban** (`bans/{uid}` and its Realtime Database mirror): one parser, one encoder of the
  mirror and one rule for whether a ban holds, used by the functions (`admin/bans.ts`,
  `limits.ts`), the game (`storage/game-moderation.ts`) and the admin (`moderation/admin-records.ts`).
- **The lists** that exist twice today: notice types, replay kinds, replay states, the admin
  statistics' fields and the hide reasons.

A new Node-only folder `libs/features/bacteria-engine/src/lib/state/cloud-records/` holds them,
with plain-millisecond types. Its parsers take a `toMillis` argument, so Firebase stays out of the
engine and each side maps its own Timestamp.

## Non-goals

- No change to what is stored: field names, Timestamps, the mirror's `0` for good, rules.
- No change to the replay record (`ReplayRecord`, `ReplayListing`) beyond its kind and state lists,
  nor to the board entries beyond the hide reasons. Command documents are candidate 7.
- No new behaviour in the views; the ban edge cases keep their outcome.

## Decisions

1. **One ban rule, end exclusive.** `banHolds(ban, now)` is `until === null || until > now`: a
   ban no longer holds at its `until`. That is what all four copies compute and what the rules'
   `notBanned()` (`until <= request.time` frees) and the database rules (`val() <= now`) say. The
   comments that call it "inclusive" (`bans.ts`, `limits.ts`) go.
2. **One lenient parser, as the rules read a ban.** `parseBan(data, toMillis)` returns
   `{ since, until, reason }` with `since` and `reason` null when unreadable, and null only for no
   document. An `until` that is null or not a Timestamp (a plain number included, which the rules cannot compare with `request.time`) reads as a ban for good, as the rules refuse a
   player whose ban document lacks a readable end. This is what the functions do today
   (`banOf`, `isBanned`); the game read such a ban as none and the admin dropped it. Both now
   show what the rules enforce.
3. **Each side keeps its own view of a ban.** The functions (`BanState`) and the admin
   (`BanRecord`, with the uid) map an unreadable `since` to 0 and `reason` to `other`; the
   functions write both, so only a document changed by hand meets the fallbacks. The game keeps
   them null (`PlayerBan` is the engine's `CloudBan`). Only the parsing and the rule are shared.
4. **The mirror** gets `mirroredBan(until)` (the number written) and `parseMirroredBan(value)`
   in the engine; the functions' `holdsInRealtime` becomes `banHolds(parseMirroredBan(value), now)`.
5. **The lists** move as `as const` arrays with their types: `NOTICE_TYPES`/`NoticeType`,
   `REPLAY_KINDS`/`ReplayKind`, `REPLAY_STATES`/`ReplayState`, `HIDE_REASONS`/`HideReason`, and
   `ADMIN_STATS_FIGURES` with `AdminStats` (the figures plus `entries` and `today`). The admin's
   stored statistics add their `at`. The functions' `HiddenBy` becomes
   `Partial<Record<HideReason, true>>`.
6. **The admin takes them through `admin-kit`**, as it takes the admin commands.
7. **Replace, don't layer.** The ban edge cases are tested once, in the engine
   (`cloud-records/*.spec.ts`); the game's, admin's and functions' specs drop their copies and
   keep only their own Timestamp mapping (and the functions' ban cache).

## Acceptance

- [ ] `bans/{uid}` is parsed by one engine function; no other ban parser remains in the functions,
      the game or the admin.
- [ ] "Does a ban hold" is written once (`banHolds`); every comment says the end is exclusive.
- [ ] The mirror is written and read through the engine's `mirroredBan`/`parseMirroredBan`.
- [ ] Notice types, replay kinds, replay states, hide reasons and the admin statistics' fields are
      defined once, in the engine.
- [ ] One engine spec covers the ban edge cases (`until === now`, `until` null, missing or damaged
      fields, the mirror's `0`, negative and non-finite mirror values); the old copies are gone.
- [ ] The engine stays Node-only (`engine-bundle.spec.ts`), the goldens and `SELF_TEST_GOLDEN`
      unchanged, no `BALANCE_VERSION` bump.
- [ ] `nx affected -t test,lint,lint-templates` green; `CLAUDE.md` names the new module.

## Open questions

None.
