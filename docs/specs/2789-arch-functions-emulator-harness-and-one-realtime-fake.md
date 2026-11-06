# Spec #2789: functions emulator harness and one Realtime fake

Candidate 13 of [#2776](https://github.com/WolfSoko/wol-sok-mono/issues/2776)
([`docs/bacteria-game/architecture-deepening.md`](../bacteria-game/architecture-deepening.md)).

## Goal

The emulator specs of `bacteria-wars-functions` (`src/**/*.emulator.ts`)
share one harness and one Realtime Database fake:

- `src/testing/emulator.ts` exports `useEmulatorDb()`: it starts the admin
  app on the emulator's project once, registers the `beforeEach` that clears
  the ban cache and the emulator's Firestore, and returns the `Firestore`.
  The eight files stop repeating the project id, `initializeApp`,
  `getFirestore` and the clearing `beforeEach`.
- `src/testing/fake-realtime.ts` stays the only Realtime fake: a tree with
  the real database's semantics, extended with a log of what was written
  (`calls`), removals that fail for chosen paths, and hooks around `get`
  and `removeIf` for the race specs. `admin.emulator.ts` drops its private
  fake (a flat map) and uses the shared one.

## Non-goals

- No change to the functions' code, the `Realtime` port or the
  `test-emulator` target.
- No change to `apps/bacteria-game-remote/rules-test` (the rules' emulator
  specs use the rules testing library, not the admin SDK).
- No new emulator coverage beyond what the moved specs already check.

## Decisions

- **The harness registers the hook itself.** `useEmulatorDb()` is called
  once at a spec file's top level, so the clearing `beforeEach` runs before
  the file's own hooks (Jest keeps registration order). That keeps the
  site spec's seeding `beforeEach` working unchanged.
- **The ban cache is cleared in every file**, including the site spec,
  which did not before: the cache is module state of `limits.ts`, and
  clearing it costs nothing. One behaviour for all is the point.
- **The call log records effects, not methods**: `set <path> <value>` for
  every value written and `remove <path>` for every removal, whichever port
  method caused it (`set`, `remove`, a `removeIf` whose test held, or an
  `update` entry). The admin specs ask "was the ban's mirror removed", not
  which method did it.
- **Failure is per path, on removal only** (`failRemoving`), as the admin
  spec needs: lifting a ban fails, setting one does not. A failing `update`
  throws before it writes anything, as the real multi-path update does.
- **Hooks** `beforeGet`, `beforeRemoveIf` and `afterRemoveIf` keep the
  admin's race specs as they are: they let another command run between the
  read and the conditional removal.
- **The statistics spec seeds the tree** (`connections`) instead of
  overriding `get` with a stub: the fake answers `get('connections')` from
  its tree, like the real database.
- **`src/testing/` is test code**: it moves out of `tsconfig.app.json` and
  into `tsconfig.spec.json`, since the harness uses Jest's hooks.
- **The fake gets a spec of its own** (`testing/fake-realtime.spec.ts`,
  run by `test`): tree semantics, the call log, the failing removals and the
  all-or-none update.

## Acceptance

1. No `*.emulator.ts` holds `initializeApp`, `getFirestore`, the project id
   or the emulator's clearing `fetch`; each gets its `db` from
   `useEmulatorDb()`.
2. `admin.emulator.ts` holds no Realtime fake of its own; every Realtime
   fake in the functions' specs comes from `testing/fake-realtime.ts`.
3. `npx nx test bacteria-wars-functions` is green, including the new
   `fake-realtime.spec.ts`.
4. `npx nx run bacteria-wars-functions:test-emulator` is green with the
   same number of tests as before.
5. `npx nx lint bacteria-wars-functions` and the build are green.
6. `CLAUDE.md` names the harness and the fake where it describes
   `test-emulator`.

## Open questions

None.
