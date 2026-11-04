# Bacteria engine

Rules for working on `libs/features/bacteria-engine`
(`feat-shared-bacteria-engine`), on top of the repo's `CLAUDE.md` and the
game lib's (`libs/features/lazy/bacteria-game/CLAUDE.md`), whose rules on
determinism, replays, balance and texts hold here too.

- The engine is the game without Angular: the match (`state/match-engine.ts`),
  both simulations, replays, levels, progress, achievements and the
  dictionaries (`i18n/`). The game, its Cloud Functions
  (`apps/bacteria-wars-functions`) and the admin area play the same code.
- **Node only.** Nothing here imports Angular, NgRx, RxJS, Firebase, the
  DOM or the game's `arena/`, `gl/` and `sound/`. An oxlint override in
  `.oxlintrc.json` guards the imports, Jest runs every spec in Node
  (`testEnvironment: 'node'`), and `engine-bundle.spec.ts` bundles
  `src/index.ts` to prove it. Browser-only code (WebGL, Web Audio, canvas)
  stays in the game lib.
- `src/index.ts` is the only entry (`@wolsok/feat-shared-bacteria-engine`):
  named exports, no `export *`. Nothing outside this lib imports a path
  inside it; a new export goes into the index. Spec fixtures (`aMatchRecord`,
  `recordedReplay`) are `@wolsok/feat-shared-bacteria-engine/testing`, for
  specs only.
- The targets `balance-check`, `balance` (ADR 0016) and `perf` (ADR 0014,
  `tools/perf/engine-bench.mjs`) live here, since they play the engine.
- The goldens (`state/golden-replay.json`, `SELF_TEST_GOLDEN`) are guarded
  by their specs here; the GPU cross-check, which needs `gl/`, stays in the
  game lib (`gpu-crosscheck/`) and imports the engine.
