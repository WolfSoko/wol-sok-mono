# Plan #3026: no marking link to a Spiel in a Liga without Spielberichte

Spec: [docs/specs/3026-…](../specs/3026-korbjaeger-ueber-mein-kind-no-marking-link-to-a-spiel-in-a-liga-without-spielberichte.md)

1. **Lib helper `keepsGameReports`**
   - Files: `libs/features/basketball-data/src/lib/domain/team-season.ts`,
     its spec, `src/index.ts` (export).
   - Tests first: a Spiel of a Liga with `withoutGameReports` → false; of a
     Liga without the flag → true; of a Liga the Saison does not list → true.
   - Commit: `feat(feat-shared-basketball-data): tell whether a Spiel has a Spielbericht to expect`
2. **`childStep` picks the last played Spiel with a Spielbericht to expect**
   - Files: `apps/korbjaeger/src/app/search/child-step.ts`, `child-step.spec.ts`,
     `apps/korbjaeger/src/testing/team-saison.ts` (a Liga helper for specs).
   - Tests first: acceptance 1 and 2; existing cases unchanged.
   - Commit: `fix(korbjaeger): offer no marking link in a Liga without Spielberichte`
     (together with task 3).
3. **`ChildStepComponent` shows the hint**
   - Files: `child-step.component.ts`, `child-step.component.spec.ts`.
   - Test first: a Team whose Liga keeps no Spielberichte shows the hint
     and no link.
4. **Checks**: `nx format:write`, `nx affected -t lint,lint-templates,test,typecheck-specs`.

## Revision after the live check

1. **Lib back to before PR #3032**: drop `keepsGameReports`,
   `lastWithGameReport`, `withoutAnyGameReports` and their specs; correct
   the docs of `lastPlayed` and `League.withoutGameReports`.
2. **`checkedChildStep`** in `search/child-step.ts`, with specs.
3. **`ChildStepComponent`** reads the Spiel's details
   (`spielDetailsResource`), shows the hint through `checkedChildStep`;
   specs on the recorded DBB answers (`fakeDbbAnswer`).
4. Commit: `fix(korbjaeger): ask the Spiel's details whether its Liga keeps Spielberichte`.
5. After the deploy, the live check of acceptance 4.
