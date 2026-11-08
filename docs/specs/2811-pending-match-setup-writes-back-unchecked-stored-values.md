# Pending match setup writes back unchecked stored values

Issue: [#2811](https://github.com/WolfSoko/wol-sok-mono/issues/2811)

## Goal

When the stored settings arrive while a match is on, `StoredMatchSetup`
(`libs/features/lazy/bacteria-game/src/lib/settings/stored-match-setup.ts`)
keeps the stored values raw in `pending`. `toStore()` writes those values back
for every key the player has not touched. So an unreadable stored value (an
unknown `levelId`, an invalid `colors` pair) is written to storage again until
the menu applies the pending setup and drops it.

After the fix, the stored setup is read once, in `restore()`, with the checks of
`MATCH_SETUP`. Only readable values are kept, whether they are applied now or
wait for the menu. `toStore()` never writes back a value the game would not
accept.

## Non-goals

- No change to when a pending setup is applied (`GameState.START`, a series
  under way waits for its end) or to how a touched key wins.
- The device settings (`DeviceSettings`) stay as they are.

## Decisions

- **Parse in `restore()`, not in `apply()`.** One pure function,
  `readMatchSetup(stored)`, maps the stored record to `Partial<MatchSetup>`
  with the checks of `MATCH_SETUP` and leaves unreadable keys out. `pending`
  then has the type of what the game accepts, and `apply()` only drops the
  touched keys. The checks run once, and nothing else reads raw values.
- **The side points of the issue are already done.** The six keys are listed
  once in `MATCH_SETUP` now, which its type ties to `MatchSetup`
  (`game-state.service.ts`), and `touch()` and `sameMatchSetup` both compare
  through `sameValue` (`sameColors` for colours). PR #2796 made both changes,
  so this PR leaves them as they are.

## Acceptance

1. A stored setup with an unknown `levelId` and an invalid `colors` pair,
   restored while a match is on: `toStore()` gives the current `levelId` and
   `colors`, not the stored ones (new spec in `stored-match-setup.spec.ts`).
2. The readable values of that same setup are still in `toStore()` while the
   match is on, and applied once the menu is back.
3. The existing `stored-match-setup.spec.ts` and `settings.service.spec.ts`
   stay green. `nx test`, `lint`, `lint-templates` and `typecheck-specs` pass
   on `feat-lazy-bacteria-game`.

## Open questions

None.
