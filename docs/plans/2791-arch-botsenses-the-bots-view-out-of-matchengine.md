# Plan #2791: BotSenses, the bots' view out of MatchEngine

Spec: `docs/specs/2791-arch-botsenses-the-bots-view-out-of-matchengine.md`.
All paths below are in `libs/features/bacteria-engine/src/lib/state/`.

## 1. `BotSenses`, test first

- `bot-senses.spec.ts`: a fake `SensedSimulation` (summaries, nutrients,
  block counts, dynamic walls, nearest enemy as plain values) and the
  acceptance cases of the spec (point 4).
- `bot-senses.ts`: `SensedSimulation`, `MatchColonies` (`players`,
  `neutral`), `BotSenses` with `viewFor` and `routesFrom`; the nav grid,
  flood and hill caches, the weapon view and `bacteriaAround` moved from
  `match-engine.ts`; `buildBotView`'s body, `neutralFood` and `colonyView`
  moved from `bot-controller.ts`.
- Commit: `refactor(feat-shared-bacteria-engine): BotSenses builds what the bots see`.

## 2. `MatchEngine` asks the senses

- `match-engine.ts`: build `BotSenses` in the constructor after the
  simulation; `runBots` asks `viewFor`, `steerNeutrals` asks `routesFrom`;
  delete `botWeaponView`, `bacteriaAround`, `routesFrom`, `navGridAt`,
  `hillAt`, the `nav`, `floods` and `hill` fields and the imports they used.
- `bot-controller.ts`: delete `buildBotView`, `neutralFood`, `colonyView`.
- `bot-controller.spec.ts`: delete the `neutralFood` block (its cases live
  in `bot-senses.spec.ts`).
- Tests: `npx nx test feat-shared-bacteria-engine` (goldens, match engine,
  golden replay unchanged), `npx nx test feat-lazy-bac-game -t golden`,
  `npx nx run feat-shared-bacteria-engine:perf` for a look at the ratios.
- Same commit as task 1 when it is small enough to review together,
  otherwise `refactor(feat-shared-bacteria-engine): MatchEngine takes the bots' view from BotSenses`.

## 3. Checks and PR

- `npx nx format:write`, the pinned oxfmt check on the changed files,
  `npx nx affected -t lint,lint-templates,test,build`.
- Rebase on `main`, open the PR with spec, plan and code, `Closes #2791`.
