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

## Revision after the live check (2026-11-11)

[PR #3032](https://github.com/WolfSoko/wol-sok-mono/pull/3032) shipped the
decisions above, and the live page still linked the BBL Spiel: the DBB's
Team Spiele (`team/{id}/matches`, `teamGames`) send `statisticType: null`
for every Liga, so a `TeamSeason`'s Ligen never carry `withoutGameReports`.
Only a Spiel's details (`matchInfo`, `game`), its Spielbericht, Spielplan
and Tabelle say it. The specs had built their Ligen by hand.

Revised decisions (approved by the manager):

- **The step asks the Spiel's details.** `childStep` again leads to the
  last played Spiel; `ChildStepComponent` reads that Spiel's details
  (`spielDetailsResource`, as the Spiel page does), and the pure
  `checkedChildStep(step, details)` turns the link into `no-game-reports`
  where the details' Liga is `withoutGameReports`. Details not read (yet,
  failed, or of another Spiel) leave the link: the Spiel page says why it
  has no Kader.
- **The lib helpers go again** (`keepsGameReports`, `lastWithGameReport`,
  `withoutAnyGameReports`): on a `TeamSeason` they can never be false.
  `League.withoutGameReports` says that a Team's Spiele leave it out.
- **Dropped:** the link to an older Spiel of another Liga with
  Spielberichte, and waiting for a Spiel to come in such a Liga; both would
  need every Liga's details. Youth Teams, which this flow is for, rarely
  mix.
- **Cost:** one more `matchInfo` read per followed Team on the page (cached
  by the proxy), while the step shows its progress bar.

Revised acceptance:

1. A `checkedChildStep` spec: details of the Spiel in a Liga without
   Spielberichte give `no-game-reports`; with them, or none read, or of
   another Spiel, the link stays.
2. A component spec on the recorded DBB answers: the Team's real Spiele
   (`team-313036-matches.json`) carry no `withoutGameReports`; with a
   Spiel's details from a recorded Liga without Spielberichte
   (`matchinfo-2930311.json`, `statisticType` 0) the step shows the hint
   and no link; with one with them (`matchinfo-2861436.json`) it links the
   last played Spiel.
3. Details that fail to load leave the link.
4. Live: korb.wolsok.de/suchen/kind/verein/1968, ALBA BERLIN followed,
   shows the hint instead of the link to /spiel/2970229.
