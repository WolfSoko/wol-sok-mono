# Plan: #3062 TrainingName vs RunPhase, TrainingNamePipe

Spec: `docs/specs/3062-pacetrainer-trainingname-overlaps-runphase-trainingnamepipe-lacks-public-and-an-exhaustiveness-check.md`. One branch, one PR; each task a commit, test first.

1. **Lead-in view names the first Intervall**
   - Test: `training-run.spec.ts` expects `{ phase: 'leadIn', next: <first name> }`.
   - Code: `training-run.ts`, `leadIn` view gets `next: TrainingName`.
   - Commit: `refactor(pacetrainer): name the first Intervall in the lead-in view`.
2. **Countdown target type; Vorlauf counts down to the first Intervall**
   - Test: `sprint-training.component.spec.ts` expects `countdownTo` of the first Intervall during the Vorlauf.
   - Code: `training-name.ts` (drop `leadIn`, `finished`; `CountdownTarget`), `countdown.model.ts`, `training-run.ts` (`next: CountdownTarget`), `interval-countdown.service.ts`, `sprint-training.component.ts`.
   - Commit: `fix(pacetrainer): count the lead-in down to the first Intervall`.
3. **Pipe: public and exhaustive**
   - Test: `training-name.pipe.spec.ts` over `Record<CountdownTarget, string>`.
   - Code: `training-name.pipe.ts`.
   - Commit: `refactor(pacetrainer): make TrainingNamePipe public and exhaustive`.
4. **e2e**: `e2e/pos/sprint-training.page.ts` `expectLeadInAnnounced` expects the first Intervall's name (folded into task 2's commit).
5. Format, `nx affected -t lint,lint-templates,test,typecheck`, PR, review, test, merge.
