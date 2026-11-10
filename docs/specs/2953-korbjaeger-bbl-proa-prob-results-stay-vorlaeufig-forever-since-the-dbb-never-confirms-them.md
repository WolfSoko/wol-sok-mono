# Spec: Korbjäger — BBL/ProA/ProB results stay „vorläufig" forever, since the DBB never confirms them

Issue: [#2953](https://github.com/WolfSoko/wol-sok-mono/issues/2953). Part of [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861); follows [#2948](https://github.com/WolfSoko/wol-sok-mono/issues/2948) (PR [#2952](https://github.com/WolfSoko/wol-sok-mono/pull/2952)) and changes the mark of [#2923](https://github.com/WolfSoko/wol-sok-mono/issues/2923).

## Findings (2026-11-09)

Every Liga's Spielplan was read from the live DBB (`competition/spielplan/id/{ligaId}`) for the Verband „Bundesligen" (`verbandId` 100) and for the four Regionalligen, „Deutsche Meisterschaften" and „Deutscher Rollstuhlbasketball" (152 Ligen). Counted were the played Spiele (a result, not cancelled, not forfeited) and how many of them carry `ergebnisbestaetigt: true`; outside Verband 100 only Spiele at least two weeks old, which the Verband had time to confirm. The raw answers stayed in the scratchpad.

| Liga (Verband, `ligaData.statisticType`)                                                                            | Played  | Confirmed |
| ------------------------------------------------------------------------------------------------------------------- | ------- | --------- |
| 1. Bundesliga (easyCredit BBL) (100, 0)                                                                             | 69      | 0         |
| Herren ProA (100, 0)                                                                                                | 72      | 0         |
| Herren ProB Nord / Süd (100, 0)                                                                                     | 49 / 56 | 0 / 0     |
| BBL-Pokal 1. Runde, 1/8-Finale (100, 0)                                                                             | 8 / 8   | 0 / 0     |
| 1. Bundesliga (Toyota DBBL), 2. DBBL Nord / Süd (100, 1)                                                            | 101     | 98        |
| NBBL, JBBL, WNBL, their Cups and Ligapokal (100, 1)                                                                 | 138     | 85        |
| DBBL-Pokal Runde 1, 2 (100, 1); later rounds (100, 0) not played yet                                                | 14      | 14        |
| BL-Vorbereitungsspiele 2026 („Deutsche Meisterschaften", 29, 0)                                                     | 6       | 0         |
| 103 Ligen of `statisticType` 0 in the Regionalligen, „Deutsche Meisterschaften" and „Deutscher Rollstuhlbasketball" | 128     | 119       |
| Local Ligen of `statisticType` 0 in the Landesverbände (Regionsliga Braunschweig mu12, #2948)                       | 3       | 3         |
| Länderspiele 2026/27 („Deutsche Meisterschaften", 29, 1)                                                            | 6       | 0         |

So within the Verband „Bundesligen" a men's Liga of `statisticType` 0 is exactly one of the men's professional competitions (BBL, ProA, ProB, BBL-Pokal; all `geschlecht: männlich`), whose results come from the leagues' own systems and are never confirmed at the DBB. Elsewhere `statisticType` 0 only means „no Spielberichte": those Ligen confirm their results.

## Goal

A result the DBB never confirms is not shown as „vorläufig": on the Team page, the overview cards and the Spiel page, a played Spiel of the BBL, ProA, ProB or BBL-Pokal shows its score as final, without „vorläufig" and without „Ergebnis noch nicht bestätigt".

## Non-goals

- Changing the mark anywhere else. Unconfirmed results of the youth Bundesligen (WNBL: 14 of 59 confirmed) or of local Ligen stay „vorläufig": the Verband does confirm them, only late.
- Preseason games and Länderspiele filed under „Deutsche Meisterschaften" (six each, none confirmed, one of them `statisticType` 1): a Verband whose other Ligen confirm. They keep the mark.
- The proxy's cache time of a boxscore (`dbbBoxscoreFinished`): such a Liga has no Kader either, so it stays at 300 s as now.
- Fetching results or their state from the leagues' own systems: outside ADR 0018's single source.

## Decisions

| Decision                                                                                                                                  | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The rule is `ligaData.statisticType` 0 **and** `verbandId` 100 („Bundesligen") **and** `geschlecht` „männlich"                            | The survey above: inside that Verband the flag separates BBL/ProA/ProB/BBL-Pokal (0 of 262 confirmed) from DBBL, NBBL, JBBL and WNBL (1, confirmed); outside it the flag says nothing about confirmation (#2948). The later DBBL-Pokal rounds (Top4, Runde 3, 1/8- and 1/4-Finale) are `statisticType` 0 in Verband 100 too, but women's (`weiblich`), and their first rounds (`statisticType` 1) confirmed 14 of 14: the `geschlecht` keeps them out. A rule over the Liga's own Spiele („none confirmed so far") would need a Liga's whole Spielplan on every screen and would flip at its first confirmation. |
| The adapter decides it: `mapLiga` sets a new optional `resultsNeverConfirmed: true` on the lib's `Liga`, beside `ohneSpielberichte`       | The Verband's id and `statisticType` are DBB details; the domain gets their meaning, as `ohneSpielberichte` did. Optional, absent where the DBB does not say (the Liga search sends `statisticType: null`), so every other Liga, fixture and spec stays as it is. English name, as Coding Rule 10 asks of a name a change introduces.                                                                                                                                                                                                                                                                            |
| `ergebnisVorlaeufig(spiel, liga)` takes the Spiel's Liga (`Liga \| undefined`, required) and is false where `liga?.resultsNeverConfirmed` | The question stays the lib's one helper, every screen asks it; the parameter is required so no caller forgets it. `undefined` (a Liga the Team's Saison does not list) keeps today's answer.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| The mark is dropped there, not worded differently                                                                                         | „vorläufig" says a correction may still come from the Verband; for these Ligen the result the DBB shows is the league's official one and nothing ever confirms it. A different word („ohne Bestätigung") would add noise to every BBL line for a fact the Elternteil cannot act on.                                                                                                                                                                                                                                                                                                                              |
| Sieg/Niederlage (`ausgangVon`) stay as they are                                                                                           | They never depended on the confirmation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| A unit spec builds such a Liga from the recorded `matchinfo-2930311.json` with `verbandId` 100 and `geschlecht` „männlich"                | No new recording: real answers with invented names are already in the repo (ADR 0019), and a BBL answer differs only in these two fields.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Acceptance

1. `mapLiga` (through `mapSpielDetails` and `mapTeamSpiele`) sets `resultsNeverConfirmed: true` for `statisticType` 0 with `verbandId` 100 and `geschlecht` „männlich", and leaves it out for `statisticType` 0 of another Verband, for a women's Liga of Verband 100 (DBBL-Pokal Top4), for `statisticType` 1 of Verband 100, and for `null` or a missing `statisticType` (lib spec).
2. `ergebnisVorlaeufig` is false for a played, unconfirmed Spiel of a Liga `resultsNeverConfirmed`, and as before for every other case, `undefined` Liga included (lib spec).
3. The Spiel line (Team page, overview cards) shows no „vorläufig" for such a Spiel and still shows it for an unconfirmed Spiel of another Liga (spec).
4. The Spiel page shows neither „vorläufig" nor „Ergebnis noch nicht bestätigt" for such a Spiel, and both for an unconfirmed Spiel of another Liga (spec).
5. `deutsche-texte.spec.ts`, lint, format, the lib's and the app's tests and the korbjaeger build pass.

## Open questions

- None for this issue. If the DBB ever starts confirming BBL results, the flag only stops a mark that is then right to stop anyway.
