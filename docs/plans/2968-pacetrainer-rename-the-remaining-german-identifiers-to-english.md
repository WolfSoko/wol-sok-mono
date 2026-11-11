# Plan #2968: Pacetrainer: rename the remaining German identifiers to English

Spec: [docs/specs/2968-…](../specs/2968-pacetrainer-rename-the-remaining-german-identifiers-to-english.md).
Pure rename: the existing specs are the tests and must stay green unchanged
in what they assert. `npx nx format:write` and
`npx nx affected -t lint,lint-templates` before each commit.

1. **Training run** — `apps/pacetrainer/src/app/shared/training-run/training-run.ts`
   and its spec: `Summary`, `summary`, `PlannedInterval`, `intervals`,
   `toIntervals`, English doc comment; spec helper `trainingConfig`.
   `screen-wake-lock.service.spec.ts`: `startPastLeadIn`. Check: `nx test
   pacetrainer`. Commit `refactor(pacetrainer): English names in the training run`.
2. **Summary component** — `git mv` `zusammenfassung.component.ts` to
   `summary.component.ts`; `SummaryComponent`, `pace-summary`, input,
   class and test id `summary`; `sprint-training.component.{ts,html}`
   (`ANNOUNCEMENT_WINDOW`), e2e `pos/sprint-training.page.ts` and
   `run-sprint-training.spec.ts`. Check: `nx test pacetrainer`, `nx build
   pacetrainer`, the e2e spec. Commit `refactor(pacetrainer): name the Zusammenfassung component Summary`.
3. **Check acceptance 1** with the grep and list the results in the PR.
