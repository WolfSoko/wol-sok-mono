# Spec #2783: command documents, one envelope, result and runner

Candidate 7 of [#2776](https://github.com/WolfSoko/wol-sok-mono/issues/2776)
(`docs/bacteria-game/architecture-deepening.md`, section 7).

## Goal

The client never calls a function: it writes a command document
(`replaySubmissions`, `replayCommands`, `adminCommands`) and a trigger
writes `result` back. Today the knowledge about these documents is spread
over four places. After this change it sits in two deep modules:

- **Engine** (`libs/features/bacteria-engine/src/lib/state/command-documents.ts`,
  Node-only, pure): the envelope's fields and TTL (`COMMAND_ENVELOPE_KEYS`,
  `COMMAND_TTL_MS`, `commandExpiresAt(now)`), the replay command types
  (`REPLAY_COMMAND_TYPES` with the player's and the owner's subsets),
  `parseReplayCommand`, and one `CommandResult` with `parseCommandResult`.
- **Functions** (`apps/bacteria-wars-functions/src/commands/run-command-document.ts`):
  `runCommandDocument(db, path, data, authId, run)`, which owns the writer
  check, the catch (`internal`) and the write-back of `result`.
  `runAdminCommand` and `runReplayCommand` keep only what their commands do.

The game and the admin write the envelope through one helper,
`commandEnvelope(dbSdk, uid, now)` (game lib `storage/command-envelope.ts`,
exported to the admin through `@wolsok/feat-lazy-bac-game/admin-kit`).

## Non-goals

- No change to the Firestore rules, the collections, the command types or
  what a command does.
- No new command, no change to `runAudited` or the audit entries.
- The ban, notice and kind shapes are #2782's.
- No change to the simulation: `golden-replay.json`, the GPU goldens and
  `SELF_TEST_GOLDEN` stay byte-equal, no `BALANCE_VERSION` bump.

## Decisions

- **The result's failure field is `error`** for every command
  (`{ ok, error?, at }`). ADR 0012 already specifies it, `runAudited` and
  the audit entries use it, and the admin client reads it.
  `replayCommand` stops writing `reason`; the game reads `error`.
  Stale clients: a game tab or PWA still on the old bundle reads `reason`
  and finds none for a day or so after the release, until it updates.
  Its only effect is in "My matches": a delete refused as `ranking` shows
  the general "could not delete" text, and one answered `not-found` shows
  that text instead of "deleted". No data is at risk, so no compatibility
  layer (writing both fields) is added.
- **The envelope helper lives in the game lib, not the engine**: it needs
  the Firebase SDK (`serverTimestamp`, `Timestamp`), which the engine must
  not import. The engine holds the TTL arithmetic it builds on.
- **One TTL, 24 hours**, documented once next to `COMMAND_TTL_MS`: the rules
  (`isCommandExpiry`) take an `expireAt` in the future and less than two
  days ahead, so a day leaves room for a wrong client clock.
- **The writer check comes first**: `runCommandDocument` answers
  `not-writer` before any parsing, for both kinds of command. A replay
  command with a non-string `uid` therefore answers `not-writer` instead of
  `malformed`. The rules already refuse both, so only a document the rules
  let through by mistake sees the difference.
- **The write-back tolerates a deleted command** for both kinds (today only
  `replayCommand`): an account deletion may take a pending command while it
  runs; nobody is left to read the result.
- **`parseReplayCommand` is strict** like `parseAdminCommand`: only the
  envelope keys, the fields the functions write on it (`result`, and
  `claimed` from `forget`) plus `type` and `replayId`, `replayId` as the rules take it
  (`[A-Za-z0-9_-]{1,64}`). The rules allow nothing else, so nothing that
  runs today is refused.
- **The engine's admin command parser takes `COMMAND_ENVELOPE_KEYS`** in
  place of its own list (plus `result`, which it skips).
- **Replace, don't layer**: the game's `ReplayCommandType`,
  `ReplayCommandResult` and `parseCommandResult` (`storage/replay-records.ts`),
  its `COMMAND_TTL_MS`, the admin's `AdminResult`, `COMMAND_TTL_MS`,
  `REPLAY_COMMAND_TYPES` and the `error ?? reason` workaround, and the
  functions' own `ReplayCommandType`, `CommandResult`, `AdminResult` and both
  copies of the catch and write-back are deleted. Their tests move to the
  new modules.

## Acceptance

1. The replay command types are declared once, in the engine; the game, the
   admin and the functions import them.
2. `COMMAND_TTL_MS` exists once (engine); every command document
   (`replaySubmissions`, `replayCommands`, `adminCommands`) is written through
   `commandEnvelope`, and its `expireAt` is `now + 24 h`.
3. Both functions write `result: { ok, error?, at }`; no code writes or reads
   `result.reason`.
4. `runAdminCommand` and `runReplayCommand` run through `runCommandDocument`;
   no other code catches a command's failure or writes its result.
5. An engine spec covers the envelope keys, the expiry, `parseReplayCommand`
   and `parseCommandResult`. One emulator suite covers `runCommandDocument`:
   not-writer (wrong and missing `authId`), internal (a throwing `run`),
   a duplicate delivery (`run` answers null: nothing written), and a command
   deleted before the write-back. The per-runner copies of those cases are
   gone.
6. The existing behaviour stays: the functions' specs and emulator suites,
   the game's and the admin's specs pass; the goldens are untouched.
7. `CLAUDE.md` and ADR 0011's result field say what the code does.
8. Lint, template lint, format and the affected tests pass.

## Open questions

None.
