# Spec #3026: Korbjäger "Über mein Kind": no marking link to a Spiel in a Liga without Spielberichte

Issue: [#3026](https://github.com/WolfSoko/wol-sok-mono/issues/3026). Follows
[#2990](https://github.com/WolfSoko/wol-sok-mono/issues/2990)
([PR #3018](https://github.com/WolfSoko/wol-sok-mono/pull/3018)).

## Goal

The step below a followed Team on `/suchen/kind/verein/{id}`
(`ChildStepComponent`, decided by `childStep`) links only to a Spiel whose
Liga the DBB keeps Spielberichte for, since only such a Spiel's page has a
Kader to mark the Kind in. Where every Spiel of the Team's Saison is in a
Liga without Spielberichte, the step says that the DBB keeps no Spielberichte
for its Liga, so the Kind cannot be marked there, instead of a link.

## Non-goals

- No change to the Spiel page, which already says why it has no Kader.
- No change to the overview's Kader search (`searchRosters`), which still
  reads the Spielberichte of the last played Spiele whatever their Liga
  (raised as a follow-up, not fixed here).
- No change to how the lib maps `statisticType` (`withoutGameReports`).

## Decisions

- **The lib answers whether a Spiel has a Spielbericht to expect.** A new
  domain helper `keepsGameReports(season, game)` in `team-season.ts`: false
  where the Spiel's Liga (`leagueOf(season, game.leagueId)`) is
  `withoutGameReports`, true otherwise (a Liga the Saison does not list
  counts as keeping them, as the Spiel page does when it does not know).
  The app only asks it, as the Spiel page asks `league.withoutGameReports`.
- **The link goes to the last played Spiel in a Liga with Spielberichte**,
  not simply the last played one (the lib's `lastWithGameReport`). A Team
  whose Vorrunde keeps Spielberichte and whose Hauptrunde does not still
  gets a link that works. Only a Team all of whose Spiele are in Ligen
  without them gets the new hint; one with such a Spiel still to come waits
  for it (`after-first-game`), as the hint would claim too much.
- **A third step kind `no-game-reports`**: `childStep` gives
  `mark` (a played Spiel with a Spielbericht to expect), `no-game-reports`
  (Spiele, none of them in such a Liga) or `after-first-game` (none of
  them played yet).
- **The hint's text**, in the component, German: "Für die Liga dieses Teams
  führt der DBB keine Spielberichte. Dein Kind kannst du hier deshalb nicht
  markieren." (`data-qa="child-step-no-game-reports"`).

## Acceptance

1. A `childStep` spec with a Saison whose Spiele are all in a Liga
   without Spielberichte gives `no-game-reports`, not `mark`.
2. A `childStep` spec where the newest played Spiel is in such a Liga and an
   older one is not gives `mark` with the older Spiel.
3. Ligen with Spielberichte behave as today (existing specs stay green).
4. `ChildStepComponent` shows the hint and no link for such a Team.
5. The lib's `keepsGameReports`, `lastWithGameReport` and `withoutAnyGameReports` have specs of
   their own.
6. A Team with a Spiel to come in a Liga with Spielberichte still gets
   `after-first-game`.

## Open questions

None.
