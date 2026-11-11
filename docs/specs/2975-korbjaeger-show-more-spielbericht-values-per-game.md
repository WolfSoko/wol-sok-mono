# Spec #2975: Korbjäger: show more Spielbericht values per game

Issue: [#2975](https://github.com/WolfSoko/wol-sok-mono/issues/2975).
Related: [#2948](https://github.com/WolfSoko/wol-sok-mono/issues/2948)
(`statisticType` of a Liga), [#2961](https://github.com/WolfSoko/wol-sok-mono/issues/2961)
(English code names).

## Goal

The Kader table on the Spiel page shows every Spielerwert the DBB's
boxscore (`match/id/{id}/boxscore`) records for a Kader, not only points,
field goals, free throws and fouls: playing time, threes, rebounds,
assists, steals, turnovers, blocks, efficiency and the starting five. Each
new column appears only where the DBB recorded values for it in that
Kader, so a youth Liga's Spielbericht looks as it does today.

## What the DBB sends (checked live on 2026-11-11)

Per player the boxscore carries `esz`, `pts`, `twoPoints`, `threePoints`,
`wt` and `onePoints` (each `{ made, attempted, quota }`), `ro`, `rd`, `rt`,
`as`, `st`, `to`, `bs`, `fouls`, `eff` and `isf`.

- A youth Liga (fixture `boxscore-2911141.json`, Bavarian U14) fills
  points, twos and threes made, free throws made and attempted, fouls
  and `eff`; every attempt of a field goal, every rebound, assist, steal,
  turnover, block and `esz` is 0, `isf` is `false`.
- The 1. Regionalliga Herren (Liga 54819, Spiele 2861555, 2861552, 2861671) fills all of them. There `esz` is the playing time in
  **seconds** (each side's sum is 12 000, five players for 40 minutes) and
  `isf` marks the **starting five** (exactly five per side). `rt` is
  `ro + rd`, `wt` is twos plus threes, and `eff` is the usual efficiency
  (points + rebounds + assists + steals + blocks − missed field goals −
  missed free throws − turnovers), matching for every player checked.
- NBBL, 2. DBBL and a 2. Regionalliga Herren Nord Spiel came back all 0
  (Kader only), and the professional Ligen keep no Spielberichte (learning
  L351): which Ligen fill what is the Verband's, never assumed by Liga.
- In the youth Spielbericht `eff` is computed from field goal attempts the
  DBB never got (a player with 10 points and two missed free throws gets
  12, as made − attempted counts negative). It is meaningless there.

## Non-goals

- ADR 0019 and ADR 0018 stay: no season statistics, no sums over Spiele,
  no stored Spielerwerte, no player pages, no new DBB read.
- No team totals (`homeTotalStats`, `homeTeamStats`) and no quotas as
  columns: the made/attempted pair says it, and the table must stay
  readable on a phone.
- Offensive and defensive rebounds are not split: one column, the total.
- No change to when a Kader counts as recorded at all beyond the new
  values (below), to the Spielbericht's cache or to the overview's Kader
  search.
- No use of `statisticType` (#2948).

## Decisions

- **The domain model grows, in English** (`PlayerStats` in the lib's
  `domain/game-report.ts`): `playingTimeSeconds`, `twoPointers`,
  `threePointers` and `freeThrows` as `Shots` (`{ made, attempted }`),
  `rebounds` (the total `rt`), `assists`, `steals`, `turnovers`, `blocks`,
  `fouls`, `efficiency` and `startingFive` (boolean). `fieldGoals(stats)`
  returns `Shots` (twos plus threes) instead of a number. `wt` is not
  read: it is the sum.
- **Which values a Kader records is a domain question, answered once in
  the lib**: `recordedStats(roster): RecordedStats`, a boolean per
  optional value (`playingTime`, `shotAttempts`, `threePointers`,
  `rebounds`, `assists`, `steals`, `turnovers`, `blocks`, `efficiency`,
  `startingFive`), each true where any player of the Kader has a non-zero
  value (`startingFive`: any `true`). A Kader without Spielerwerte records
  none. The app only maps it to columns.
- **Efficiency only where shot attempts are recorded** (`efficiency` =
  `shotAttempts`, any field goal attempt non-zero): without attempts the
  DBB's value is wrong (above), and showing it would mislead.
- **Points, field goals, free throws and fouls stay as they are**: shown
  whenever the Kader's Spielerwerte are recorded (`playerStatsRecorded`),
  which now also counts the new values (a Kader whose only non-zero value
  is a rebound is recorded).
- **Shots read made/attempted where attempts are recorded**: the field
  goal column ("FK") and the threes column ("3P") show `made/attempted`
  where `shotAttempts`, else only the made ones as today. Free throws stay
  `made/attempted`, as today.
- **Column order** follows the DBB's own: Nr., Name, Min., Pkt., FK, 3P,
  FW, Reb., Ass., BG, BV, Bl., F, Eff. Each short header carries its full
  German name as `aria-label` and `title` (as the existing ones do):
  "Spielzeit in Minuten", "Punkte", "Feldkörbe" (or "Feldkörbe getroffen
  von versucht"), "Dreier" (or "Dreier getroffen von versucht"),
  "Freiwürfe getroffen von versucht", "Rebounds", "Assists",
  "Ballgewinne", "Ballverluste", "Blocks", "Fouls", "Effizienz".
- **Playing time reads `m:ss`** (1724 s → `28:44`), a pure function in the
  app beside the rows. A player who did not play shows `0:00`.
- **The starting five is a label in the name cell**, not a column: a small
  "Start" with the title "In der Startfünf" (visually hidden text for
  screen readers says the same), only in a Kader that records it.
- **The name column sticks** while the wider table scrolls sideways on a
  phone (`sticky` on its `matColumnDef`, with the surface's background), so
  a row's numbers stay tied to a name. The Kader still scrolls on its own,
  never the page.
- **The rows' new and rewritten names are English** (Coding Rule 10): the
  row of a player's numbers becomes `PlayerStatsRow` with English fields,
  and the column ids become English (`points`, `fieldGoals`, …). The other
  German names of `kader-zeilen.ts` (`KaderZeile`, `kaderZeilen`) stay for
  #2967.
- **A fixture with every value filled**: `boxscore-2861555.json`, the
  Regionalliga Spiel above, recorded by `tools/korbjaeger/record-fixtures.ts`
  and anonymised like the others (every person invented). It joins
  `FIXTURE_REQUESTS` and the fixtures' README. Since the others' raw
  recordings are not at hand, `anonymise-fixtures.ts` takes optional
  fixture names (as `record-fixtures.ts` does) and rewrites only those, so
  the existing fixtures stay byte for byte.
- **CONTEXT.md** lists the new Spielerwerte under its entry.

## Acceptance

1. The lib maps every value above from `boxscore-2861555.json` (spec on
   named and anonymous players), and `boxscore-2911141.json` still maps
   with zeros for the unrecorded ones.
2. `recordedStats` is true for every value on the Regionalliga fixture's
   Kader, false for all on the youth one (efficiency included, although
   its `eff` is non-zero), and false for all on a Kader without
   Spielerwerte.
3. On a Kader like the youth fixture the Spiel page shows exactly the
   columns it shows today (Nr., Name, Pkt., FK, FW, F) with the same
   values, and no "Start" label.
4. On a Kader like the Regionalliga fixture it shows every column in the
   order above, FK and 3P as made/attempted, Min. as `m:ss`, and "Start"
   for the five starters.
5. A column whose value only one player has non-zero appears; one that
   every player has at 0 does not.
6. Every header has its German full name as `aria-label` and `title`; no
   English word of the German-text denylist appears in the template.
7. On a 360 px wide viewport the name column stays visible while the
   table scrolls sideways, and the page itself does not scroll sideways.
8. `korbjaeger` and `feat-shared-basketball-data` tests, lint,
   lint-templates and `typecheck-specs` (where present) pass; the existing
   e2e (`spiel.spec.ts`, `kinder.spec.ts`, `kontrast.spec.ts`) stays green.

## Open questions

- Whether a Verband fills only some of the new values (say rebounds but not
  assists) is unknown; the per-column decision covers it either way.
