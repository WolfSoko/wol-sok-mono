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

## Part B: `feat-korbjaeger-auswahl` and `feat-korbjaeger-antworten`

Issue [#3010](https://github.com/WolfSoko/wol-sok-mono/issues/3010), spec
[docs/specs/3010-…](../specs/3010-korbjaeger-english-identifiers-part-b-the-auswahl-and-antworten-libs.md).

### Task B1: spec and plan

- Files: the spec of #3010, this section.
- Commit: `docs(feat-korbjaeger-auswahl): spec and plan for part B of the English identifiers (#3010)`.

### Task B2: rename the Auswahl lib by the map

Types, their members and literals:

| Old                                                                                                                                                                                        | New                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Auswahl` (`nichtLesbar`, `quelle`, `folgen`, `entfolgen`, `kinder`, `markieren`, `spitznameSetzen`, `entmarkieren`, `vereinsfarben`, `vereinsfarbenSetzen`, `vereinsfarbenZuruecksetzen`) | `Selection` (`unreadable`, `source`, `follow`, `unfollow`, `children`, `mark`, `setNickname`, `unmark`, `clubColors`, `setClubColors`, `resetClubColors`)     |
| `LokaleAuswahl` (`neuGelesen`, `abgeben`, `beenden`; private `inhalt`, `offen`, `speicher`, `fenster`, `platzSchaffen`, …)                                                                 | `LocalSelection` (`reread`, `handOver`, `stop`; `content`, `pending`, `storage`, `events`, `makeRoom`, …)                                                     |
| `FirestoreAuswahl` (`geladen`, `beenden`), `FirestoreAuswahlOptionen` (`beiFehler`)                                                                                                        | `FirestoreSelection` (`loaded`, `stop`), `FirestoreSelectionOptions` (`onError`)                                                                              |
| `AuswahlListe` (`teams`, `kinder`, `vereinsfarben`), `AuswahlInhalt`, `LEERE_AUSWAHL`, `AUSWAHL_GRENZEN`, `AUSWAHL_LISTEN`                                                                 | `SelectionList` (`teams`, `children`, `clubColors`), `SelectionContent`, `EMPTY_SELECTION`, `SELECTION_LIMITS`, `SELECTION_LISTS`                             |
| `AuswahlDokument`, `AUSWAHL_VERSION`, `AuswahlFelder`, `GelesenesDokument` (`art`: `aktuell`, `neuer`, `keins`; `roh`, `hoechsterSeit`), `TeamPlatz` (`seit`)                              | `SelectionDocument`, `SELECTION_VERSION`, `SelectionFields`, `ReadDocument` (`kind`: `current`, `newer`, `none`; `raw`, `latestSince`), `TeamPlace` (`since`) |
| `AuswahlAenderung`, `Zusammenfuehrung` (`inhalt`, `uebrig`), `NichtUebernommen`                                                                                                            | `SelectionChange`, `SelectionMerge` (`content`, `left`), `NotTakenOver`                                                                                       |
| `AuswahlVollError` (`liste`), `AuswahlZuNeuError`, `KeineFarbeError` (`wert`)                                                                                                              | `SelectionFullError` (`list`), `SelectionTooNewError`, `NotAColorError` (`value`)                                                                             |
| `Kind` (`spitzname`), `MarkierbarerSpieler`, `KindEintrag`, `KindFeld`, `TeamFeld`                                                                                                         | `Child` (`nickname`), `MarkablePlayer`, `ChildEntry`, `ChildField`, `TeamField`                                                                               |
| `Vereinsfarben` (`primaer`, `zweite`), `VereinsfarbenWahl` (`vereinId`), `VereinsfarbenFeld`                                                                                               | `ClubColors` (`primary`, `secondary`), `ClubColorsChoice` (`clubId`), `ClubColorsField`                                                                       |
| `RohesDokument`, `ENTFERNT`, `GeraeteSpeicher`, `Fenster`                                                                                                                                  | `RawDocument`, `REMOVED`, `DeviceStorage`, `WindowEvents`                                                                                                     |
| testing: `AuswahlSpeicher` (`oeffnen`, `schreibeRoh`, `liesRoh`, `bisStabil`), `auswahlVertrag`, `fakeAuswahl`                                                                             | `SelectionStore` (`open`, `writeRaw`, `readRaw`, `untilSettled`), `selectionContract`, `fakeSelection`                                                        |

Functions and constants:

| Old                                                                                                                                                                                                                              | New                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auswahlDokumentLesen`, `auswahlDokumentMit`, `auswahlDokumentVon`, `auswahlFelder`, `firestoreFelder`, `naechsterSeit`, `inhaltAus`                                                                                             | `readSelectionDocument`, `selectionDocumentWith`, `selectionDocumentOf`, `selectionFields`, `firestoreFields`, `nextSince`, `contentOf`                                     |
| `folgenAenderung`, `entfolgenAenderung`, `markierenAenderung`, `entmarkierenAenderung`, `spitznameAenderung`, `vereinsfarbenAenderung`, `vereinsfarbenZuruecksetzenAenderung`, `abgebenAenderung`, `teamPlatz`, `grenzenPruefen` | `followChange`, `unfollowChange`, `markChange`, `unmarkChange`, `nicknameChange`, `clubColorsChange`, `resetClubColorsChange`, `handOverChange`, `teamPlace`, `checkLimits` |
| `geraetUebernehmen`, `zusammenfuehren`, `gleicheFolge`                                                                                                                                                                           | `takeOverDevice`, `mergeSelections`, `sameSequence`                                                                                                                         |
| `AUSWAHL_SCHLUESSEL`, `SPITZNAME_LAENGE`, `SPITZNAME_CODEPUNKTE`, `spitznameZeichen`, `spitznameAus`, `codepunkteVon`, `kindMit`                                                                                                 | `SELECTION_KEY`, `NICKNAME_LENGTH`, `NICKNAME_CODE_POINTS`, `nicknameCharacterCount`, `nicknameOf`, `codePointsOf`, `childWith`                                             |
| `vereinsfarbenAus`, `vereinsfarbenVon`, `gleicheFarben`, `istFarbe`, `farbenText`, `farbenAusText`, `nachVerein`                                                                                                                 | `clubColorsOf`, `clubColorsFor`, `sameColors`, `isColor`, `colorsText`, `colorsFromText`, `byClub`                                                                          |
| `vorSeit` (`seit`, `sortierung`), `eintraegeMit`, `idAus`, `istId`, `istZahl`, `istKarte`, `istKindEintrag`                                                                                                                      | `compareBySince` (`since`, `tieBreak`), `entriesWith`, `idOfKey`, `isId`, `isNumber`, `isMap`, `isChildEntry`                                                               |

Files (`src/lib/` unless named): `auswahl.ts` → `selection.ts`,
`auswahl-aenderungen.ts` → `selection-changes.ts`, `auswahl-dokument.ts` →
`selection-document.ts`, `auswahl-fehler.ts` → `selection-errors.ts`,
`firestore-auswahl.ts` → `firestore-selection.ts`, `geraet-uebernehmen.ts` →
`take-over-device.ts`, `gleiche-folge.ts` → `same-sequence.ts`, `kind.ts` →
`child.ts`, `lokale-auswahl.ts` → `local-selection.ts`, `vereinsfarben.ts` →
`club-colors.ts`, `vereinsfarben-wahl.ts` → `club-colors-choice.ts`,
`zusammenfuehren.ts` → `merge-selections.ts`; `src/testing/auswahl-vertrag.ts`
→ `selection-contract.ts`, `fake-auswahl.ts` → `fake-selection.ts`; specs with
their file. The legacy files (`legacy-*.ts`, removed by #2983) keep their
names and the locals that hold the stored German fields; only their
references change.

Parameters, locals and private helpers follow the vocabulary (`gelesen` →
`read`, `inhalt` → `content`, `vorher`/`nachher` → `before`/`after`,
`geraet` → `device`, `uebrig` → `leftOver`, `_alt` → `_previous`, …); the
contract's fixtures too (`VEREIN_BLAU` → `CLUB_BLUE`, `IRGENDWANN` →
`SOMETIME`); invented names (`LUMI`, `MIA`) and Vereine (`MTV_GIFHORN`) stay.

- Tests: every spec of the lib and of the app, unchanged in substance.
- Commit: `refactor(feat-korbjaeger-auswahl): rename the German identifiers to English (#2967)`.

### Task B3: rename the Antworten lib by the map

| Old                                                                                                                                                   | New                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `LetzteAntworten` (`lesen`, `merken`), `LetzteAntwort` (`antwort`, `gespeichertAm`)                                                                   | `AnswerCache` (`read`, `store`), `CachedAnswer` (`answer`, `storedAt`)                                                                    |
| `LokaleLetzteAntworten` (`leeren`, `aufraeumen`; private `grenzen`, `bekannt`, `speicher`, …)                                                         | `LocalAnswerCache` (`clear`, `cleanUp`; `limits`, `known`, `storage`, …)                                                                  |
| `AntwortSpeicher`, `AntwortGrenzen` (`eintraege`, `zeichen`), `ANTWORT_GRENZEN`, `ANTWORT_PRAEFIX`, `ANTWORT_INDEX`, `MAX_ALTER_TAGE`, `MAX_ALTER_MS` | `AnswerStorage`, `AnswerLimits` (`entries`, `characters`), `ANSWER_LIMITS`, `ANSWER_PREFIX`, `ANSWER_INDEX`, `MAX_AGE_DAYS`, `MAX_AGE_MS` |
| `Gespeichert`, `IndexEintrag` (fields stay as stored: `v`, `am`, `art`, `antwort`; `zeichen`, `am`, `art`)                                            | `StoredAnswer`, `IndexEntry`                                                                                                              |
| `antwortenPflegen`, `PFLEGE_TAKT_MS`, `PflegeSeite`, `PflegeOptionen` (`arten`)                                                                       | `maintainAnswerCache`, `MAINTENANCE_INTERVAL_MS`, `MaintenancePage`, `MaintenanceOptions` (`kinds`)                                       |

Private helpers and locals follow (`Aelteste` → `Oldest`, `schluesselVon` →
`keyOf`, `zuAlt` → `tooOld`, `pfad` → `path`, `jetzt` → `now`, …). Files:
`letzte-antworten.ts` → `answer-cache.ts`, `antworten-pflege.ts` →
`answer-cache-maintenance.ts`, specs with their file.

- Tests: the lib's specs (the stored entry and index read as before) and
  the app's.
- Commit: `refactor(feat-korbjaeger-antworten): rename the German identifiers to English (#2967)`.

### Task B4: rename the projects

`git mv` the folders to `libs/features/korbjaeger-selection` and
`libs/features/korbjaeger-answers`; the project and package names, the path
aliases in `tsconfig.base.json` (consumers' imports follow), the `LICENSE`
lines, the app's `EIGENE_LIB_ORDNER`, the libs' `README.md` and Vite config
paths.

- Tests: `npx nx show projects`, the check step.
- Commit: `refactor(feat-korbjaeger-selection): rename the libs to feat-korbjaeger-selection and feat-korbjaeger-answers (#2967)`.

### Task B5: hand fixes and docs

- Files: test titles and comments that quote an old name (lib and app),
  the app's templates that read a renamed member (`kinder()`,
  `vereinsfarben()`, `spitzname`, `primaer`), `CLAUDE.md`'s Korbjäger
  section.
- Tests: the check step, `ngc` over the app's templates.
- Commit: `refactor(feat-korbjaeger-selection): name the renamed identifiers in comments and CLAUDE.md (#2967)`.

## Part C: `korbjaeger-functions`

Issue [#3011](https://github.com/WolfSoko/wol-sok-mono/issues/3011), spec
[docs/specs/3011-…](../specs/3011-korbjaeger-english-identifiers-part-c-korbjaeger-functions.md).

### Task C1: spec and plan

- Files: the spec of #3011, this section.
- Commit: `docs(korbjaeger-functions): spec and plan for part C of the English identifiers (#3011)`.

### Task C2: rename by the map

| Old                                                                                                               | New                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `auswahlLoeschen` (export of `main.ts`, the deployed function)                                                    | `deleteSelection`                                                            |
| `kontoGeloescht`                                                                                                  | `accountDeleted`                                                             |
| emulator spec: `ELTERNTEIL`, `ANDERES`, `JETZT`, `AUSWAHL_DOKUMENT`                                               | `PARENT`, `OTHER_PARENT`, `NOW`, `SELECTION_DOCUMENT`                        |
| emulator spec: `auswahlVon`, `grabsteinVon`, `geraet`, `folgen`                                                   | `selectionOf`, `tombstoneOf`, `signedInDevice`, `follow`                     |
| emulator spec: `loeschendes`, `anderes`, `geloescht`, `nachDerLoeschung`, `ersteGespeichert`, `einmalGespeichert` | `deleting`, `other`, `deleted`, `afterDeletion`, `firstStored`, `storedOnce` |
| emulator spec: `schreiben`, `danach`, `gespeichert`                                                               | `writing`, `afterwards`, `stored`                                            |
| `package-json.spec.ts`: `konto`; `run-club-index.spec.ts`: the parameter `verein`                                 | `functionsCodebase`; `club`                                                  |

Files (`src/`): `konto-geloescht.ts` → `account-deleted.ts`,
`konto-geloescht.emulator.ts` → `account-deleted.emulator.ts`. The helper `geraet` becomes `signedInDevice`, not `device`: `follow`'s
parameter `device` is typed `ReturnType<typeof …>` of it, which a helper of
the same name would make refer to the parameter itself. The uids
`elternteil-a`/`-b` become `parent-a`/`-b`. The codebase `konto`, the
collections and the Verbände of the fixtures (`BAYERN`, `BERLIN`,
`HESSEN`) stay.

- Tests: `korbjaeger-functions:test`, `:test-emulator` and
  `:typecheck-specs` where it exists, unchanged in substance; `main.spec.ts`
  expects `deleteSelection`.
- Commit: `refactor(korbjaeger-functions): rename the German identifiers to English (#3011)`.

### Task C3: hand fixes and docs

- Files: comments and test titles that quote an old name (`main.ts`,
  `orphaned-accounts.ts` and its spec, the emulator spec), the log line,
  the comments in `apps/korbjaeger/firestore.rules`,
  `firestore-rules.emulator.ts`, `firebase-deploy.spec.ts` and
  `datenschutz.component.spec.ts`, `CLAUDE.md`'s Korbjäger section.
- Tests: the check step.
- Commit: folded into C2's (the PR squashes).

## Part D: the app

Issue [#3012](https://github.com/WolfSoko/wol-sok-mono/issues/3012), spec
[docs/specs/3012-…](../specs/3012-korbjaeger-english-identifiers-part-d-the-app.md).
Four PRs by folder group (D1 to D4, the spec's order); each runs the
"Steps of every part" on its group, its map below, and only D4 closes
#3012.

### Task D0: spec and plan

- Files: the spec of #3012, this section.
- Commit: `docs(korbjaeger): spec and plan for part D of the English identifiers (#3012)`, in D1's PR.

### Task D1: data and plumbing

Types, components and their members:

| Old                                                                                        | New                                                                                |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `DatenResource`, `LesendeResource`, `gelesenerStand`                                       | `DataResource`, `ReadingResource`, `readAsOf`                                      |
| `Lesung` (`stand`, `ersetzt`, `vormerken`, `abschliessen`), `KorbReadOptions.lesung`       | `Reading` (`asOf`, `replaced`, `defer`, `complete`), `KorbReadOptions.reading`     |
| `Stand` (`gespeichertAm`, `grund`), `StandGrund` (`'kein-internet'`, `'keine-verbindung'`) | `AsOf` (`storedAt`, `reason`), `AsOfReason` (`'no-internet'`, `'no-connection'`)   |
| `KeinInternetError`                                                                        | `NoInternetError`                                                                  |
| `ProxyCall.zeitlimitMs`, `ProxyTransportOptions` (`antworten`, `jetzt`, `zeitlimitMs`)     | `timeoutMs`; (`answers`, `now`, `timeoutMs`)                                       |
| `AuswahlAenderung` (`fehler`, `ausfuehren`)                                                | `SelectionChange` (`error`, `run`)                                                 |
| `HalleComponent` (`korb-halle`, `halle`), `SpielHalleComponent` (`korb-spiel-halle`)       | `VenueComponent` (`korb-venue`, `venue`), `GameVenueComponent` (`korb-game-venue`) |
| `HallenStand` (`art`: `'laedt'`, `'fehler'`, `'gelesen'`; `halle`)                         | `VenueState` (`kind`: `'loading'`, `'error'`, `'read'`; `venue`)                   |
| `StandComponent` (`korb-stand`, `stand`, `jetzt`)                                          | `AsOfComponent` (`korb-as-of`, `asOf`, `now`)                                      |
| `FirebaseEmulatoren`, `Environment` (`projektId`, `anmeldung`, `emulatoren`)               | `FirebaseEmulators`, (`projectId`, `signIn`, `emulators`)                          |
| testing: `FakeLesung`, `FakeDatenResource`, `AppQuelle`                                    | `FakeReading`, `FakeDataResource`, `AppSource`                                     |

Functions and constants:

| Old                                                                                                                                                                                                            | New                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aelterer`, `aeltesterStand`                                                                                                                                                                                   | `older`, `oldestAsOf`                                                                                                                                                                    |
| `LETZTE_ANTWORTEN`                                                                                                                                                                                             | `ANSWER_CACHE`                                                                                                                                                                           |
| `ligaSucheResource`, `ligaTeamsResource`, `spielDetailsResource`, `spielberichtResource`, `tabelleResource`, `teamSaisonResource`, `vereinsTeamsResource`                                                      | `leagueSearchResource`, `leagueTeamsResource`, `gameDetailsResource`, `gameReportResource`, `standingsResource`, `teamSeasonResource`, `clubTeamsResource`                               |
| `PROXY_ZEITLIMIT_MS`, `SPEICHERBARE_ARTEN`, `KEINE_ANTWORTEN`, `letzteAntwortStatt`, `standGrundVon`                                                                                                           | `PROXY_TIMEOUT_MS`, `STORABLE_KINDS`, `NO_ANSWERS`, `cachedAnswerInstead`, `asOfReasonOf`                                                                                                |
| `auswahlAenderung`, `VOLL`, `auswahlFehlerText`, `fehlerText`                                                                                                                                                  | `selectionChange`, `FULL`, `selectionErrorText`, `errorText`                                                                                                                             |
| `KEIN_TEAM`, `KEIN_VEREIN`, `KEINE_LIGA`, `KEINE_VERBAENDE`, `KEINE_LIGEN_IM_VERBAND`, `KEINE_LIGEN_IN_ALTERSKLASSE`, `KEINE_LIGEN`, `KEIN_SPIEL`, `KEIN_INTERNET`, `KEINE_VERBINDUNG`, `DBB_NICHT_ERREICHBAR` | `NO_TEAM`, `NO_CLUB`, `NO_LEAGUE`, `NO_ASSOCIATIONS`, `NO_LEAGUES_IN_ASSOCIATION`, `NO_LEAGUES_IN_AGE_GROUP`, `NO_LEAGUES`, `NO_GAME`, `NO_INTERNET`, `NO_CONNECTION`, `DBB_UNREACHABLE` |
| `hallenStand`                                                                                                                                                                                                  | `venueState`                                                                                                                                                                             |
| `STUNDE`, `TAG`, `ZEIT`, `standAlter`, `standZeit`, `STAND_GRUENDE`, `standGrundText`, `alterText`                                                                                                             | `HOUR`, `DAY`, `TIME_OF_DAY`, `asOfAge`, `asOfTime`, `AS_OF_REASONS`, `asOfReasonText`, `ageText`                                                                                        |
| `abgleichen`                                                                                                                                                                                                   | `reconcile`                                                                                                                                                                              |
| `ANGEMELDET_SCHLUESSEL`, `ZWISCHENSPEICHER_LEEREN_SCHLUESSEL`, `INSTALLATION_ABGELEHNT_SCHLUESSEL`, `DARSTELLUNG_SCHLUESSEL`, `flagGesetzt`, `flagSetzen`, `SPEICHER_FREIGEBEN`                                | `SIGNED_IN_KEY`, `CLEAR_CACHE_KEY`, `INSTALL_DISMISSED_KEY`, `APPEARANCE_KEY`, `isFlagSet`, `setFlag`, `FREE_STORAGE`                                                                    |
| `HEUTE`, `JETZT`, `TAKT_MS`                                                                                                                                                                                    | `TODAY`, `NOW`, `TICK_MS`                                                                                                                                                                |
| `EMULATOREN`, `environmentFuer`                                                                                                                                                                                | `EMULATORS`, `environmentFor`                                                                                                                                                            |
| `PROXY_CACHE_SEKUNDEN`, `vereinMitFesterSpanne`, `cdnFertigerSpielbericht`                                                                                                                                     | `PROXY_CACHE_SECONDS`, `clubWithFixedSpan`, `cdnFinishedGameReport`                                                                                                                      |
| `buildKonfigurationMerken`, `cssZiele`                                                                                                                                                                         | `rememberBuildConfiguration`, `cssTargets`                                                                                                                                               |
| testing: `APP_ORDNER`, `EIGENE_LIB_ORDNER`, `appQuellen`, `quellenIn`, `dateienIn`                                                                                                                             | `APP_FOLDER`, `OWN_LIB_FOLDERS`, `appSources`, `sourcesIn`, `filesIn`                                                                                                                    |
| testing: `APP_REGELN`, `OFFENE_REGELN`, `emulatorProjekt`, `alsGeraet`, `ohneRegeln`                                                                                                                           | `APP_RULES`, `OPEN_RULES`, `emulatorProject`, `asDevice`, `withoutRules`                                                                                                                 |
| testing: `mapSpeicher`, `GESPERRTER_SPEICHER`, `spielOn`, `saisonOf`, `zeigen`                                                                                                                                 | `mapStorage`, `BLOCKED_STORAGE`, `gameOn`, `seasonOf`, `show`                                                                                                                            |
| specs in `src/`: `ENGLISCHE_WOERTER`, `GLOBALE_STILE`, `TEAMS_HOECHSTENS`, `KINDER_HOECHSTENS`, `VEREINE_HOECHSTENS`, `ELTERNTEIL`, `GUELTIG`, `UNGUELTIG`                                                     | `ENGLISH_WORDS`, `GLOBAL_STYLES`, `MAX_TEAMS`, `MAX_CHILDREN`, `MAX_CLUBS`, `PARENT`, `VALID`, `INVALID`                                                                                 |

Files and folders (`src/` unless named): `app/fehler/` → `app/errors/`
(`auswahl-aenderung.ts` → `selection-change.ts`, `auswahl-fehler-text.ts`
→ `selection-error-text.ts`, `fehler-text.ts` → `error-text.ts`),
`app/stand/` → `app/as-of/` (`stand-text.ts` → `as-of-text.ts`,
`stand.component.ts` → `as-of.component.ts`), `app/halle/` → `app/venue/`
(`halle.component.ts` → `venue.component.ts`, `hallen-stand.ts` →
`venue-state.ts`, `spiel-halle.component.ts` → `game-venue.component.ts`);
in `app/basketball-data/`: `kein-internet-error.ts` →
`no-internet-error.ts`, `lesung.ts` → `reading.ts`, `stand.ts` →
`as-of.ts`, `letzte-antworten-pflege.ts` → `answer-cache-maintenance.ts`,
`liga-suche-resource.ts` → `league-search-resource.ts`,
`liga-teams-resource.ts` → `league-teams-resource.ts`,
`spiel-details-resource.ts` → `game-details-resource.ts`,
`spielbericht-resource.ts` → `game-report-resource.ts`,
`tabelle-resource.ts` → `standings-resource.ts`, `team-saison-resource.ts`
→ `team-season-resource.ts`, `vereins-teams-resource.ts` →
`club-teams-resource.ts`, `testing/fake-daten-resource.ts` →
`fake-data-resource.ts`; `app/abgleichen.ts` → `reconcile.ts`,
`app/geraete-speicher.ts` → `device-storage.ts`, `app/heute.ts` →
`today.ts`, `app/jetzt.ts` → `now.ts`; `testing/app-quellen.ts` →
`app-sources.ts`, `testing/speicher.ts` → `storage.ts`,
`testing/team-saison.ts` → `team-season.ts`, `testing/zeigen.ts` →
`show.ts`; `deutsche-texte.spec.ts` → `german-texts.spec.ts`,
`emulatoren.spec.ts` → `emulators.spec.ts`, `css-ziele.spec.ts` →
`css-targets.spec.ts`; `deploy/css-ziele.ts` → `deploy/css-targets.ts`;
specs with their file. The proxy's route files keep their names and
parameters.

Parameters, locals and private helpers follow the vocabulary and the
spec's new words (`stand` → `asOf`, `lesung` → `reading`, `grund` →
`reason`, `gespeichertAm` → `storedAt`, `jetzt` → `now`, `heute` →
`today`, `vorher` → `before`, `eintrag` → `entry`, `speicher` →
`storage`, `schluessel` → `key`, `abbruch` → `abort`, `inhalt` →
`content`, `pfad` → `path`, `datei` → `file`, `treffer` → `hits`, …); the
fixtures' proper names stay.

- Tests: every spec of the app, unchanged in substance; `korbjaeger:e2e`
  (the `korb-stand`, `korb-halle` selectors).
- Commit: `refactor(korbjaeger): English identifiers, part D1: data and plumbing (#3012)`.

### Task D2: Spiel and Team

Types, components and their members:

| Old                                                                                                                                                                                    | New                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KindMarkierungComponent` (`spieler`, `kind`, `auswahl`, `seite`, `aenderung`, `eigenerFehler`, `offenerDialog`, `beendet`, `markieren`, `spitznameAendern`, `entmarkieren`, `fragen`) | `ChildMarkComponent` (`player`, `child`, `selection`, `pageChange`, `change`, `ownError`, `openDialog`, `destroyed`, `mark`, `changeNickname`, `unmark`, `ask`) |
| `SpitznameDialogComponent` (`frage`, `laenge`, `titel`, `bestaetigenText`, `eingegeben`, `zeichen`, `zuLang`, `bestaetigen`)                                                           | `NicknameDialogComponent` (`question`, `length`, `title`, `confirmText`, `entered`, `characters`, `tooLong`, `confirm`)                                         |
| `SpitznameFrage` (`spitzname`, `aktion`)                                                                                                                                               | `NicknameQuestion` (`nickname`, `action`)                                                                                                                       |
| `SpitznameAntwort` (`spitzname`)                                                                                                                                                       | `NicknameAnswer` (`nickname`)                                                                                                                                   |
| `NaechstesSpielComponent` (`zeile`, `halle`, `mitLiga`, `titel`)                                                                                                                       | `NextGameComponent` (`row`, `venue`, `withLeague`, `title`)                                                                                                     |
| `SpielLinkComponent` (`zeile`, `titel`, `mitLiga`)                                                                                                                                     | `GameLinkComponent` (`row`, `title`, `withLeague`)                                                                                                              |
| `SpielZeileComponent` (`zeile`, `titel`, `mitLiga`, `vorlaeufigText`, `ausgangText`, `markierungText`)                                                                                 | `GameRowComponent` (`row`, `title`, `withLeague`, `provisionalText`, `outcomeText`, `irregularityText`)                                                         |
| `SpielZeile` (`datum`, `uhrzeit`, `liga`, `ort`, `gegner`, `ergebnis`, `ausgang`, `vorlaeufig`, `markierung`)                                                                          | `GameRow` (`date`, `time`, `league`, `homeOrAway`, `opponent`, `result`, `outcome`, `provisional`, `irregularity`)                                              |
| `KaderComponent` (`titel`, `kader`, `seite`, `gefolgt`, `kinder`, `zeilen`, `spalten`, `ueberschriftId`)                                                                               | `RosterComponent` (`title`, `roster`, `side`, `followed`, `children`, `rows`, `columns`, `headingId`)                                                           |
| `KaderZeile` (`nummer`, `anonym`, `werte`, `spieler`, `kind`)                                                                                                                          | `RosterRow` (`number`, `anonymous`, `stats`, `player`, `child`)                                                                                                 |
| `SpielComponent` (`spielId`, `spiel`, `gefolgt`, `kindFehler`, `vorlaeufigText`, `bericht`, `kopf`, `periodenSpalten`, `fehler`, `spielbericht`)                                       | `GamePageComponent` (`gameId`, `game`, `followed`, `childError`, `provisionalText`, `report`, `head`, `periodColumns`, `error`, `gameReport`)                   |
| `SpielKopf` (`heim`, `gast`, `wann`, `liga`, `ergebnis`, `vorlaeufig`, `perioden`)                                                                                                     | `GameHead` (`home`, `away`, `when`, `league`, `result`, `provisional`, `periods`)                                                                               |
| `KaderTeil` (`seite`, `titel`, `kader`, `gefolgt`)                                                                                                                                     | `RosterPart` (`side`, `title`, `roster`, `followed`)                                                                                                            |
| `SpielberichtTeil` (`art`, `kader`)                                                                                                                                                    | `GameReportPart` (`kind`, `rosters`)                                                                                                                            |
| `TeamFolgenComponent` (`gefolgt`, `verschwindetNachEntfolgen`, `auswahl`, `folgt`, `aenderung`, `nachEntfolgen`, `umschalten`, `folgen`, `entfolgen`)                                  | `FollowTeamComponent` (`followed`, `disappearsOnUnfollow`, `selection`, `follows`, `change`, `afterUnfollow`, `toggle`, `follow`, `unfollow`)                   |
| `TeamTabelleComponent` (`liga`, `spalten`, `ueberschriftId`, `tabelle`, `zeilen`, `fehler`)                                                                                            | `TeamStandingsComponent` (`league`, `columns`, `headingId`, `standings`, `rows`, `error`)                                                                       |
| `TabelleZeileAnsicht` (`rang`, `spiele`, `siege`, `niederlagen`, `koerbe`, `differenz`, `eigenes`)                                                                                     | `StandingsRowView` (`rank`, `games`, `wins`, `losses`, `points`, `difference`, `own`)                                                                           |
| `NachEntfolgen` (`auswahl`, `ziele`, `zielSetzen`, `entfolgt`, `rueckgaengigAnbieten`)                                                                                                 | `AfterUnfollow` (`selection`, `targets`, `setTarget`, `unfollowed`, `offerUndo`)                                                                                |
| `FokusNachEntfolgenDirective` (`korbFokusNachEntfolgen`)                                                                                                                               | `FocusAfterUnfollowDirective` (`korbFocusAfterUnfollow`)                                                                                                        |
| `SaisonEndeHinweisComponent` (`stand`)                                                                                                                                                 | `SeasonOverHintComponent` (`state`)                                                                                                                             |
| `VereinsTeamsComponent` (`stand`)                                                                                                                                                      | `ClubTeamsComponent` (`state`)                                                                                                                                  |
| `VereinsTeamsStand` (`art`)                                                                                                                                                            | `ClubTeamsState` (`kind`)                                                                                                                                       |
| `VereinsTeamZeile` (`ligen`)                                                                                                                                                           | `ClubTeamRow` (`leagues`)                                                                                                                                       |

Literals: `SpitznameFrage.aktion` (`'markieren'`, `'aendern'`) → `action`: `'mark'`, `'change'`; `SpielberichtTeil.art` (`'laedt'`, `'fehler'`, `'fehlt'`, `'da'`) → `kind`: `'loading'`, `'error'`, `'missing'`, `'ready'`; `VereinsTeamsStand.art` (`'laedt'`, `'fehler'`, `'gelesen'`) → `kind`: `'loading'`, `'error'`, `'read'`.

Functions, constants and spec names:

| Old                          | New                       |
| ---------------------------- | ------------------------- |
| `KIND_AENDERUNG`             | `CHILD_CHANGE`            |
| `provideKindAenderung`       | `provideChildChange`      |
| `spielTag`                   | `gameDay`                 |
| `spielTagUndUhrzeit`         | `gameDayAndTime`          |
| `ergebnisText`               | `resultText`              |
| `VORLAEUFIG`                 | `PROVISIONAL`             |
| `spielZeilen`                | `gameRows`                |
| `spielZeile`                 | `gameRow`                 |
| `istGefolgt`                 | `isFollowed`              |
| `gefolgterVerein`            | `followedClub`            |
| `kaderZeilen`                | `rosterRows`              |
| `kaderZeile`                 | `rosterRow`               |
| `spielKopf`                  | `gameHead`                |
| `spielberichtTeil`           | `gameReportPart`          |
| `tabelleZeilen`              | `standingsRows`           |
| `vereinsTeamsStand`          | `clubTeamsState`          |
| `RUECKGAENGIG_MS`            | `UNDO_MS`                 |
| `KEINE_TABELLE`              | `NO_STANDINGS`            |
| `VereinsTeamDetailDirective` | `ClubTeamDetailDirective` |
| `VereinsTeamDetailContext`   | `ClubTeamDetailContext`   |
| `HEUTE_IM_SPEC`              | `TODAY_IN_SPEC`           |
| `JETZT_IM_SPEC`              | `NOW_IN_SPEC`             |
| `TeamSpieleRead`             | `TeamGamesRead`           |

Selectors: `korb-kind-markierung` → `korb-child-mark`, `korb-spitzname-dialog` → `korb-nickname-dialog`, `korb-naechstes-spiel` → `korb-next-game`, `korb-spiel-link` → `korb-game-link`, `korb-spiel-zeile` → `korb-game-row`, `korb-kader` → `korb-roster`, `korb-spiel` → `korb-game-page`, `korb-team-folgen` → `korb-follow-team`, `korb-team-tabelle` → `korb-team-standings`, `korb-saison-ende-hinweis` → `korb-season-over-hint`, `korb-vereins-teams` → `korb-club-teams`, `[korbFokusNachEntfolgen]` → `[korbFocusAfterUnfollow]`, `[korbVereinsTeamDetail]` → `[korbClubTeamDetail]`.

`data-qa` values (templates, specs and e2e page objects): `team-folgen` → `follow-team`, `team-stand` → `team-as-of`, `tabelle-fehler` → `standings-error`, `tabelle-zeile` → `standings-row`, `tabelle` → `standings`, `tabelle-team` → `standings-team`, `spiel-vorlaeufig` → `game-provisional`, `kind-menue` → `child-menu`, `kind-markieren` → `child-mark`, `kind-fehler` → `child-error`, `team-naechstes` → `team-next`, `spitzname-zu-lang` → `nickname-too-long`, `spitzname-zaehler` → `nickname-counter`, `spiel-liga` → `game-league`, `spiel-ergebnis` → `game-result`, `spiel` → `game`, `saison-beendet` → `season-over`, `viertel-zeile` → `quarters-row`, `viertel` → `quarters`, `spielbericht-fehlt` → `game-report-missing`, `spielbericht-fehler` → `game-report-error`, `spiel-wann` → `game-when`, `spiel-uhrzeit` → `game-time`, `spiel-status` → `game-status`, `spiel-stand` → `game-as-of`, `spiel-ort` → `game-home-or-away`, `spiel-markierung` → `game-irregularity`, `spiel-gegner` → `game-opponent`, `spiel-fehler` → `game-error`, `spiel-datum` → `game-date`, `spiel-ausgang` → `game-outcome`, `kader-zeile` → `roster-row`, `kader-start` → `roster-starter`, `kader-spitzname` → `roster-nickname`, `kader-ohne-werte` → `roster-without-stats`, `kader` → `roster`, `vereins-team-name` → `club-team-name`, `vereins-team-ligen` → `club-team-leagues`, `vereins-team` → `club-team`. The `vereins-teams`, `vereins-stand` and `vereins-teams-fehler` of PR #3006 go with D3, as planned.

Component CSS classes follow the same words (`.ausgang` → `.outcome`, `.tabelle` → `.table`, `.stern` → `.star`, `.eigenes-team` → `.own-team`, …); the global `.fehler` and `.umbrechende-liste` of `styles.scss` stay until D4.

Files: `kind/kind-aenderung.ts` → `child/child-change.ts`, `kind/kind-markierung.component.ts` → `child/child-mark.component.ts`, `kind/spitzname-dialog.component.ts` → `child/nickname-dialog.component.ts`, `kind/child-hints.ts` → `child/child-hints.ts`, `spiel/naechstes-spiel.component.ts` → `game/next-game.component.ts`, `spiel/spiel-format.ts` → `game/game-format.ts`, `spiel/spiel-link.component.ts` → `game/game-link.component.ts`, `spiel/spiel-zeile.component.ts` → `game/game-row.component.ts`, `spiel/spiel-zeile.ts` → `game/game-row.ts`, `spiel-seite/gefolgter-verein.ts` → `game-page/followed-club.ts`, `spiel-seite/kader-spalten.ts` → `game-page/roster-columns.ts`, `spiel-seite/kader-zeilen.ts` → `game-page/roster-rows.ts`, `spiel-seite/kader.component.ts` → `game-page/roster.component.ts`, `spiel-seite/spiel-kopf.ts` → `game-page/game-head.ts`, `spiel-seite/spiel.component.ts` → `game-page/game-page.component.ts`, `spiel-seite/spielbericht-teil.ts` → `game-page/game-report-part.ts`, `team/fokus-nach-entfolgen.directive.ts` → `team/focus-after-unfollow.directive.ts`, `team/nach-entfolgen.ts` → `team/after-unfollow.ts`, `team/tabelle-zeilen.ts` → `team/standings-rows.ts`, `team/team-folgen.component.ts` → `team/follow-team.component.ts`, `team/team-tabelle.component.ts` → `team/team-standings.component.ts`, `verein/saison-ende-hinweis.component.ts` → `club/season-over-hint.component.ts`, `verein/vereins-team-detail.directive.ts` → `club/club-team-detail.directive.ts`, `verein/vereins-teams-stand.ts` → `club/club-teams-state.ts`, `verein/vereins-teams.component.ts` → `club/club-teams.component.ts`; the templates and styles of `kader`, `spiel` and `team-tabelle` with their component; specs with their file.

Parameters, locals and private helpers follow the vocabulary (`spiel` → `game`, `kader` → `roster`, `zeile` → `row`, `seite` → `side`, or `page` where it holds the rendered page in a spec, …). Commit: `refactor(korbjaeger): English identifiers, part D2: Spiel and Team (#3012)`.

### Tasks D2 to D4

Each adds its map here in its PR's first commit (step 1), by the
vocabulary and the spec's decisions, and names the words it translated
that the vocabulary did not hold:

- **D2, Spiel and Team** (`app/spiel/` → `game/`, `app/spiel-seite/` →
  `game-page/`, `app/kind/` → `child/`, `app/team/`, `app/verein/` →
  `club/`; `VereinsTeamDetailDirective` → `ClubTeamDetailDirective`,
  `korbVereinsTeamDetail` → `korbClubTeamDetail`). Commit:
  `refactor(korbjaeger): English identifiers, part D2: Spiel and Team (#3012)`.
- **D3, overview, colours and search** (`app/ueberblick/` → `overview/`,
  `app/vereinsfarben/` → `club-colors/`, `app/search/`,
  `app/team-einrichten/` → `team-setup/`; the ids `ueber-den-verein`,
  `ueber-die-liga`, `ueber-mein-kind` and the `data-qa` values of PR
  #3006). Commit:
  `refactor(korbjaeger): English identifiers, part D3: overview, colours and search (#3012)`.
- **D4, account and frame** (`app/konto/` → `account/`, `app/auswahl/` →
  `selection/`, `app/darstellung/` → `appearance/`, `app/pwa/`,
  `src/pwa/`, `app/rechtliches/` → `legal/`, `app/navigation/`,
  `app/app.*`, the contents of `app/pages/`, `e2e/`; `CLAUDE.md`'s "until
  #2967" note; the final `list` review). Commit:
  `refactor(korbjaeger): English identifiers, part D4: account and frame (#3012)`.
