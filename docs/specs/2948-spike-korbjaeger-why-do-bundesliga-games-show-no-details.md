# Spec: Korbjäger — why Bundesliga games show no details

Issue: [#2948](https://github.com/WolfSoko/wol-sok-mono/issues/2948). Part of [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861); related to [ADR 0018](../adr/0018-korbjaeger-dbb-data-behind-a-caching-proxy.md) and [#2923](https://github.com/WolfSoko/wol-sok-mono/issues/2923).

## Findings (2026-11-09)

The Spiel page was opened in the app (`nx serve korbjaeger` against the live DBB) for real games of the 2026/27 season, and the DBB's `matchInfo` and `boxscore` answers were compared. The raw answers stayed in the scratchpad.

| Liga (`ligaData.statisticType`)   | Games checked | Quarters (`matchResult`) | Kader (`matchBoxscore`) | Result confirmed |
| --------------------------------- | ------------- | ------------------------ | ----------------------- | ---------------- |
| 1. Bundesliga (easyCredit BBL), 0 | 9             | none                     | none                    | none             |
| Herren ProA, 0                    | 9             | none                     | none                    | none             |
| Herren ProB Nord, 0               | 9             | none                     | none                    | none             |
| Regionsliga Braunschweig mu12, 0  | 3             | none                     | none (empty lists)      | all              |
| 1. Bundesliga (Toyota DBBL), 1    | 9             | all                      | all                     | all              |
| 2. DBBL Nord, NBBL A Nord, 1      | 1 each        | yes / no                 | yes                     | yes              |

What the Spiel page shows for a BBL or ProA game (e.g. ALBA BERLIN – NINERS Chemnitz, 18.09.2026):

- the score with „vorläufig" and „Ergebnis noch nicht bestätigt",
- no quarter table,
- the Halle (the DBB has it),
- under „Kader": „Noch kein Spielbericht. Schau später noch einmal vorbei."

**Cause.** The men's professional leagues (BBL, ProA, ProB) keep their game statistics in their own systems; at the DBB they hold only the schedule, the result and the Halle. The DBB marks such a Liga with `statisticType: 0` in its `ligaData`, which every `matchInfo`, `boxscore`, Spielplan and Tabelle answer carries. Some local youth leagues are marked the same way (results only, no Spielbericht online). The women's leagues (DBBL, 2. DBBL) and the youth Bundesligen (NBBL, JBBL) are `statisticType: 1` and have Kader and quarters. The app has no rule for Bundesligen: it hides what is missing, as it should, but its text promises a Spielbericht that never comes.

The game's own `statisticType` is not the signal: every Spielplan sends `null` there, and a planned M14 game (`matchinfo-2843814.json`) has `0` there while its `ligaData` says `1`. The Liga search sends `statisticType: null` for every Liga.

## Goal

On the Spiel page of a Liga the DBB keeps no Spielberichte for, the Kader section says so plainly instead of telling the Elternteil to come back later.

## Non-goals

- Fetching Kader or statistics from the leagues' own systems (BBL, 2. Basketball-Bundesliga): out of ADR 0018's single source.
- The „vorläufig" mark on BBL, ProA and ProB results, which the DBB never confirms (see open questions).
- Skipping the Kind search's Spielbericht reads for such Ligen (`kaderSuchen`): they cost a few reads but show nothing wrong.

## Decisions

| Decision                                                                                                                                                                                           | Reason                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The lib's `Liga` gets `ohneSpielberichte?: true`, set by `mapLiga` where `ligaData.statisticType` is `0`; absent for `1`, `null` or a missing field                                                | The Liga, not the game, carries the reliable signal; optional like `bezirk`, so every other Liga and every existing fixture and spec stay as they are; an unknown value keeps today's behaviour. |
| `spielberichtTeil` (`spiel-seite/spielbericht-teil.ts`) shows for a missing Spielbericht of such a Liga: „Für diese Liga führt der DBB keine Spielberichte, Kader und Viertel gibt es hier nicht." | Says why and that waiting does not help; names both missing parts. A cancelled Spiel keeps its own text, which wins.                                                                             |
| Where the Spielbericht does arrive in such a Liga, the page shows it as usual                                                                                                                      | The flag explains a gap, it hides nothing.                                                                                                                                                       |
| No new fixture: the lib spec uses the recorded `matchinfo-2930311.json` (MFR U12 Kreisliga, `statisticType: 0`) and `matchinfo-2843814.json` (`1`)                                                 | Real DBB answers with invented names are already in the repo (ADR 0019); a BBL answer would add nothing but a recording run.                                                                     |

## Acceptance

1. `mapLiga` sets `ohneSpielberichte: true` for `statisticType: 0` and leaves it out for `1`, `null` and a missing field (lib spec, also through `mapSpielDetails` on the two fixtures).
2. The Spiel page shows the new text when the Spiel's Liga is `ohneSpielberichte` and the Spielbericht is missing (spec).
3. It still shows „Noch kein Spielbericht. Schau später noch einmal vorbei." for other Ligen, and the cancelled text for a cancelled Spiel in either (spec).
4. A Spielbericht that arrives in such a Liga is shown as usual (spec).
5. `deutsche-texte.spec.ts`, lint, format and the korbjaeger build pass.

## Open questions

- BBL, ProA and ProB results stay „vorläufig" with „Ergebnis noch nicht bestätigt" forever, since the DBB never sets `ergebnisbestaetigt` for them. Recommended as a follow-up: decide whether a Liga `ohneSpielberichte` drops the mark (its local youth leagues do confirm results, so the flag alone is not the rule).
