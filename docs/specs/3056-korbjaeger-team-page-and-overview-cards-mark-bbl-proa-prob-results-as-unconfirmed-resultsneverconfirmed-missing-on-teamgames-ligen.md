# Spec #3056: Korbjäger — Team page and overview cards mark BBL/ProA/ProB results as unconfirmed

Issue: [#3056](https://github.com/WolfSoko/wol-sok-mono/issues/3056). Follows
[#2953](https://github.com/WolfSoko/wol-sok-mono/issues/2953) (which added
`resultsNeverConfirmed`) and has the root cause of
[#3026](https://github.com/WolfSoko/wol-sok-mono/issues/3026)
([PR #3055](https://github.com/WolfSoko/wol-sok-mono/pull/3055)).

## Findings (2026-11-13)

- The DBB's Team Spiele (`team/id/{id}/matches`, `teamGames`), a Verein's
  Spiele (`club/id/{id}/actualmatches`) and the Liga search send
  `ligaData.statisticType: null` for every Liga. Live for FC Bayern München
  Basketball (Team 163073): its Ligen "1. Bundesliga (easyCredit BBL)",
  "BBL-Pokal 1/8-Finale" and "BBL-Pokal 1/4-Finale" all carry
  `verbandId` 100, `akName` "Senioren", `geschlecht` "männlich" and
  `statisticType` null; 9 Spiele played, 0 confirmed.
- `mapLeague` sets `resultsNeverConfirmed` only for `statisticType` 0, so no
  `TeamSeason` and no Verein's Spiele ever carry it, and `resultProvisional`
  marks every played BBL, ProA, ProB and BBL-Pokal Spiel on the Team page
  (`spiel/spiel-zeile.ts`), the overview's Team and Kind cards
  (`ueberblick/team-karte.ts` and the Kind's card through `spielZeile`) as
  „vorläufig". The Spiel page reads `matchInfo`, which carries
  `statisticType`, and is right.
- Every Liga the DBB lists for the Verband „Bundesligen" (`verbandId` 100,
  `wam/liga/list`, read 2026-11-13): its men's (`männlich`) Ligen of the age
  group "Senioren" are exactly 1. Bundesliga (easyCredit BBL), Herren ProA,
  Herren ProB Nord and Süd and the BBL-Pokal rounds, the Ligen #2953's survey
  found never confirmed (0 of 262, all `statisticType` 0). Its other men's
  Ligen are NBBL and JBBL (U19, U16), which confirm theirs; its women's
  Ligen (DBBL, DBBL-Pokal, WNBL) confirm theirs too.

## Goal

A result the DBB never confirms shows as final on every screen, whichever
endpoint its Liga came from: a played BBL, ProA, ProB or BBL-Pokal Spiel
shows no „vorläufig" on the Team page and the overview's cards, as on the
Spiel page.

## Non-goals

- `withoutGameReports` (whether the DBB keeps Spielberichte): the Team's
  Spiele still cannot tell it; #3026 asks the Spiel's details for it.
- The Kader search for Ligen without Spielberichte (#3038).
- Any extra DBB read: the fix needs none.

## Decisions

| Decision                                                                                                                                                                             | Reason                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mapLeague` decides `resultsNeverConfirmed` from `verbandId` 100, `geschlecht` „männlich" and `akName` „Senioren" alone, for every endpoint, no longer from `statisticType`          | These three fields come with every `ligaData`, the Team's and a Verein's Spiele and the Liga search included, while `statisticType` comes only from the Spiel's details, Spielplan and Tabelle. Inside Verband 100 the three fields pick exactly the Ligen `statisticType` 0 picked (findings above), so the Spiel page's answer stays as it is and every screen gives the same Liga the same flag. |
| Not: read a Spiel's details, the Liga's Spielplan or Tabelle on the Team page and the cards                                                                                          | One more read per Liga or per Spiel on two screens, its loading and failure states, for an answer the Liga's own fields already give.                                                                                                                                                                                                                                                               |
| The age group is compared with the DBB's text „Senioren" (a constant beside `BUNDESLIGA_ASSOCIATION`)                                                                                | `ageGroup` is the DBB's label, the one the screens show; the Liga search's id is not in `ligaData`.                                                                                                                                                                                                                                                                                                 |
| `withoutGameReports` keeps `statisticType` 0                                                                                                                                         | The non-goal above; no change.                                                                                                                                                                                                                                                                                                                                                                      |
| Specs read a recorded answer: a new fixture `team-163073-matches.json` (FC Bayern München Basketball's Spiele, BBL and BBL-Pokal), recorded with `record-fixtures.ts` and anonymised | The issue asks for recorded answers, not hand-made Ligen; #2953's specs set `statisticType` 0 by hand and so never saw the null. Team Spiele name no persons.                                                                                                                                                                                                                                       |
| `League.resultsNeverConfirmed`'s doc names the rule and that every endpoint sets it                                                                                                  | Its old doc said the Liga search leaves it out.                                                                                                                                                                                                                                                                                                                                                     |

## Acceptance

1. `mapTeamGames` on `team-163073-matches.json` gives every Liga
   `resultsNeverConfirmed: true` while `statisticType` is null; on
   `team-313036-matches.json` none (lib spec).
2. `mapLeague` (through its endpoints' mappers) sets it for Verband 100,
   „männlich", „Senioren" whatever `statisticType` says (0, 1, null), and
   leaves it out for a women's Liga of Verband 100 (DBBL-Pokal), a men's
   youth Liga of Verband 100 (NBBL, `U19`), and a men's Senioren Liga of
   another Verband with `statisticType` 0 (lib spec).
3. The Verein's Spiele and the Liga search carry it the same way (lib spec,
   at least one of them).
4. `spielZeile` on the recorded BBL Team's Saison marks no played Spiel
   `vorlaeufig`; on Team 313036's unconfirmed Spiel it still does (app spec).
5. The Spiel page's specs of #2953 stay green.
6. Lint, format, `deutsche-texte.spec.ts`, the lib's and the app's tests and
   the korbjaeger build pass.
7. After the deploy: korb.wolsok.de's Team page of Team 163073 shows its
   played BBL Spiele without „vorläufig".

## Open questions

None. Should the DBB add a men's Senioren Liga to Verband 100 that it does
confirm, the flag would hide „vorläufig" there; the age-group survey above
lists none.
