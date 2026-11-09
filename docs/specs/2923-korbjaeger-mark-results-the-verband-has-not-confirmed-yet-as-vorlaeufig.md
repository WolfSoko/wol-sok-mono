# Spec: Korbjäger — mark results the Verband has not confirmed yet as vorläufig

Issue: [#2923](https://github.com/WolfSoko/wol-sok-mono/issues/2923). Part of [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861); related to [#2918](https://github.com/WolfSoko/wol-sok-mono/issues/2918) and [PR #2922](https://github.com/WolfSoko/wol-sok-mono/pull/2922).

## Goal

A score the Verband has not confirmed (`gespielt` with `bestaetigt: false`) reads as provisional wherever it shows: the word „vorläufig" beside the score, in `SpielZeileComponent` (Team page, overview cards, a Kind's card) and on the Spiel page. Score and Sieg/Niederlage badge stay visible, so the badge is provisional along with the score it is derived from.

## Non-goals

- Hiding the badge or the score until confirmation (tried and dropped: most youth results stay unconfirmed for a long time).
- Marking forfeits (`kampflos`): the DBB gives them no confirmation flag, and the chip „kampflos" already says what they are.
- Changing the proxy's cache times or `dbbBoxscoreFinished`.

## Decisions

| Decision                                                                                                                                                                                           | Reason                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The domain question goes into the lib: `ergebnisVorlaeufig(spiel)`, true only for `gespielt` with `bestaetigt: false`, exported from `@wolsok/feat-shared-basketball-data`                         | CLAUDE.md: Spiel questions are the lib's domain helpers; the app only formats. |
| The word is one constant, `VORLAEUFIG = 'vorläufig'` in `spiel/spiel-format.ts`, used by both screens                                                                                              | Keeps the two places consistent, as the issue asks.                            |
| `SpielZeile` gets `vorlaeufig: boolean`; the component shows `<span data-qa="spiel-vorlaeufig">vorläufig</span>` under the score in the result column, in `label-medium` with `on-surface-variant` | In words, not by colour; next to score and badge, so it reads as theirs.       |
| `SpielKopf` gets `vorlaeufig: boolean`; the Spiel page shows the same word beside the score in its score line. The status line „Ergebnis noch nicht bestätigt" (PR #2901) stays as the explanation | Same word in both places; the Spiel page keeps its longer explanation.         |
| The word is visible text right after the score, no `aria-label`, so a screen reader reads „78:47 vorläufig"                                                                                        | No hidden-only text to keep in step.                                           |

## Acceptance

1. `ergebnisVorlaeufig` is true for a played, unconfirmed Spiel and false for a confirmed one, `geplant`, `abgesagt` and `kampflos` (lib spec).
2. `spielZeile` sets `vorlaeufig` from it (spec).
3. `SpielZeileComponent` shows „vorläufig" with the score and badge of an unconfirmed result, and not for a confirmed one (spec).
4. The Spiel page shows „vorläufig" beside the score of an unconfirmed result, keeps „Ergebnis noch nicht bestätigt", and shows neither for a confirmed one (spec).
5. Team page and overview show it through `SpielZeileComponent` (existing specs stay green; a Team page spec checks one unconfirmed line).
6. `theme.spec.ts`, `deutsche-texte.spec.ts`, lint, format and the korbjaeger build pass.

## Open questions

None.
