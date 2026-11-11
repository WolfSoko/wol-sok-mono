# Spec #2968: Pacetrainer: rename the remaining German identifiers to English

Issue: [#2968](https://github.com/WolfSoko/wol-sok-mono/issues/2968), a
sub-issue of [#2961](https://github.com/WolfSoko/wol-sok-mono/issues/2961)
(English for everything code-related, CLAUDE.md Coding Rule 10).

## Goal

Pacetrainer's code names its domain terms by their `_Code_` names in
`CONTEXT.md`: Zusammenfassung is `Summary`, Intervall is `Interval`,
Konfiguration `TrainingConfig`, Vorlauf `LeadIn`, Ansage `Announcement`. No
identifier, file name, selector, CSS class or test id in `apps/pacetrainer`
keeps a German word; the texts the runner sees stay German.

## Non-goals

- No change to a UI text, the manifest, `index.html` or what the app does.
- Domain words in prose (comments, spec titles) stay as `CONTEXT.md` spells
  them ("the next Intervall"), as the glossary asks.
- No other app or lib.

## Decisions

- **No migration.** The only persisted data is `StoredRun` under the storage
  key `trainingRun`: `{ config, elapsed }`, whose `config` is a
  `TrainingConfigWithDuration` (`exercises`, `type`, `timing`, `repetitions`)
  and the form's stored configuration, both English already. The renamed
  names (`Zusammenfassung`, `PlannedIntervall`, `intervalle`) live in memory
  only, so a stored run reads as before.
- **Rename by identifier, not by text** (repo learning L354): German words
  are also prose and UI here ("Intervall 1 / 4", "Intervallzeit").
- **The component file follows its class**: `zusammenfassung.component.ts`
  becomes `summary.component.ts`, `ZusammenfassungComponent` is
  `SummaryComponent` with selector `pace-summary`, input `summary`, host CSS
  class `summary` and test id `summary` (the e2e page object's locator and
  `expectSummary` follow).
- **The renames in `training-run.ts`**: `Zusammenfassung` → `Summary`, the
  view's and run's field `zusammenfassung` → `summary`, `PlannedIntervall` →
  `PlannedInterval`, `intervalle` → `intervals`, `toIntervalle` →
  `toIntervals`, `intervall`/`intervallElapsed` → `interval`/`intervalElapsed`;
  the German doc comment of `TrainingRun` becomes English.
- **Further German identifiers the change touches go too** (Rule 10: every
  name it rewrites is English): `ANSAGE_WINDOW` → `ANNOUNCEMENT_WINDOW`
  (`sprint-training.component.ts`), the spec helpers `konfiguration` →
  `trainingConfig` (`training-run.spec.ts`) and `startPastVorlauf` →
  `startPastLeadIn` (`screen-wake-lock.service.spec.ts`).

## Acceptance

1. `grep -rniE "zusammenfassung|intervall|konfiguration|vorlauf|ansage"`
   over `apps/pacetrainer` matches only UI texts, the manifest, `index.html`
   and prose (comments, test titles), no identifier, file name, selector,
   class or test id.
2. A run stored before the change (`{ config, elapsed }`) restores as a
   paused run after it (existing restore specs stay green).
3. `nx test pacetrainer`, `nx lint pacetrainer`, `nx lint-templates
   pacetrainer` and `nx build pacetrainer` pass.
4. The e2e `run-sprint-training.spec.ts` still finds the summary after
   ending a training, with the same German texts.

## Open questions

None.
