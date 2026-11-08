# DBB fixtures

Responses of the DBB's JSON API (`https://www.basketball-bund.net/rest`),
recorded on 2026-11-08 by `tools/korbjaeger/record-fixtures.ts` (the list is
`tools/korbjaeger/fixture-requests.ts`) and anonymised by
`tools/korbjaeger/anonymise-fixtures.ts`:

```sh
NODE_USE_ENV_PROXY=1 npx tsx tools/korbjaeger/record-fixtures.ts <raw-dir>
npx tsx tools/korbjaeger/anonymise-fixtures.ts <raw-dir>
```

The raw responses name real children; `<raw-dir>` must lie outside the
workspace and is never committed. Every person name and id (players,
referees, `playerId`) here is invented, deterministically per seed;
Teams, Vereine, Ligen, Spiele and Hallen keep their real ids and names.
`src/testing/committed-fixtures.spec.ts` fails on any name that is not
invented. Long lists are cut where `fixture-requests.ts` says (`trims`).

| File                                                                     | Case                                                                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `wam-data-bayern-u14.json`                                               | Liga search: facets and first page (Bayern, U14)                                                                       |
| `wam-liga-list-bayern-u14-10.json`                                       | Liga list, a page after the first (`startAtIndex=10`)                                                                  |
| `wam-liga-list-schleswig-holstein-jugend-30.json`                        | Liga list, the last page (`hasMoreData: false`)                                                                        |
| `spielplan-54308.json`                                                   | Bavarian youth Liga: played and planned Spiele                                                                         |
| `spielplan-54379.json`                                                   | Schleswig-Holstein youth Vorrunde: Spiele a Team gave up (`verzicht`)                                                  |
| `spielplan-54857.json`                                                   | Hauptrunde before its Vorrunden ended: slots without a Team ("Nord 1. Platz")                                          |
| `table-54308.json`                                                       | Tabelle                                                                                                                |
| `team-313036-matches.json`                                               | A Team in two Ligen (a friendly Liga, then its Vorrunde)                                                               |
| `club-1476-actualmatches.json`                                           | A Verein's Spiele: two of its Teams against each other (listed twice), a Team in two Ligen                             |
| `matchinfo-2911141.json`                                                 | Played Spiel: result, quarters, Halle, referees                                                                        |
| `matchinfo-2843814.json`                                                 | Planned Spiel; referees hidden by the DBB                                                                              |
| `matchinfo-2930311.json`                                                 | Cancelled Spiel (`abgesagt`)                                                                                           |
| `matchinfo-2930414.json`                                                 | Forfeited Spiel (`verzicht` of the guest Team)                                                                         |
| `boxscore-2911141.json`                                                  | Bavarian Spielbericht with Spielerwerte and Anonyme Spieler                                                            |
| `boxscore-2843811.json`                                                  | Schleswig-Holstein Spielbericht: Kader only, every number 0                                                            |
| `boxscore-2843814.json`                                                  | No Spielbericht yet (empty Kader)                                                                                      |
| `table-not-found.json`, `team-not-found.json`, `boxscore-not-found.json` | Envelope `status: "1"`                                                                                                 |
| `envelope-unavailable.json`                                              | Envelope `status: "-1"`: **constructed** from `table-not-found.json` (status and message changed), since none occurred |

How the DBB marks things, as seen in these responses:

- An Anonymer Spieler: `anonym: true`, `playerId: 0`, `person.id: 0`, name
  `***` / `****`, shirt number `**`. The DBB hides referees the same way.
- A forfeit: `verzicht: true` on the Spiel and on the Team that gave up.
- A cancellation: `abgesagt: true`.
- A slot of a Hauptrunde: a Team with a `seasonTeamId` but without
  `teamPermanentId` or `clubId` (both `null`), named after the place it
  waits for.
- No Spielbericht yet: `matchBoxscore` with empty player lists.
- A moved Spiel: no flag; the DBB just carries the new date.
- Quarter scores (`heimV1stand`, `heimHalbzeitstand`, `heimV3stand`,
  `heimV4stand`) are each quarter's points, not running totals:
  `heimHalbzeitstand` is the second quarter's.
- A non-numeric id (`match/id/abc/boxscore`) gets HTTP 400 with an empty
  body, not an envelope.
