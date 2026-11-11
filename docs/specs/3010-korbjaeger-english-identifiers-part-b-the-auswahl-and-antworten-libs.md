# Spec #3010: Korbjäger: English identifiers, part B: the Auswahl and Antworten libs

Issue: [#3010](https://github.com/WolfSoko/wol-sok-mono/issues/3010), part B
of [#2967](https://github.com/WolfSoko/wol-sok-mono/issues/2967). The rules
for every part (goal, non-goals, vocabulary, decisions, acceptance) are
[#2967's spec](2967-korbjaeger-rename-the-german-identifiers-in-code-to-english.md);
this spec only adds what is particular to part B. The map is part B's section
of [#2967's plan](../plans/2967-korbjaeger-rename-the-german-identifiers-in-code-to-english.md).

## Goal

Every name declared in `feat-korbjaeger-auswahl` and
`feat-korbjaeger-antworten` is English, and so are the projects:

| Old                                                                | New                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `feat-korbjaeger-auswahl` (`libs/features/korbjaeger-auswahl`)     | `feat-korbjaeger-selection` (`libs/features/korbjaeger-selection`) |
| `@wolsok/feat-korbjaeger-auswahl`, `…/testing`                     | `@wolsok/feat-korbjaeger-selection`, `…/testing`                   |
| `feat-korbjaeger-antworten` (`libs/features/korbjaeger-antworten`) | `feat-korbjaeger-answers` (`libs/features/korbjaeger-answers`)     |
| `@wolsok/feat-korbjaeger-antworten`                                | `@wolsok/feat-korbjaeger-answers`                                  |

Folder, `project.json` name, `package.json` name, path alias, the `LICENSE`
line, the app's `EIGENE_LIB_ORDNER` (`src/testing/app-quellen.ts`) and
`CLAUDE.md` follow. The consumers (the app, its emulator specs) change their
references to the libs' exports; their own names wait for part D.

## Non-goals

As #2967's spec. In particular:

- **The answer cache's stored strings stay byte for byte**: the entry
  `{ v, am, art, antwort }`, the index `{ v, eintraege }` with its entries
  `{ zeichen, am, art }`, the stored kinds of `STORED_KINDS` and the keys
  `korbjaeger-answer:…` and `korbjaeger-answers`. The types describing
  them get English names (`StoredAnswer`, `IndexEntry`), their fields keep
  the stored spelling.
- **The selection's persisted names stay**: version 3's fields (`version`,
  `teams`, `children`, `clubColors`, `since`, `nickname`) are English
  already; the German fields that `legacy-selection.ts` reads of versions
  1 and 2 (`kinder`, `seit`, `spitzname`, `vereinsfarben`) and the key
  `korbjaeger-auswahl` stay as stored. The legacy files keep their
  (English) names: #2983 ([PR #3009](https://github.com/WolfSoko/wol-sok-mono/pull/3009))
  removes them; they keep their locals that hold the stored German
  fields too, and only their references to renamed names change.
- **UI texts**: the German texts the app builds from the libs' errors stay.
  The libs' own error messages (`KeineFarbeError`'s "Keine Farbe im Format
  …", not shown to the Elternteil) are no identifiers and stay as they are;
  each error class's `name` follows its class name.

## Decisions

- **Vocabulary** as #2967's spec, with the words part B meets first (they
  join the table when a second part meets them): Änderung `Change`,
  Inhalt `Content`, Dokument `Document`, Feld/Felder `Field`/`fields`,
  Liste `List`, Platz `Place`, seit `since`, gelesen `read`, roh `raw`,
  entfernt `REMOVED`, Wahl (of Vereinsfarben) `Choice`, primär/zweite
  `primary`/`secondary`, Gerät `Device`, Fenster `WindowEvents`, offen
  `pending`, abgeben `handOver`, beenden `stop`, Merken `store`,
  aufräumen `cleanUp`, Pflege `Maintenance`, Alter `Age`, Zeichen
  `characters`, Codepunkte `codePoints`.
- **Domain terms**: Kind `Child` (the type, its file `child.ts`, the list
  `children`), Spitzname `nickname`, Auswahl `Selection`, Vereinsfarben
  `ClubColors`, zusammenführen `merge` (`mergeSelections`), übernehmen
  `takeOver` (`takeOverDevice`).
- **The lists' keys** (`AuswahlListe`: `teams`, `kinder`,
  `vereinsfarben`) become `teams`, `children`, `clubColors`: in-memory only
  (the stored fields come from each descriptor's `field`), and now equal to
  their document field.
- **Two files of one name**: `vereinsfarben.ts` becomes
  `club-colors.ts` beside `lists/club-colors.ts` (the descriptor); the
  folders tell them apart, as `lists/children.ts` and `child.ts` do.
- **Names left by PR #3001**: `istKindEintrag` becomes `isChildEntry`, the
  parameter `_alt` `_previous`, the local `uebrig` of
  `geraet-uebernehmen.ts` `leftOver`.

## Acceptance

#2967's acceptance 1 to 5 for the two libs, and:

6. `npx nx show projects` lists `feat-korbjaeger-selection` and
   `feat-korbjaeger-answers`, not the old names; `git grep` finds the old
   project names and path aliases only in `CHANGELOG.md` and in the
   specs and plans of earlier issues.
7. The answer cache's specs that read an entry and an index stored before
   the rename (`art: 'team-spiele'`, `eintraege`, `zeichen`) pass
   unchanged in substance.

## Open questions

None.
