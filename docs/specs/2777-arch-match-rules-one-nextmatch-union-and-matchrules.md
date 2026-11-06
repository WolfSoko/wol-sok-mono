# Match rules: one `NextMatch` union and `matchRules()`

Spec for [#2777](https://github.com/WolfSoko/wol-sok-mono/issues/2777),
candidate 1 of
[`docs/bacteria-game/architecture-deepening.md`](../bacteria-game/architecture-deepening.md).

## Goal

The kind of the next match and the rules that follow from it are worked out
in one pure module of the game lib, `state/match-rules.ts`, instead of again
by every caller from five loose store fields.

- The store holds one field `next: OneMatch`, a tagged union of what the
  next match is set to outside the setup:
  `setup | ghost | mission | daily | endless`. It replaces the fields
  `ghost`, `matchLevel`, `dailyDay`, `endlessMatch` and `ranked`.
- `NextMatch = OneMatch | online` is what the next match is. The store
  computes it as `nextMatch` from `next` and `online`: an online seat wins
  over the one-match setting.
- `matchRules(next: NextMatch, setup: RulesSetup): MatchRules` returns, for
  the next match:
  - `kind`: `two-players`, `vs-computer`, `ghost`, `training`, `daily`,
    `endless` or `online`;
  - `levelId` and `planMode` (the level and mode it is planned on);
  - `mission`: the training mission's id, null outside one;
  - `recording`: `online`, `ranked`, `local` (recorded when the player's
    "record local matches" is on) or `none`;
  - `evolves`, `earns` (medallion, XP, progress), `inSeries`;
  - `rankedMatch`: the declared ranked attempt, null for an unranked match;
  - `canPause`, `canRestart`, `onlineGrid`, `locks` (`campaign` or
    `online`).
- The store exposes it as `matchRules`; the store's `level`, `matchMode`
  and `rankedMatch` computeds, `planModeOf`, `evolves()`, `recordsLocal()`
  and the mission and kind checks named in the issue read from it.

## Non-goals

- No engine change: `planMatch` takes a `MatchPlan` whose `mode` is the
  rules' `planMode`; nothing else of the rules is the engine's. The goldens,
  `SELF_TEST_GOLDEN` and `BALANCE_VERSION` stay as they are.
- `endless` (the run) and `endlessRanked` (the ranked run) stay store fields:
  they outlast a match. `online` stays a store field: the connection
  outlasts a match and a reset.
- No split of `GameStateService` (that is
  [#2778](https://github.com/WolfSoko/wol-sok-mono/issues/2778)).
- No change in behaviour, the analytics events or the UI, but the fix of
  decision 9 and the guard of decision 10.

## Decisions

1. **`online` is not part of `next`.** The seat is set and cleared by the
   connection, a reset leaves it. Keeping it apart and merging it in a
   computed (`nextMatch`) keeps the reset a one-field write.
2. **`ranked` lives in the `daily` and `endless` variants.** Only those two
   are ever ranked (ADR 0012); a ranked ghost or setup match can no longer
   be represented.
3. **A one-match setting replaces the one before.** `playGhost`,
   `playDaily`, `playMission` and `continueEndless` each set the whole
   variant. Before, `playGhost` and `playDaily` left the other fields as
   they were; every caller reset first, so no reachable state changes.
4. **A rematch drops the ranked outcome.** `oneMatch()` returns the variant
   with `ranked: null`, as the old `OneMatch` never held `ranked`: a ranked
   daily is declared again by `playDaily`.
5. **Training is the `mission` variant.** The setup's level is never a
   training level (the level choice and the settings take ladder and
   generated levels only), so `matchRules` reads the mission from the
   variant, not from `getLevel(levelId).mission`.
6. **The rules take a small `RulesSetup`** (`levelId`, `mode`,
   `seriesLength`), not the whole state, so the table spec needs no store.
7. **Rules that are no property of the match stay with their caller.** The
   grid after a forfeit and while a ranked attempt is declared stays in
   `arena-stage.ts`; the online lock of the new game's level choice
   (`lastKind === 'online'`) stays in `play-flow.ts`; whether `lastReplay`
   changes after a match is a switch on `kind` in `endMatch`.
8. **The analytics kind maps from the rules' kind** (`two-players` to
   `two_players`, `vs-computer` to `vs_computer`), so the catalog stays.
9. **The online result shows no couch duel.** The result screen showed the
   series and couch rivalry for an online match whenever the setup's mode
   was two players (it read the setup's mode). It now reads the rules'
   `kind`, which is `online`: the couch rivalry is no online match's, and an
   online match never counts for it (`earns` is false).
10. **A run on a training mission's level is no ghost to race.** Training
    is the `mission` variant only (decision 5), so such a ghost would play
    as a plain ghost. One predicate, `canRaceAsGhost`, keeps it out of
    `playGhost`, a challenge link (`offerChallenge`) and the result
    screen's ghost button. The game never records such a run (a training
    match leaves no `lastReplay`); only a crafted link could carry one.

## Acceptance

1. `state/match-rules.spec.ts` is one table spec covering every variant of
   `NextMatch` (with both setup modes and a ranked and unranked daily and
   endless) for every field of `MatchRules`.
2. The store has no `ghost`, `matchLevel`, `dailyDay`, `endlessMatch` or
   `ranked` field; `grep` finds none in the game lib outside unrelated
   names (`settings.matchLevel`, the matchmaker's `matchLevel`).
3. No caller tests `getLevel(...).mission` or `level().mission` for "is this
   training"; `planModeOf`, `evolves()` and `recordsLocal()` are gone.
4. The specs that covered the scattered rules (service, HUD, analytics,
   play kind, winner) move to the new interface; their old cases of the
   removed fields are deleted, not kept beside.
5. `npx nx test feat-lazy-bacteria-game`, `lint`, `lint-templates` and the
   engine's `test` pass; the engine is untouched.
6. The game's production build passes its budgets.
7. The game lib's `CLAUDE.md` names the store's `ranked` and `rankedMatch`
   (ranked play) and `playKindOf`: it is updated to `next` and `matchRules`.

## Open questions

None.
