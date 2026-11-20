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

# Step 3: the `/cloud` entry

Branch off `main`. Before the change, list the exported names of `src/index.ts` into the scratchpad (acceptance 3).

1. **Entry and its spec, test first.** A spec `src/entries.spec.ts` (Node) that reads both entries' exported names through the TypeScript compiler API and fails when `index.ts` exports a name whose declaration lies under `state/cloud/`, or `cloud.ts` one outside it. Then `src/cloud.ts` with the cloud names that have a consumer, the path in `tsconfig.base.json`, the federation skip, `engine-bundle.spec.ts` over both entries; the cloud blocks leave `index.ts`.
2. **Consumers switch** (a scratch script moves each cloud name of an `@wolsok/feat-shared-bacteria-engine` import or `export … from` into a `/cloud` one, then `nx format:write`): `apps/bacteria-wars-functions/src/**`, `libs/features/lazy/bacteria-game/src/**` (`admin-kit.ts` included), `apps/bacteria-game-remote/src/firestore-rules-toggles.spec.ts`. Steps 1 and 2 land as one commit, since neither compiles alone: `refactor(feat-shared-bacteria-engine): take the cloud contract from a /cloud entry`.
3. **Docs**: the root `CLAUDE.md`, the engine's `CLAUDE.md`. Commit `docs(feat-shared-bacteria-engine): name the /cloud entry`.
4. **Checks**: `npx nx format:write`; `npx nx affected -t lint,lint-templates,test,typecheck-specs,build`; `bacteria-wars-functions:test`, `:build`; `bacteria-game-remote:build`; `feat-shared-bacteria-engine:perf` checksums; the export lists compared.

# Step 3b: the `/gpu` entry and the unused names

Branch off `main`. Before the change, list the exported names of `src/index.ts` and each one's consumers outside the engine into the scratchpad (a TypeScript compiler API script over every `@wolsok/feat-shared-bacteria-engine` import of the workspace; acceptance 2 and 3).

1. **Entry and its spec, test first.** Extend `src/entries.spec.ts` with the GPU paths (`index.ts` exports none, `gpu.ts` only those, `/cloud` and `/gpu` disjoint); it fails until `gpu.ts` exists. Then `src/gpu.ts` with the GPU names that have a consumer, the path in `tsconfig.base.json`, `gpu/ng-package.json`, the federation skip, `engine-bundle.spec.ts` over `gpu.ts`; the GPU blocks leave `index.ts`.
2. **Consumers switch** (the scratch script moves each GPU name of a main-entry import into a `/gpu` one, then `nx format:write`): `libs/features/bacteria-rendering/src/**` and `gpu-crosscheck/**`, the game lib's specs and `perf/int-simulation.bench.ts`. Steps 1 and 2 land as one commit, since neither compiles alone: `refactor(feat-shared-bacteria-engine): take the GPU mirror from a /gpu entry`.
3. **Drop the unused names**: the 45 main-entry names without a consumer leave `index.ts` (the 19 GPU ones never enter `gpu.ts`); rerun the consumer scan and the builds of the rendering lib and the game lib, keeping a type only where a build fails to name it. Commit `refactor(feat-shared-bacteria-engine): export only names a consumer imports`.
4. **Docs**: the root `CLAUDE.md`, the engine's `CLAUDE.md`, the rendering lib's `README.md`. Commit `docs(feat-shared-bacteria-engine): name the /gpu entry`.
5. **Checks**: `npx nx format:write`; `npx nx affected -t lint,lint-templates,test,typecheck-specs,build`; `feat-bacteria-rendering:build`, `feat-lazy-bacteria-game:build`, `bacteria-wars-functions:build`, `bacteria-game-remote:build`; `feat-shared-bacteria-engine:perf` checksums; the export lists compared and the index's line count, both in the PR.

# Step 4: the `perf` target reads only what the bench plays

Branch off `main`.

1. **What the bench plays as data.** `tools/perf/engine-bench.json` (entry, fixtures); `engine-bench.mjs` reads it instead of its `ENGINE` and `FIXTURES` constants. Check: the bench reports the baseline's checksums. Commit `refactor(feat-shared-bacteria-engine): read what the engine bench plays from engine-bench.json`.
2. **The spec, test first.** `src/perf-inputs.spec.ts` (Node): bundles the entry of `engine-bench.json` with esbuild (`metafile`), matches every file read and every fixture against the `perf` inputs of `project.json` (`{projectRoot}`/`{workspaceRoot}` replaced, `!` patterns negating, named inputs skipped, `path.matchesGlob`); add `{workspaceRoot}/tools/perf/engine-bench.json` to the engine's `test` inputs. It passes against today's broad inputs; the narrowing of task 3 must keep it green. Then the hand check of acceptance 2 (an import of `state/cloud/` added to a reached file, a folder dropped from the list: both red, reverted).
3. **Narrow the inputs** in the engine's `project.json` as decisions 1, 2 and 5 say; the spec stays green, `nx show target inputs … --check` as acceptance 1. Tasks 2 and 3 land as one commit: `perf(feat-shared-bacteria-engine): read only the files the engine bench plays`.
4. **Docs**: the root `CLAUDE.md`, the engine's `CLAUDE.md`. Commit `docs(feat-shared-bacteria-engine): say what the perf target reads`.
5. **Checks**: `npx nx format:write`; `npx nx affected -t lint,lint-templates,test,typecheck-specs,build --base=origin/main`; `npx nx test tools`; the bench's checksums; `node tools/ci/release-affected.mjs --base=origin/main --head=HEAD --target=deploy 2>/dev/null` for the PR.
