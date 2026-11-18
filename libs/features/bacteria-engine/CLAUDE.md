# Bacteria engine

Rules for working on `libs/features/bacteria-engine`
(`feat-shared-bacteria-engine`), on top of the repo's `CLAUDE.md` and the
game lib's (`libs/features/lazy/bacteria-game/CLAUDE.md`), whose rules on
determinism, replays, balance and texts hold here too.

- The engine is the game without Angular: the match (`state/match/match-engine.ts`),
  both simulations, replays, levels, progress, achievements and the
  translation mechanics (`i18n/`). The game, its Cloud Functions
  (`apps/bacteria-wars-functions`) and the admin area play the same code.
- **Texts:** the engine holds only the English it renders into its state
  through `english()` (`ENGINE_EN` in `i18n/engine-texts.ts`: the areas
  `achievements`, `game`, `levels`, `training` under `i18n/en/`). Every
  other text, and all German, is the game's (`feat-lazy-bacteria-game`,
  `src/lib/i18n/texts/`), so a copy edit there reruns none of the engine's
  gates and deploys no function ([#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103)). A key the engine builds goes into
  one of its four areas; `GameText<K>` is typed by the engine's keys
  (`EngineTextKey`) by default, the game widens it to its own.
- **Node only.** Nothing here imports Angular, NgRx, RxJS, Firebase, the
  DOM, `feat-bacteria-rendering` or `feat-bacteria-sound`. An oxlint override in
  `.oxlintrc.json` guards the imports, Jest runs every spec in Node
  (`testEnvironment: 'node'`), and `engine-bundle.spec.ts` bundles
  `src/index.ts` and `src/cloud.ts` to prove it. Browser-only code goes
  elsewhere: WebGL and canvas into `feat-bacteria-rendering`, Web Audio
  into `feat-bacteria-sound`, the rest into the game lib.
- `src/index.ts` is the main entry (`@wolsok/feat-shared-bacteria-engine`):
  named exports, no `export *`. Nothing outside this lib imports a path
  inside it; a new export goes into the index, unless it is declared
  under `state/cloud/`: the cloud contract (the documents, ids, parsers
  and sorts the game, the functions and the admin share) is
  `@wolsok/feat-shared-bacteria-engine/cloud` (`src/cloud.ts`, built as the
  ng-packagr secondary entry `cloud/ng-package.json`, since the game lib's
  `build` compiles against the engine's `dist`) only, a
  name entering it with its first consumer outside the engine. Its
  `dist` holds a second copy of what `state/cloud/` imports, so a `/cloud`
  signature takes and returns plain data, never one of the engine's
  classes (a class with private members would clash with the main
  entry's copy in the game lib's `build`);
  `entries.spec.ts` keeps both entries apart. Spec fixtures (`aMatchRecord`,
  `recordedReplay`) are `@wolsok/feat-shared-bacteria-engine/testing`, for
  specs only. The balance lab (`state/balance/`, with the calibration's
  `SKILL` and `strengthOf`) is `@wolsok/feat-shared-bacteria-engine/balance`
  (`src/balance.ts`), for the scripts in `tools/bacteria-game/balance/`
  only; what they share with the game comes from the main entry.
- The targets `balance-check`, `balance` (ADR 0016) and `perf` (ADR 0014,
  `tools/perf/engine-bench.mjs`) live here, since they play the engine.
- The goldens (`state/replay/golden-replay.json`, `SELF_TEST_GOLDEN`) are guarded
  by their specs here; the GPU cross-check, which needs `gl/`, lives in
  `feat-bacteria-rendering` (`libs/features/bacteria-rendering/gpu-crosscheck/`)
  and imports the engine.
