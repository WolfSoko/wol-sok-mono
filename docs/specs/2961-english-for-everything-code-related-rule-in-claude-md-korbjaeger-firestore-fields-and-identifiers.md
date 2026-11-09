# Spec #2961: English for everything code-related: rule in CLAUDE.md, Korbjäger Firestore fields and identifiers

Issue: [#2961](https://github.com/WolfSoko/wol-sok-mono/issues/2961)

## Goal

Everything to do with code and programming is English: identifiers, file and
folder names, persisted field and key names, comments, commit messages, specs,
plans and ADRs. User-facing texts stay in the app's UI language (German in
Korbjäger and Pacetrainer). The domain keeps its German terms in `CONTEXT.md`
for the UI and for talking about the domain; code uses one fixed English
translation per term, recorded next to the term.

This PR delivers part 1 of the issue: the rule and the translations. Parts 2
(Firestore fields and storage keys) and 3 (identifiers) get issues of their
own, as the issue allows.

## Non-goals

- No renaming of existing code in this PR. Parts 2 and 3 touch about 37 000
  lines in four projects and data that is live in production (sign-in and sync
  of the `Auswahl`); each needs its own spec, migration and review.
- No automated check for German identifiers: no word list separates German
  identifiers from English ones without false alarms (`Team`, `Phase`, `Liga`
  as a DBB field), and the rename issues would make it noisy until they land.
- No change to `deutsche-texte.spec.ts` (UI texts stay German).
- Pacetrainer's few German identifiers (`ZusammenfassungComponent`,
  `PlannedIntervall`, `Zusammenfassung`) are not renamed here; raised to the
  manager as a follow-up.

## Decisions

- **Rule placement.** A new Coding Rule 10 "English in code" in `CLAUDE.md`,
  with the boundary (what is code, what is a UI text) and the pointer to the
  `_Code_` names; `docs/agents/domain.md` gets a section "Glossary terms in
  code", since skills read it when naming things.
- **Glossary format.** Each term in `CONTEXT.md` gains a line
  `_Code_: <English name>` below its definition, beside `_Avoid_`. The intro
  says that `_Avoid_` governs prose and UI, `_Code_` governs identifiers, so an
  English word on an `_Avoid_` list (Summary, Season, Club) is still the right
  code name when `_Code_` names it. One translation per term, so specs, code
  and reviews agree without asking.
- **Translations (Korbjäger).** Elternteil `Parent`, Verband `Association`,
  Verein `Club`, Saison `Season`, Team `Team`, Liga `League`, Spiel `Game`,
  Spielbericht `GameReport`, Kader `Roster`, Spielerwerte `PlayerStats`,
  Anonymer Spieler `AnonymousPlayer`, Mein Team `FollowedTeam`, Kind `Child`.
  `GameReport` over `Boxscore`: the glossary avoids Boxscore since the DBB's
  boxscore also holds the Kader; `boxscore` stays only where the DBB's own
  JSON fields are mapped. `Game` over `Match`: `Match` is Bacteria Wars' word,
  and the glossary avoids it.
- **Translations (Pacetrainer)**, from what its code already calls them where
  it does: Konfiguration `TrainingConfig`, Intervall `Interval`,
  Trainingslauf `TrainingRun`, Phase `RunPhase`, Vorlauf `Countdown`,
  Zusammenfassung `Summary`, Ansage `Cue`.
- **Existing German identifiers** stay until their rename issue lands; new
  code (#2957, #2958 included) is English from now on. A file touched for
  another reason does not rename its persisted German names piecemeal: they
  need the migration of part 2, and scattered renames collide with the work in
  flight. Non-persisted names a change introduces or rewrites are English.
- **DBB field names** in the mapping code (`ligaData`, `spielplan`, ...) are
  the DBB's API, not ours: they stay as the DBB spells them, mapped to English
  names at the adapter.
- **CLAUDE.md's Korbjäger section** keeps naming today's German identifiers,
  since it must match the code; the rename issues update it.
- **Split.** Part 2 and part 3 become one issue each, linked to #2961 as
  sub-issues (relationships field, guideline G5), part 2 blocking part 3:
  part 3's renames of the `Auswahl` types follow the new field names. Part 3
  may split further per project when specced. #2961 stays open as their
  umbrella; this PR refers to it (`Refs #2961`) and does not close it.

## Acceptance

1. `CLAUDE.md` has Coding Rule 10 stating: code-related things in English, UI
   texts in the UI language, domain terms by their `_Code_` name, existing
   German names renamed only by their issues, DBB fields as the DBB spells
   them.
2. `docs/agents/domain.md` has a section on glossary terms in code that points
   at the `_Code_` line.
3. Every term in both `CONTEXT.md` sections has exactly one `_Code_:` line,
   and the intro explains `_Avoid_` versus `_Code_`.
4. Issues for part 2 and part 3 exist as sub-issues of #2961, each with the
   scope the issue lists, part 2 blocking part 3, both linked from the PR.
5. `npx nx format:check` passes on the changed files.

## Open questions

None. Settled at approval: `Game` and `GameReport` as listed; #2961 stays
open as the umbrella of the two sub-issues.
