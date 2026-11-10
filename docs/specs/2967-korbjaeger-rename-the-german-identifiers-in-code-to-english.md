# Spec #2967: Korbjäger: rename the German identifiers in code to English

Issue: [#2967](https://github.com/WolfSoko/wol-sok-mono/issues/2967), part 3
of [#2961](https://github.com/WolfSoko/wol-sok-mono/issues/2961) (CLAUDE.md
Coding Rule 10). Its blocker, the persisted names of
[#2966](https://github.com/WolfSoko/wol-sok-mono/issues/2966), is done.

## Goal

Every name in Korbjäger's code is English: types, interfaces and their
fields, functions, classes, constants, tokens, parameters and locals, string
literal unions held in memory, file and folder names, Angular selectors and
CSS classes. A domain term takes its `_Code_` name from `CONTEXT.md`; the
other recurring words take one fixed name from the vocabulary below, so
every part translates a word the same way. Behaviour does not change.

## Non-goals

- **No UI text changes.** Everything the Elternteil sees stays German;
  `deutsche-texte.spec.ts` keeps passing unchanged.
- **No URL changes.** The app's routes (`/spiel/{id}`, `/einstellungen`,
  `/suchen`, `/team-einrichten`, …) are what the Elternteil sees, bookmarks
  and installs; Analog derives them from the file names under
  `src/app/pages/`, so those page files keep their names. The proxy's paths
  under `/api/dbb/` stay too: they are the keys of the cached answers and of
  the CDN's cache, and the e2e's fake DBB answers by them.
- **No persisted value changes** (approval condition): the
  Firestore collections and fields, the rules and the device keys were
  renamed by #2966; the transitional code that reads the old names
  (`legacySelection`, `moveLegacyDeviceKeys`, `LEGACY_*`) is removed by
  [#2983](https://github.com/WolfSoko/wol-sok-mono/issues/2983) (PR #3009),
  not renamed here. The answer cache keeps what it stores (below).
- **DBB fields** keep the DBB's spelling where the adapter reads the raw
  JSON (`ligaData`, `spielplan`, `heimMannschaftLiga`, …); only our mapped
  shapes are renamed.
- **Domain words in prose.** Comments, specs, ADRs and `CLAUDE.md` keep
  talking about Spiel, Kader and Kind (`CONTEXT.md` is the language of the
  domain); only the identifiers they quote change.
- **No refactoring** beyond the rename: no split, merge or move of a module
  other than its file name, so each diff reads as a rename.

## Split

About 42 000 lines in six projects, so one PR per part, in this order (each
lib renames its exports and updates every consumer's references to them;
the consumers' own names wait for their part):

| Part | Projects                                                                                                                                                                                                    | Lines  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A    | `feat-shared-basketball-data` (`libs/features/basketball-data`), its uses in the app, the functions, the libs and `tools/korbjaeger`                                                                        | 8 500  |
| B    | `feat-korbjaeger-auswahl` and `feat-korbjaeger-antworten`, renamed to `feat-korbjaeger-selection` (`libs/features/korbjaeger-selection`) and `feat-korbjaeger-answers` (`libs/features/korbjaeger-answers`) | 5 500  |
| C    | `korbjaeger-functions` (`apps/korbjaeger-functions`)                                                                                                                                                        | 2 000  |
| D    | `korbjaeger` (`apps/korbjaeger`), split by folder where a PR passes about 8 000 changed lines                                                                                                               | 28 000 |

Part A is delivered with this spec and plan; B, C and D become sub-issues of
#2967, each blocked by the one before (guideline G5), and #2967 closes with
the last. The order follows the dependencies: a lib's names reach the
consumers once, and the app goes last, renaming its own names on top of the
libs' English API. `feat-shared-korbjaeger-account` is already English.

## Decisions

- **Mechanical, by the compiler.** Each part renames through the TypeScript
  language service (a `ts-morph` script run over the workspace's
  `tsconfig.base.json` projects): every declaration of a name in the map is
  renamed with all its references, in every project, file renames move
  their imports. A rename that would clash with a name already in scope at
  any reference is reported, not applied, and resolved by hand. String
  literal unions are renamed with their uses by the same map, checked by
  the compiler. The script is a one-off kept out of the repo (it is not
  workspace tooling); the map it applies is the part's section of the plan,
  so a rebase over a conflicting PR reruns it instead of resolving each
  conflict by hand.
- **Vocabulary.** Domain terms by `_Code_`: Spiel `Game`, Spielbericht
  `GameReport`, Kader `Roster`, Spielerwerte `PlayerStats`, Anonymer Spieler
  `AnonymousPlayer`, Verein `Club`, Verband `Association`, Liga `League`,
  Saison `Season`, Kind `Child`, Mein Team `FollowedTeam`, Elternteil
  `Parent`. Other recurring words, one name each:

  | German                               | English                                         | German                            | English                                  |
  | ------------------------------------ | ----------------------------------------------- | --------------------------------- | ---------------------------------------- |
  | Halle                                | `Venue`                                         | Tabelle, Zeile                    | `Standings`, `StandingsRow`              |
  | heim / gast                          | `home` / `away`                                 | Spielseite                        | `GameSide`                               |
  | Partei                               | `Participant`                                   | Spielstand, Ergebnis              | `Score`, `result`                        |
  | Ausgang (Sieg, Niederlage)           | `Outcome` (`win`, `loss`)                       | Sonderfall                        | `Irregularity`                           |
  | geplant, gespielt                    | `scheduled`, `played`                           | abgesagt, kampflos                | `cancelled`, `forfeited`                 |
  | bestätigt, vorläufig                 | `confirmed`, `provisional`                      | verzichtet                        | `forfeitedBy`                            |
  | Viertel, Verlängerung                | `quarters`, `overtimes`                         | Spieltag                          | `matchday`                               |
  | Datum, Uhrzeit, Anwurf               | `date`, `time`, `tipOff`                        | Gegner                            | `opponent`                               |
  | Benannter Spieler                    | `NamedPlayer`                                   | Kader-Eintrag                     | `RosterEntry`                            |
  | Vorname, Nachname, Trikotnummer      | `firstName`, `lastName`, `shirtNumber`          | Punkte, Zweier, Dreier            | `points`, `twoPointers`, `threePointers` |
  | Freiwürfe (getroffen, versucht)      | `freeThrows` (`made`, `attempted`)              | Feldkörbe                         | `fieldGoals`                             |
  | Körbe, Gegenkörbe, Korbdifferenz     | `pointsFor`, `pointsAgainst`, `pointDifference` | Rang, Siege, Niederlagen          | `rank`, `wins`, `losses`                 |
  | Geschlecht (männlich, weiblich, mix) | `Gender` (`male`, `female`, `mixed`)            | Altersklasse, Spielklasse, Bezirk | `ageGroup`, `division`, `district`       |
  | Überblick, gemeinsamer               | `Overview`, `Combined`                          | Kader-Suche, Funde                | `RosterSearch`, `finds`                  |
  | Liga-Suche, Seite, Facette           | `LeagueSearch`, `page`, `Facet`                 | Auswahl                           | `Selection`                              |
  | Spitzname                            | `nickname`                                      | Vereinsfarben                     | `ClubColors`                             |
  | folgen, entfolgen, markieren         | `follow`, `unfollow`, `mark`                    | zusammenführen, übernehmen        | `merge`, `takeOver`                      |
  | Konto, Sitzung, Dienst               | `Account`, `Session`, `Service`                 | Anmeldung, anmelden               | `SignIn`, `signIn`                       |
  | Einstellungen                        | `Settings`                                      | Darstellung                       | `Appearance`                             |
  | Rechtliches, Datenschutz             | `Legal`, `Privacy`                              | Fußzeile, Titelleiste             | `Footer`, `TitleBar`                     |
  | Letzte Antworten, Antwort            | `AnswerCache`, `Answer`                         | Speicher                          | `Storage`                                |
  | Stand (of a read)                    | `asOf`                                          | Lesung                            | `Reading`                                |
  | Fehler, Hinweis                      | `Error`, `Hint`                                 | Anzeigetafel                      | `scoreboard`                             |
  | Installationshinweis                 | `InstallHint`                                   | heute, jetzt                      | `TODAY`, `NOW`                           |
  | lokal                                | `Local`                                         | Grenzen                           | `Limits`                                 |

  A word not in the table gets its plain English translation, recorded in
  the part's map, and joins this table when a second part meets it.

- **Files and folders follow their main export** (`spiel.ts` → `game.ts`,
  `ueberblick/` → `overview/`, `spiel-seite/` → `game-page/`), except the
  page files under `src/app/pages/`, which are URLs (non-goals).
- **Selectors and CSS classes** are renamed in part D with the `korb` prefix
  kept (`korb-installations-hinweis` → `korb-install-hint`,
  `.anzeigetafel` → `.scoreboard`); the template lint and the specs that
  query them follow.
- **Lib projects** renamed in part B (folder, project name, path alias,
  `LICENSE` line, `CLAUDE.md`), since "Auswahl" and "Antworten" are German
  names of code. `feat-shared-basketball-data` is English already.
- **The answer cache keeps its stored strings** (approval condition): the
  stored entry `{ v, am, art, antwort }`, the index's `eintraege` and
  `zeichen`, and the request kinds as stored in `art` (`'team-spiele'`,
  `'spiel-info'`, …) stay byte for byte, so no cached answer is dropped
  and no read goes to the DBB again
  ([#2963](https://github.com/WolfSoko/wol-sok-mono/issues/2963) and
  [#2997](https://github.com/WolfSoko/wol-sok-mono/issues/2997) keep the
  DBB's load down). The TypeScript names around them, the `DbbRequest`
  kinds included, are English; the cache maps each kind to its stored
  string at the storage boundary (`STORED_KINDS`, part A), as the adapter
  maps the raw DBB fields. A stored literal that cannot be kept without a
  contortion is named in its PR and asked about first.
- **Names left for #2967 by earlier PRs** go into the part whose sources
  hold them: from PR #3001 `istKindEintrag` (`lists/children.ts`), the
  parameter `_alt` (`children.ts`, `club-colors.ts`) and the local
  `uebrig` (`geraet-uebernehmen.ts`), part B; from PR #3006 the `data-qa`
  values `vereins-stand`, `vereins-teams`, `vereins-teams-fehler` and
  `suchen`, the heading ids `ueber-den-verein` and `ueber-die-liga`
  (`search-page.component.ts`) and `zeitlimitMs` in `ProxyCall` and
  `PROXY_ZEITLIMIT_MS` (`proxy-fetch.ts`), part D. `vereinsIndex` in
  `datenschutz.component.ts` stays with
  [#3004](https://github.com/WolfSoko/wol-sok-mono/issues/3004).
- **Tests** are renamed with the code (describe and test titles that quote
  an identifier included); a part adds no behaviour and so no new spec,
  except where a renamed literal reaches outside the compiler's view (the
  boundary map of the stored kinds, part A).
- **CLAUDE.md's Korbjäger section** names the new identifiers in the PR of
  the part that renames them; its "until #2967" note goes with part D.
- **Conflicts with open work** (#3008, #3009, the work of #2990 and #2997
  and later Korbjäger PRs): a part rebases onto main before its merge
  request by rerunning its map over what merged, not by merging the diff;
  its PR names what was already on main. Other sessions' branches are left
  alone.

## Acceptance

Per part:

1. No identifier declared in the part's sources (types, fields, functions,
   classes, constants, parameters, locals, in-memory string literals, file
   and folder names) is German, except DBB fields read from the raw JSON and
   the page files under `src/app/pages/`. Checked by listing the declared
   names with the plan's script and reviewing the list.
2. Every name of the vocabulary above is translated as the table says.
3. UI texts, URLs, proxy paths and persisted Firestore and device names and the answer cache's stored strings are
   unchanged (`deutsche-texte.spec.ts`, the routes' and proxy specs, the
   rules' emulator specs, the answer cache's specs and `geraete-schluessel.spec.ts` pass unchanged in
   substance).
4. `npx nx affected -t lint,lint-templates,test,typecheck-specs,build` and
   the affected `test-emulator` and e2e targets pass; CI is green.
5. `CLAUDE.md` names the renamed identifiers.

For part A additionally:

6. The lib's exports, files and domain shapes are English (`Game`,
   `GameReport`, `Roster`, `Club`, `League`, `Season`, `Venue`,
   `Standings`, …), the request kinds included; the app, the functions, the
   other libs and `tools/korbjaeger` compile against them, and the answer cache stores and reads the kinds under their old strings.
7. Sub-issues for parts B, C and D exist under #2967, B blocked by A's PR
   being merged, C by B, D by C.

## Open questions

None. Settled at approval: the proxy paths stay; part D splits by folder
group wherever a PR would pass about 8 000 changed lines; persisted values
stay as stored; the route `/suchen` stays German.
