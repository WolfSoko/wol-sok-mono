# Plan: player data map for account erasure

Spec: [`docs/specs/2784-arch-player-data-map-for-account-erasure.md`](../specs/2784-arch-player-data-map-for-account-erasure.md),
issue [#2784](https://github.com/WolfSoko/wol-sok-mono/issues/2784).
All paths below are under `apps/bacteria-wars-functions/`.

## 1. The map and its rules spec

- Files: `src/erasure/player-data.ts`, `src/erasure/player-data.spec.ts`,
  `project.json` (`test` inputs: `firestore.rules`, `database.rules.json`).
- Test first: the spec parses the rules' `match` paths and the Realtime
  nodes and checks coverage, unique paths and `{uid}` in `doc`/`tree`/`node`
  entries; red without the table, green with it.
- Commit: `feat(bacteria-wars-functions): map where a player's data lives`.

## 2. The table runs the plain deletes

- Files: `src/erasure/erase-listed.ts`, `src/erasure/erase.ts` (moved from
  `src/admin/erase.ts`), `src/boards/delete-player.ts`,
  `src/admin/accounts.ts`, `src/social/delete-player.ts`,
  `src/replays/forget.ts`, `src/main.ts`, `src/admin/guests.ts`.
- `eraseListed` for one part; each part calls it in place of its own plain
  deletes; `attempts`/`notices` leave `deletePlayerBoards`; `erasePart` /
  `erasePlayer` with `ErasureContext`; triggers and `guestCleanup` call them.
- Tests: `test` (pure specs, `main.spec.ts`, `guests.spec.ts`) green.
- Commit: `refactor(bacteria-wars-functions): erase a player through the data map`.

## 3. One emulator suite

- Files: `src/erasure/erasure.emulator.ts` (new); erase suites removed from
  `src/boards/boards.emulator.ts`, `src/admin/admin.emulator.ts`,
  `src/social/social.emulator.ts`, `src/replays/replays.emulator.ts`; other
  suites that erase a player call `erasePart('replays', …)`.
- Table-driven case per `doc`/`tree`/`field`/`node` entry, plus the custom
  cases moved over.
- Tests: `test-emulator` green.
- Commit: `test(bacteria-wars-functions): one table-driven erasure suite`.

## 4. Docs

- Files: `CLAUDE.md` (Cloud Functions, account deletion), JSDoc of the
  parts.
- Commit: `docs(bacteria-wars-functions): point account deletion at the data map`.

Before each commit: `npx nx format:write`, `npx nx affected -t lint,lint-templates`,
`npx nx test bacteria-wars-functions`.
