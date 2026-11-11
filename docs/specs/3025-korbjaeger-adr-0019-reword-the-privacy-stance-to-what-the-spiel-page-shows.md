# Spec #3025: Korbjäger ADR 0019: reword the privacy stance to what the Spiel page shows

Issue: [#3025](https://github.com/WolfSoko/wol-sok-mono/issues/3025). Found in
the review of [#2963](https://github.com/WolfSoko/wol-sok-mono/issues/2963);
the letter to the DBB in
[PR #3013](https://github.com/WolfSoko/wol-sok-mono/pull/3013) already
describes the page as it is. Related:
[#3016](https://github.com/WolfSoko/wol-sok-mono/issues/3016).

## Goal

[ADR 0019](../adr/0019-korbjaeger-privacy-stance.md) describes what the app
does today. It now says "Children appear only inside the Kader of a Spiel of
a Team someone follows", and its title says the app shows children's data
"only to those who follow their Team". The Spiel page
(`apps/korbjaeger/src/app/spiel-seite/`) shows both sides' Kader of any
Spiel. Only marking a Kind ("Als mein Kind markieren") and highlighting a
marked one are limited to a followed side (`KaderTeil.gefolgt` in
`spielbericht-teil.ts`).

## Non-goals

- No code change: the owner decided that the page stays as it is.
- The rest of the stance stays: no player search, no player pages, no
  season statistics or leader boards, no search of Spielberichte for a
  person, `noindex`, ids rather than data, anonymised fixtures.
- The file name `0019-korbjaeger-privacy-stance.md` stays, since specs,
  plans, READMEs and CLAUDE.md link to it.

## Decisions

| Decision                                                                                                                                                                                                         | Reason                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reword the first bullet of "No way to find a child …": children appear only inside a Spiel's Kader, both sides, as the DBB publishes it; reaching a Spiel takes its Team, found through Verband, Liga or Verein. | It is what `spiel.component.html` renders; the issue asks for exactly this.                                                                                                                                                                                                     |
| Add that marking a Kind and its highlight work only in the Kader of a followed Team's side.                                                                                                                      | This is the limit the page really has (`KaderTeil.gefolgt`).                                                                                                                                                                                                                    |
| Retitle the ADR to "Korbjäger shows children only inside a Spiel's Kader".                                                                                                                                       | The old title claims a followed-only limit the page does not have; no file links the title text.                                                                                                                                                                                |
| Add a dated note under the header that names #3025 and the change.                                                                                                                                               | An accepted ADR changed later says so, so a reader of the old wording finds why.                                                                                                                                                                                                |
| Leave the privacy policy, `apps/korbjaeger/README.md` and CLAUDE.md alone.                                                                                                                                       | Checked: the privacy policy says "Kinder erscheinen nur im Kader eines Spiels" (sections 3 and 9), the README "both Kader of the Spielbericht", CLAUDE.md "A Kind is marked on a Spiel page, only in the Kader of a followed Team's side". None claims a followed-only display. |

## Acceptance

1. ADR 0019 no longer says that children appear only in the Kader of a
   followed Team's Spiel, neither in the title nor in the body.
2. ADR 0019 says that a Spiel page shows both sides' Kader, and that a Kind
   can be marked and is highlighted only on a followed side.
3. The no-search, no-player-page and store-ids parts of the ADR are
   unchanged.
4. Privacy policy, app README and CLAUDE.md are consistent with the ADR
   (no edit needed, as checked above).
5. `nx format:check` passes on the changed files; no code or spec changes.

## Open questions

None.
