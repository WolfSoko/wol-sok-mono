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
