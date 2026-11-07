# Plan: account erasure, pairs and adminCommands keep a deleted player's uid

Spec: [`docs/specs/2816-account-erasure-pairs-and-admincommands-keep-a-deleted-players-uid.md`](../specs/2816-account-erasure-pairs-and-admincommands-keep-a-deleted-players-uid.md).
All code in `apps/bacteria-wars-functions/src` unless named otherwise.

1. **Array field entries**: `erasure/player-data.ts` gives `ByField` an
   optional `contains: true`; `erasure/erase-listed.ts` queries
   `array-contains` for it. Tests: the seeding in `erasure.emulator.ts`
   writes `[uid]` for `contains`. Committed with task 2.
2. **Pairs carry their uids**: `boards/rank-online.ts` writes
   `uids: [host, guest].sort()`; `PLAYER_DATA` entry `pairs/{id}`, part
   `account`, `erase: 'field'`, `field: 'uids'`, `contains: true`. Tests
   first: the boards emulator spec expects `uids`, `player-data.spec.ts`
   the plain entries list. Commit `fix(bacteria-wars-functions): erase a
   deleted player's pairs`.
3. **Commands about the player**: `admin/command.ts` writes the found
   target (with `uid`) back with the result; `PLAYER_DATA` entry
   `adminCommands/{id}`, part `account`, `field: 'target.uid'`. Tests
   first: the admin emulator expects `target.uid` on a command by entry,
   the erasure table seeds nested fields. Commit
   `fix(bacteria-wars-functions): erase the owner's commands about a
   deleted player`.
4. **Privacy policy and docs**: section 12 of
   `apps/bacteria-game-remote/src/app/privacy/privacy.component.html`
   (German and English), `CLAUDE.md`'s erasure line. Commit
   `docs(bacteria-game-remote): ...`.

Checks before each commit: `npx nx format:write`, `npx nx affected -t
lint,lint-templates`, `npx nx test bacteria-wars-functions`,
`npx nx run bacteria-wars-functions:test-emulator`.
