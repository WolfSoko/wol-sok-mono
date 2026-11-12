# Plan #3040: Pacetrainer naming leftovers

Spec: [docs/specs/3040-pacetrainer-naming-leftovers-getready-for-the-vorlauf-excercise-ts-typo.md](../specs/3040-pacetrainer-naming-leftovers-getready-for-the-vorlauf-excercise-ts-typo.md)

1. **`getready` → `leadIn`.** Files: `shared/model/training/training-name.ts`,
   `shared/ui/training-name.pipe.ts`,
   `features/sprint-training/sprint-training.component.ts` and its spec (test
   first: the spec expects `countdownTo: 'leadIn'`). Add a pipe spec
   (`training-name.pipe.spec.ts`) that maps every `TrainingName` to its German
   text, `leadIn` to "Bereit". Commit `refactor(pacetrainer): name the
   Vorlauf leadIn in TrainingName`.
2. **`excercise.ts` → `exercise.ts`.** `git mv`, then the imports in
   `training-run.ts`, `interval.ts`, `training-config-with.duration.ts`,
   `sprint-training-data.service.ts`, `training-run.spec.ts`,
   `screen-wake-lock.service.spec.ts`. Commit `refactor(pacetrainer): fix the
   exercise.ts file name`.
3. **Checks.** `npx nx format:write`, `npx nx run-many -p pacetrainer -t
   test,lint,lint-templates,build`, and the acceptance grep.
