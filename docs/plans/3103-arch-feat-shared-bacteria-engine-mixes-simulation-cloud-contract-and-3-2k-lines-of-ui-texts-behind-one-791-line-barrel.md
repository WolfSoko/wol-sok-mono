# Plan: the UI texts out of the bacteria engine

Spec: [docs/specs/3103-arch-feat-shared-bacteria-engine-mixes-simulation-cloud-contract-and-3-2k-lines-of-ui-texts-behind-one-791-line-barrel.md](../specs/3103-arch-feat-shared-bacteria-engine-mixes-simulation-cloud-contract-and-3-2k-lines-of-ui-texts-behind-one-791-line-barrel.md)

Branch off `main`. Before the first move, dump `EN` and `DE` to JSON in the scratchpad (acceptance 4).

1. **Engine: generic `GameText`, its own English.** Test first: an engine spec that `ENGINE_EN` holds exactly the areas `achievements`, `game`, `levels`, `training` and that every key the engine's state builds (the medallion, XP, lock, level and achievement texts) renders through `english()` without falling back to the key. Then `i18n/engine-texts.ts` (`ENGINE_EN`, `EngineTextKey`), `GameText<K>`, `Translate<K>`, `renderGameText<K>` and `english()` on `ENGINE_EN` in `game-text.ts`; `index.ts` exports the new names. Files: `libs/features/bacteria-engine/src/lib/i18n/*`, `src/index.ts`.
2. **Game: the texts move in.** `git mv` the 17 other English areas and all 21 German areas to `libs/features/lazy/bacteria-game/src/lib/i18n/texts/{en,de}/`, `dictionaries.ts` to `texts/dictionaries.ts` (importing the engine's four English areas through `ENGINE_EN`), the German areas' `Translation` types against the engine's English through the engine's index. The game's `game-texts.ts` exports `TranslationKey` and `GameText` (`GameText<TranslationKey>`); every game and admin-kit import of `EN`, `DE`, `DICTIONARIES`, `TranslationKey` and `GameText` takes them from there. The engine stops exporting `EN`, `DE`, `DICTIONARIES`, `TranslationKey`. Tests: the game's existing `game-texts.spec.ts`, `i18n.service.spec.ts`, `evolution.component.spec.ts` move with their imports; JSON dump compared.
   Steps 1 and 2 land as one commit, since neither compiles alone: `refactor(feat-shared-bacteria-engine): move the UI texts into the game`.
3. **Docs**: engine and game `CLAUDE.md` (the root `CLAUDE.md` names no text location; `npm run arch:diagrams` shows only unrelated drift, refreshed by [#3101](https://github.com/WolfSoko/wol-sok-mono/issues/3101)). Commit `docs(feat-shared-bacteria-engine): say where the game's texts live`.
4. **Checks**: `npx nx format:write`; `npx nx affected -t lint,lint-templates,test,typecheck-specs,build`; `nx run feat-shared-bacteria-engine:perf` checksums; a scratch diff touching one German text checked with `nx show projects --affected` and `node tools/ci/release-affected.mjs` (acceptance 1), then dropped.

# Step 2: folders by concern in `state/`

Branch off `main`. Before the move, list the exported names of `src/index.ts`, `src/balance.ts` and `src/testing.ts` into the scratchpad (acceptance 2).

1. **Move script** (scratchpad, Node): the map of the spec's decision 2 as data; `git mv` each file and folder; then, for every `.ts` under `libs/features/bacteria-engine/src/`, resolve each relative specifier (`from '…'`, `import('…')`, `jest.mock('…')`) against the file's old location and rewrite it relative to its new one. A dry run first prints the moves and flags any specifier it cannot resolve.
2. **Run it**, then `npx nx test feat-shared-bacteria-engine`, `typecheck-specs` and `build`. Commit `refactor(feat-shared-bacteria-engine): sort state/ into folders by concern` (renames and import lines only).
3. **Paths outside the engine** (spec decision 4): tools, the functions' emulator spec, the Android README, the `CLAUDE.md` files and the game's `README.md`; `grep` for every old path (acceptance 5). Commit `docs(feat-shared-bacteria-engine): name the engine's files at their new places` (the tool and spec path changes go into the same commit, since they only follow the move).
4. **Checks**: `npx nx format:write`; `npx nx affected -t lint,lint-templates,test,typecheck-specs,build`; `nx run feat-shared-bacteria-engine:perf` (checksums); `bacteria-wars-functions:test`; the export lists compared.
