# Plan #2967: Korbjäger: rename the German identifiers in code to English

Spec: [docs/specs/2967-korbjaeger-rename-the-german-identifiers-in-code-to-english.md](../specs/2967-korbjaeger-rename-the-german-identifiers-in-code-to-english.md)

Part A (`feat-shared-basketball-data`) is built in this PR; parts B, C and D
get the same steps in their own sub-issues and PRs, each with its map added
to this plan.

## Steps of every part

1. **Map.** List the names the part declares (the script's `list` mode:
   every declaration, string literal type and file name in the project's
   non-generated sources) and write the map below: each German name with
   its English one, by the spec's vocabulary.
2. **Rename.** Run the script's `apply` mode on the workspace: it loads every
   tsconfig that includes a file importing the part's project, renames each
   mapped declaration (with every reference, shorthand properties expanded
   where a local keeps its name), each mapped string literal in the unions
   and their uses, and moves each mapped file (imports follow). It reports
   clashes and leaves them.
3. **Fix by hand** what the compiler cannot see: test titles and comments
   that quote a renamed identifier, `CLAUDE.md`, string keys built at run
   time. `git grep` each old exported name to find what is left. Part A
   found these gaps of the language service, each needing its own pass:
   - **Literal members** of a union are found only where the literal is
     contextually typed by the union: `switch` cases and comparisons are
     fixed from the compiler's errors after the rename (a loop over
     `tsc --noEmit` that replaces the quoted old literal at each error).
   - **String keys**: `Pick<T, 'old'>`, `keyof` arguments, `Record` keys and
     `optionalField('old', …)` are plain strings; the first three the
     compiler flags, `optionalField` it does not (the spread of
     `{ old?: … }` into a mapped object compiles and silently drops the
     field), so every call of it is checked by hand.
   - **Untyped object literals**: fixtures cast `as unknown as T`, `as
     const` constants passed on later and spreads such as
     `{ ...NO_LEAGUE_FILTER, verbandIds: [7] }` keep their old keys without
     an error (one in production code, `crawl-clubs.ts`, caught only by its
     spec). A scan lists every object literal whose old key its contextual
     type lacks, or which has none, and every old literal outside a literal
     context; each hit is reviewed (raw DBB JSON and the app's own German
     types stay).
   - **Expectations** (`toEqual`, `toHaveBeenCalledWith`, …) are untyped:
     their keys and literals are renamed inside matcher arguments only, and
     the run of the tests shows what is left.
   - **Templates**: `ngc -p apps/korbjaeger/tsconfig.app.json --noEmit`
     checks them (after `npm ci`: with a missing module it stops before the
     templates and reports nothing).
   - **Literals the UI shows**: a literal printed into the page (the
     Spiel's `markierung` chip) or used as a CSS class (`ausgang`) changes
     the UI with the rename; it gets a German label map, the class its
     English name.
   - **Default import names** of fixtures (`import gespielt from …json`)
     and **comment references** in backticks are renamed in a pass of
     their own; outside the part's project only exported names, since a
     consumer's own parameters keep their names until their part.
4. **Check.** `npx nx format:write`, then
   `npx nx affected --base=origin/main -t lint,lint-templates,test,typecheck-specs,build`,
   the affected `test-emulator` targets, and the script's `list` mode once
   more, reviewed for German names left.
5. **Rebase before the merge request**: fetch main, restart the branch's
   code commits from it and rerun the map over what merged meanwhile; the
   PR names the parallel work that was already on main.
6. **Commit** as `refactor(<project>): rename the German identifiers to
   English (#2967)`; the PR squashes into one commit on main.

The scripts part A used (`rename.cjs`, `fixlit.cjs`, `keys-ast.cjs`,
`scan.cjs`, all `ts-morph`) are attached to
[#3010](https://github.com/WolfSoko/wol-sok-mono/issues/3010) as a comment,
so the next parts start from them; they stay out of the repo.

## Part A: `feat-shared-basketball-data`

### Task A1: spec, plan and sub-issues

- Files: this plan, the spec.
- Sub-issues B, C, D under #2967 (REST `sub_issues`), each blocked by the
  one before, B by #2967's part A PR.
- Commit: `docs(korbjaeger): spec and plan for the English identifiers (#2967)`.

### Task A2: rename by the map

Types and their fields:

| Old                                                                                                                      | New                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `Spiel` (`ligaId`, `spieltag`, `datum`, `uhrzeit`, `heim`, `gast`)                                                       | `Game` (`leagueId`, `matchday`, `date`, `time`, `home`, `away`)                                                              |
| `SpielSeite` (`'heim'`, `'gast'`)                                                                                        | `GameSide` (`'home'`, `'away'`)                                                                                              |
| `Spielstand` (`heim`, `gast`)                                                                                            | `Score` (`home`, `away`)                                                                                                     |
| `SpielStatus` (`art`: `geplant`, `gespielt`, `abgesagt`, `kampflos`; `ergebnis`, `bestaetigt`, `verzichtet`)             | `GameStatus` (`kind`: `scheduled`, `played`, `cancelled`, `forfeited`; `result`, `confirmed`, `forfeitedBy`)                 |
| `SpielDetails` (`spiel`, `liga`, `halle`, `viertel`, `verlaengerungen`)                                                  | `GameDetails` (`game`, `league`, `venue`, `quarters`, `overtimes`)                                                           |
| `SpielSonderfall`                                                                                                        | `GameIrregularity`                                                                                                           |
| `SpielAusgang` (`'sieg'`, `'niederlage'`)                                                                                | `GameOutcome` (`'win'`, `'loss'`)                                                                                            |
| `SpielPartei` (`art`: `team`, `offen`; `bezeichnung`)                                                                    | `Participant` (`kind`: `team`, `open`; `label`)                                                                              |
| `Spielbericht` (`spielId`, `heim`, `gast`)                                                                               | `GameReport` (`gameId`, `home`, `away`)                                                                                      |
| `Kader` (`spielerwerteErfasst`, `eintraege`)                                                                             | `Roster` (`playerStatsRecorded`, `entries`)                                                                                  |
| `KaderEintrag`                                                                                                           | `RosterEntry`                                                                                                                |
| `BenannterSpieler` (`art: 'benannt'`, `vorname`, `nachname`, `trikotnummer`, `spielerwerte`)                             | `NamedPlayer` (`kind: 'named'`, `firstName`, `lastName`, `shirtNumber`, `playerStats`)                                       |
| `AnonymerSpieler` (`art: 'anonym'`)                                                                                      | `AnonymousPlayer` (`kind: 'anonymous'`)                                                                                      |
| `Spielerwerte` (`punkte`, `zweier`, `dreier`, `freiwuerfe.getroffen`, `.versucht`, `fouls`)                              | `PlayerStats` (`points`, `twoPointers`, `threePointers`, `freeThrows.made`, `.attempted`, `fouls`)                           |
| `Liga` (`verband`, `altersklasse`, `geschlecht`, `spielklasse`, `bezirk`, `saison`, `ohneSpielberichte`)                 | `League` (`association`, `ageGroup`, `gender`, `division`, `district`, `season`, `withoutGameReports`)                       |
| `Geschlecht` (`'männlich'`, `'weiblich'`, `'mix'`)                                                                       | `Gender` (`'male'`, `'female'`, `'mixed'`)                                                                                   |
| `Saison`, `Verein`, `Verband`, `Halle` (`strasse`, `plz`, `ort`)                                                         | `Season`, `Club`, `Association`, `Venue` (`street`, `postcode`, `town`)                                                      |
| `Tabelle` (`liga`, `zeilen`)                                                                                             | `Standings` (`league`, `rows`)                                                                                               |
| `TabellenZeile` (`rang`, `partei`, `spiele`, `siege`, `niederlagen`, `punkte`, `koerbe`, `gegenkoerbe`, `korbdifferenz`) | `StandingsRow` (`rank`, `participant`, `games`, `wins`, `losses`, `points`, `pointsFor`, `pointsAgainst`, `pointDifference`) |
| `TeamSaison` (`verein`, `ligen`, `spiele`)                                                                               | `TeamSeason` (`club`, `leagues`, `games`)                                                                                    |
| `VereinsTeam`, `VereinsTeams` (`verein`)                                                                                 | `ClubTeam`, `ClubTeams` (`club`)                                                                                             |
| `TeamUeberblick` (`naechstes`, `ausfaelle`, `letztes`)                                                                   | `TeamOverview` (`next`, `cancellations`, `last`)                                                                             |
| `GemeinsamerUeberblick` (`… spaetereAusfaelle`)                                                                          | `CombinedOverview` (`… laterCancellations`)                                                                                  |
| `SaisonSpiel`, `SaisonMitUeberblick` (`saison`, `spiel`, `ueberblick`)                                                   | `SeasonGame`, `SeasonWithOverview` (`season`, `game`, `overview`)                                                            |
| `KaderSucheAuftrag` (`spiele`, `kinder`)                                                                                 | `RosterSearchJob` (`games`, `children`)                                                                                      |
| `KaderFunde` (`spiele`, `unvollstaendig`)                                                                                | `RosterFinds` (`games`, `incomplete`)                                                                                        |
| `KinderImKader`                                                                                                          | `ChildrenInRoster`                                                                                                           |
| `LigaSuche` (`facetten`, `ersteSeite`), `LigaSeite` (`ligen`, `weitere`)                                                 | `LeagueSearch` (`facets`, `firstPage`), `LeaguePage` (`leagues`, `more`)                                                     |
| `LigaSucheFilter` (`verbandIds`, `altersklasseIds`, `altersgruppeGeschlechtIds`)                                         | `LeagueSearchFilter` (`associationIds`, `ageGroupIds`, `ageGroupGenderIds`)                                                  |
| `LigaSucheFacetten` (`verbaende`, `altersklassen`, `altersgruppenGeschlechter`), `Facette` (`treffer`)                   | `LeagueSearchFacets` (`associations`, `ageGroups`, `ageGroupGenders`), `Facet` (`hits`)                                      |
| ids `VerbandId`, `LigaId`, `SaisonId`, `VereinId`, `SpielId`, `AltersklasseId`, `AltersgruppeGeschlechtId`               | `AssociationId`, `LeagueId`, `SeasonId`, `ClubId`, `GameId`, `AgeGroupId`, `AgeGroupGenderId`                                |
| `DbbLigaFilterBody`                                                                                                      | `DbbLeagueFilterBody`                                                                                                        |
| `SpielberichtLesen`                                                                                                      | `GameReportReader`                                                                                                           |

Functions and constants:

| Old                                                                                                                                  | New                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `BasketballData`: `ligaSuche`, `ligaSeite`, `ligaTeams`, `vereinsTeams`, `teamSpiele`, `tabelle`, `spiel`, `spielbericht`            | `leagueSearch`, `leaguePage`, `leagueTeams`, `clubTeams`, `teamGames`, `standings`, `game`, `gameReport`             |
| `DbbRequest` kinds `liga-suche`, `liga-seite`, `tabelle`, `spielplan`, `team-spiele`, `vereins-spiele`, `spiel-info`, `spielbericht` | `league-search`, `league-page`, `standings`, `schedule`, `team-games`, `club-games`, `game-info`, `game-report`      |
| `ausgangVon`, `datumInDeutschland`, `ergebnisVon`, `ergebnisVorlaeufig`, `gegnerVon`, `seiteVon`, `sonderfallVon`, `andereSeite`     | `outcomeOf`, `dateInGermany`, `resultOf`, `resultProvisional`, `opponentOf`, `sideOf`, `irregularityOf`, `otherSide` |
| `istTeam`, `parteiName`                                                                                                              | `isTeam`, `participantName`                                                                                          |
| `halleAdresse`, `halleNavigationUrl`                                                                                                 | `venueAddress`, `venueNavigationUrl`                                                                                 |
| `feldkoerbe`, `istBenannt`, `spielerwerteErfasst`                                                                                    | `fieldGoals`, `isNamed`, `playerStatsRecorded`                                                                       |
| `kaderDesTeams`, `kinderImKader`, `kaderSuchen`                                                                                      | `rosterOfTeam`, `childrenInRoster`, `searchRosters`                                                                  |
| `ligaVon`, `ligenAktuellZuerst`, `naechstesSpiel`, `saisonBeendet`, `zuletztGespielt`                                                | `leagueOf`, `leaguesCurrentFirst`, `nextGame`, `seasonOver`, `lastPlayed`                                            |
| `gemeinsamerUeberblick`, `nachNaechstemSpiel`, `teamUeberblick`                                                                      | `combinedOverview`, `byNextGame`, `teamOverview`                                                                     |
| `KEIN_LIGA_FILTER`, `angeboten`, `naechsterStartIndex`                                                                               | `NO_LEAGUE_FILTER`, `offered`, `nextStartIndex`                                                                      |
| `VEREINS_SPIELE_TAGE`, `MAX_VEREINS_SPIELE_TAGE`, `SAISON_ENDE_NACH_TAGEN`                                                           | `CLUB_GAMES_DAYS`, `MAX_CLUB_GAMES_DAYS`, `SEASON_OVER_AFTER_DAYS`                                                   |
| `dbbOhnePersonen`                                                                                                                    | `dbbWithoutPersons`                                                                                                  |
| `ZUGLEICH`                                                                                                                           | `AT_ONCE`                                                                                                            |

Files: `domain/spiel.ts` → `game.ts`, `spielbericht.ts` → `game-report.ts`,
`liga.ts` → `league.ts`, `liga-suche.ts` → `league-search.ts`, `halle.ts` →
`venue.ts`, `partei.ts` → `participant.ts`, `saison.ts` → `season.ts`,
`team-saison.ts` → `team-season.ts`, `team-ueberblick.ts` →
`team-overview.ts`, `tabelle.ts` → `standings.ts`, `verband.ts` →
`association.ts`, `verein.ts` → `club.ts`, `geschlecht.ts` → `gender.ts`,
`kader-suche.ts` → `roster-search.ts`, `kinder-im-kader.ts` →
`children-in-roster.ts`; `dbb/map-spiel.ts` → `map-game.ts`,
`map-spiel-details.ts` → `map-game-details.ts`, `map-spielbericht.ts` →
`map-game-report.ts`, `map-liga.ts` → `map-league.ts`, `map-liga-suche.ts` →
`map-league-search.ts`, `map-liga-teams.ts` → `map-league-teams.ts`,
`map-tabelle.ts` → `map-standings.ts`, `map-team-spiele.ts` →
`map-team-games.ts`, `map-verein.ts` → `map-club.ts`, `map-vereins-teams.ts` →
`map-club-teams.ts`, `spiele.ts` → `games.ts`, `ohne-personen.ts` →
`without-persons.ts`; specs with their file.

The answer cache (`feat-korbjaeger-antworten`'s `LokaleLetzteAntworten`)
keeps storing the old kind strings: `STORED_KINDS` (a
`Record<DbbRequestKind, string>` beside the store) maps each English kind to
the string it stores as `art`, written by `merken` and compared by the
upkeep, with a spec that an entry stored before the rename (`art:
'team-spiele'`) is still served and kept.

The Spiel line (`SpielZeileComponent`) showed the `SpielSonderfall` literal
as its chip's text; it now shows `markierungText` (`cancelled` →
"abgesagt", `forfeited` → "kampflos"), and the outcome's CSS classes follow
the literals (`.win`, `.loss`).

The fixtures' default imports follow the vocabulary too (`gespielt` →
`played`, `nurKaderBestaetigt` → `rosterOnlyConfirmed`, …); the fixture
JSON files keep their names: the recordings are named after the DBB's
requests and filters (`spielplan-54862.json`,
`wam-data-niedersachsen-u12-jugend-maennlich.json`), and
`tools/korbjaeger/fixture-requests.ts` records them under those names.

Parameters, locals and private helpers follow the vocabulary (`spiel` →
`game`, `heute` → `today`, `bericht` → `report`, …). Consumers' references
change with the lib; their own names wait for their part.

- Tests: every spec of the lib and its consumers, unchanged in substance.
- Commit: `refactor(feat-shared-basketball-data): rename the German identifiers to English (#2967)`.

### Task A3: hand fixes and docs

- Files: test titles and comments quoting old names, `CLAUDE.md`'s
  Korbjäger section (lib names: `teamUeberblick`, `kaderSuchen`,
  `dbbOhnePersonen`, `ausgangVon`, `saisonBeendet`, `VEREINS_SPIELE_TAGE`, …).
- Tests: the check step.
- Commit: `refactor(feat-shared-basketball-data): name the renamed identifiers in comments and CLAUDE.md (#2967)`.
