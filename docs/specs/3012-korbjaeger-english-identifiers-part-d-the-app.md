# Spec #3012: Korbjäger: English identifiers, part D: the app

Issue: [#3012](https://github.com/WolfSoko/wol-sok-mono/issues/3012), part D
of [#2967](https://github.com/WolfSoko/wol-sok-mono/issues/2967). The rules
for every part (goal, non-goals, vocabulary, decisions, acceptance) are
[#2967's spec](2967-korbjaeger-rename-the-german-identifiers-in-code-to-english.md);
this spec only adds what is particular to part D. The maps are part D's
section of [#2967's plan](../plans/2967-korbjaeger-rename-the-german-identifiers-in-code-to-english.md).

## Goal

Every name declared in `apps/korbjaeger` (`src/`, `e2e/`, `deploy/`) is
English: types, components, services, tokens, functions, constants,
parameters, locals, in-memory string literals, files and folders, Angular
selectors (the `korb` prefix kept), CSS classes, `data-qa` values and HTML
ids. Parts A to C renamed the libs and the functions; the app's references
to them are English already, its own names (about 250 source files,
30 000 lines) are still German.

It includes the names earlier PRs left for part D:

- from PR #3006: the `data-qa` values `vereins-stand`, `vereins-teams`,
  `vereins-teams-fehler` and `suchen`, the heading ids `ueber-den-verein`
  and `ueber-die-liga` (`search-page.component.ts`), `zeitlimitMs` in
  `ProxyCall` and `PROXY_ZEITLIMIT_MS` (`proxy-fetch.ts`);
- from PR #3018: `VereinsTeamDetailDirective`, `VereinsTeamDetailContext`
  and the selector `korbVereinsTeamDetail`, `saisonOf`, `spielOn` and the
  parameter `datum` (`src/testing/team-saison.ts`), the parameter `heute`
  of `childStep`, the HTML id `ueber-mein-kind`, the spec names
  `JETZT_IM_SPEC` and `TeamSpieleRead`;
- from part C: the app's own `KontoDienst.auswahlLoeschen`;
- `CLAUDE.md`'s note "Until then the Korbjäger section below names them as
  the code spells them", which goes with the last PR of part D.

## Non-goals

As #2967's spec. In particular:

- **URLs stay**: the page files under `src/app/pages/` keep their names
  (`/suchen`, `/team-einrichten`, `/einstellungen`, `/spiel/{id}`, …), and
  so do the proxy's route files under `src/server/routes/api/dbb/` with
  their parameter names (`[spielId]`, `[ligaId]`, …), since Nitro takes the
  route and its `params` keys from the file name. What the page files hold
  (their component and imports) is renamed.
- **Persisted names stay**: the device keys (`korbjaeger-…`), the
  selection document (version 3, English since #2966), the answer cache's
  stored strings (part A's `STORED_KINDS`), the Firestore collections and
  the legacy keys the migration reads.
- **UI texts stay German.** A literal the page prints or a screen reader
  reads (`aria-label`, chip texts) is a text, not a name; where a renamed
  literal was printed it gets a German label, as part A's `markierungText`.
- **Fixture proper names stay**: invented players and the real Vereine and
  Verbände of the fixtures (`WASBUETTEL_RST`, `GIFHORN`,
  `NIEDERSACHSEN_U12_JUGEND_MAENNLICH`), as parts B and C kept them.
- **Earlier specs and plans** keep the names they were written with.

## Decisions

- **Four PRs, by folder group** (#2967's approval: split where a PR would
  pass about 8 000 changed lines). Each holds its group's declarations,
  files and folders, the references to them in the rest of the app, and
  `CLAUDE.md`'s lines that name them; each merges on its own with CI green,
  in this order:
  1. **D1, data and plumbing**: `app/basketball-data/`, `app/fehler/`,
     `app/stand/`, `app/halle/`, the root files of `src/app/`
     (`abgleichen`, `geraete-speicher`, `heute`, `jetzt`), `src/shared/`,
     `src/server/` (not the route files), `src/environments/`,
     `src/testing/`, `deploy/` and the specs in `src/` itself.
  2. **D2, Spiel and Team**: `app/spiel/`, `app/spiel-seite/`, `app/kind/`,
     `app/team/`, `app/verein/`.
  3. **D3, overview, colours and search**: `app/ueberblick/`,
     `app/vereinsfarben/`, `app/search/`, `app/team-einrichten/`.
  4. **D4, account and frame**: `app/konto/`, `app/auswahl/`,
     `app/darstellung/`, `app/pwa/`, `src/pwa/`, `app/rechtliches/`,
     `app/navigation/`, `app/app.*`, the contents of `app/pages/`, `e2e/`
     (specs, page objects, fake DBB), and `CLAUDE.md`'s note; it closes
     #3012.

  Only D4 says `Closes #3012`; D1 to D3 say `Part of #3012`. A group whose
  diff passes 8 000 lines splits again by folder, named in its PR.

- **The map of a group is written before its build**, in its PR's plan
  section (step 1 of "Steps of every part"). D1's map is in the plan now;
  D2 to D4 follow the vocabulary and the decisions here, and each PR names
  every word it translated that the vocabulary does not hold. An open
  choice that the vocabulary and the plain translation do not settle goes
  to the manager before that group's build.
- **Words new to the vocabulary**, used by every group: Stand of a load
  (`laedt`, `fehler`, `gelesen`) is `State` (`'loading'`, `'error'`,
  `'read'`), as distinct from the Stand of a read (`asOf`); Grund `reason`;
  Schlüssel `Key`; Zeitlimit `timeout`; abgleichen `reconcile`; Knopf
  `Button`; Blatt `Sheet`; Zeile `Row`; Ziel `target`; Quelle `source`;
  Ordner `folder`; Regeln `rules`; zeigen `show`; vormerken/merken/
  abschließen (the Lesung's steps) `defer`/`remember`/`complete`.
- **Selectors, CSS classes, `data-qa` values and HTML ids** follow their
  component or the English word (`korb-stand` → `korb-as-of`,
  `.anzeigetafel` → `.scoreboard`, `data-qa="vereins-teams"` →
  `"club-teams"`); the e2e page objects and the specs that query them
  change in the same PR, which a run of the affected e2e shows. The
  template lint's prefix (`korb`) stays.
- **Stand reasons in memory** (`'kein-internet'`, `'keine-verbindung'`)
  are renamed (`'no-internet'`, `'no-connection'`): they live only in the
  read's `Stand`, never in the answer cache (the stored entry keeps `am`
  and the answer only).
- **`theme.spec.ts`, `deutsche-texte.spec.ts` and the device-key spec**
  keep checking what they check; their file names, constants and the
  `EIGENE_LIB_ORDNER` list (`OWN_LIB_FOLDERS`) are renamed with `testing/`
  in D1, and `CLAUDE.md` names them.
- **Rebase per PR**: each rebases onto main before its merge request by
  rerunning its map, as #2967's spec says; open Korbjäger PRs of other
  sessions are left alone and named in the PR.

## Acceptance

#2967's acceptance 1 to 5 for `apps/korbjaeger`, and:

6. After D4, the script's `list` mode over `apps/korbjaeger/src`, `e2e/`
   and `deploy/` lists no German name outside the page and route files,
   the fixtures' proper names, the raw DBB fields and the persisted names
   of the non-goals; the review of the list is in D4's PR.
7. The items PR #3006, PR #3018 and part C left (Goal) are renamed.
8. `korbjaeger:e2e` passes on every PR that renames a selector, class,
   `data-qa` value or id.
9. `CLAUDE.md`'s Korbjäger section names the new identifiers, and its
   "until #2967" note is gone with D4.

## Open questions

None.
