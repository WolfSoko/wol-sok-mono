# Plan: one achievement tally, shared tile styles and one back-target mechanism ([#3192](https://github.com/WolfSoko/wol-sok-mono/issues/3192))

Spec: [docs/specs/3192-…](../specs/3192-bacteria-wars-one-achievement-tally-shared-tile-styles-and-one-back-target-mechanism.md). One branch, one PR, one commit per task.

1. **Tally into the engine** — move `menu/achievement-tally.ts` and its spec
   to `libs/features/bacteria-engine/src/lib/state/progress/achievement-tally.ts`
   (counting over `ACHIEVEMENT_IDS`), export it from `src/index.ts`, use it
   in `xp.ts`, the profile, the achievements screen and
   `campaign.service.ts`. Test first: a campaign summary spec that an
   unknown id does not count. Check `perf-inputs.spec.ts` still passes.
   Commit `refactor(feat-shared-bacteria-engine): one achievement tally`.
2. **Back target** — test first in `stage-screens.spec.ts`
   (`backPanel`, `backLabelKey`) and the game component spec
   (`flow.backLabel()`); then `stage-screens.ts`, `PlayFlow.backLabel`,
   the template and the achievements component's `backLabel` input.
   Commit `refactor(feat-lazy-bacteria-game): one back-target mechanism`.
3. **Mixins** — `focus-ring`, `tile`, `icon-size` in `menu/_screen.scss`,
   applied to the six tile stylesheets and the icon triples. Build the remote
   to check the component style budget.
   Commit `refactor(feat-lazy-bacteria-game): shared tile and icon styles`.
4. **Visually hidden once** — add the include to the game remote's
   `styles.scss`, drop the six component includes.
   Commit `refactor(feat-lazy-bacteria-game): define the visually-hidden class once`.
5. Checks: `nx affected -t test,lint,lint-templates,typecheck-specs`,
   `nx build bacteria-game-remote`, `nx format:write`; open the PR.
