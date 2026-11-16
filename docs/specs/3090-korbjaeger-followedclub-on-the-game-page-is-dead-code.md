# Korbjäger: followedClub on the game page is dead code

Issue: [#3090](https://github.com/WolfSoko/wol-sok-mono/issues/3090)

## Goal

Remove the dead `followedClub` (`apps/korbjaeger/src/app/game-page/followed-club.ts`), which only its spec calls, so the Spiel page has one way to find the followed side.

## Non-goals

- No change to what the Spiel page shows: its colours, breadcrumb and the Kader marking stay as they are.
- No change to `isFollowed` or `followedSide` beyond moving them.

## Decisions

- **Remove, don't adopt.** The page needs the followed side's whole Team, not just its Verein: the breadcrumb takes its name and id, the colours its `clubId`, both from the one `followedTeam` linked signal (which also keeps the last Team while Meine Teams are read again). Calling `followedClub` beside it would compute the same side twice, and could not keep the last value.
- **Rename the file to `followed-side.ts`** (and its spec), since `followedSide` and `isFollowed` are what it holds; the name `followed-club` would mislead once `followedClub` is gone.
- **Keep the spec's cases on `followedSide`**: the case "skips a side the Liga fills later" only exists for `followedClub`; it moves to `followedSide`, so no behaviour loses its test.
- **CLAUDE.md** names `followedClub` as what picks the Spiel page's Verein; it names `followedSide` instead.

## Acceptance

1. No `followedClub` symbol is left in `apps/korbjaeger` or CLAUDE.md (the plan of #2967 keeps its historical rename table).
2. `followed-side.ts` exports `isFollowed` and `followedSide`; `game-page.component.ts` and `game-report-part.ts` import from it.
3. `followed-side.spec.ts` covers: the followed side's Team, the home side where both are, none where no side is followed or Meine Teams are unread, and an open side the Liga fills later is skipped.
4. `nx test korbjaeger`, `nx lint korbjaeger` and `nx lint-templates korbjaeger` pass.

## Open questions

None.
