# Bacteria engine: the UI texts out of the engine

Issue: [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103)

## Goal

`feat-shared-bacteria-engine` holds the game's UI texts (`src/lib/i18n/en/`, `de/`, 3,183 lines in 21 areas a language) next to the deterministic simulation. Every copy edit therefore reruns the engine's `perf` gate, its golden specs and `engine-bundle.spec.ts`, and redeploys `bacteria-wars-functions` (`--force`), although no function shows these texts.

This change is step 1 of the issue: the texts the engine does not render leave the engine, so a change to one of them affects neither `feat-shared-bacteria-engine` nor `bacteria-wars-functions`.

## Non-goals

- Steps 2 to 4 of the issue (folders by concern in `state/`, the `/cloud` entry, narrower `perf` inputs). They follow as later PRs of [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103) (see Decided questions).
- No change to a text, a key path or what a screen shows.
- No change to what the simulation computes: no `BALANCE_VERSION` bump, goldens unchanged.
- The public replay pages' texts (`apps/bacteria-wars-functions/src/site/`) and the admin's own dictionaries stay as they are.

## What the code shows

- The engine **renders English at runtime**: `english()` (`i18n/game-text.ts`) fills `Achievement.name`/`condition`, `GameMap.name` of a generated level, `XpPart.label`, `ONLINE_LOCKS`, `ladderLocks`, the medallion and win-condition hints and the unlock locks, from the dictionary `EN`. The keys it builds come from four areas only: `achievements`, `game`, `levels` and `training` (457 of the 1,593 English lines).
- The game builds `GameText`s of its own with keys of other areas (`boards`, `online`, `settings`, `newGame`, …), so `GameText.key` cannot simply narrow to the engine's keys.
- Module boundaries (`.oxlintrc.json`): `feat-shared` may depend only on `shared`, `utils`, `api`; the game (`feature:lazy`) only on `feat-shared`, `shared`, `utils`, `api`. A new `feat-shared` texts lib could therefore not import the engine's English areas or its `Translation` type, and a `feature` texts lib could not be imported by the game.

## Decisions

1. **The engine keeps the English texts it renders, nothing else.** `en/achievements.ts`, `en/game.ts`, `en/levels.ts`, `en/training.ts` stay in the engine as `ENGINE_EN` (`i18n/engine-texts.ts`) with `EngineTextKey = EntryPath<typeof ENGINE_EN>`; `english()` renders from it. Reason: the engine stores these strings in its state (a generated level's map name, an achievement's name), so they are engine output; moving them out would mean changing every consumer of those fields first (about 110 lines in the game), a larger change better made on its own if wanted.
2. **All other texts move into the game lib**, `libs/features/lazy/bacteria-game/src/lib/i18n/texts/`: the 17 other English areas, all 21 German areas (the German ones of the engine's four areas typed `Translation<typeof …>` against the engine's English, so a missing or extra German key still fails to compile), and `dictionaries.ts` with `EN` (the engine's four areas plus the game's), `DE`, `DICTIONARIES` and `TranslationKey`. Reason: the game is their only consumer (the admin takes `TranslationKey` through the game's `admin-kit`), it already depends on the engine, and it needs no new tag rule. The issue's own lib (`feat-shared-bacteria-texts`) would need either `feat-shared → feat-shared` or a new tag allowed for `feature:lazy`, plus a federation skip in all four apps, for no consumer beyond the game.
3. **`GameText` becomes generic over its key**: `GameText<K extends string = EngineTextKey>`, `Translate<K>` and `renderGameText<K>` likewise; `english()` takes the engine's `GameText` only. The game defines its `GameText` as `GameText<TranslationKey>` from `i18n/game-texts.ts`, its existing text module, and its files import it from there. An engine `GameText` is assignable to the game's, since `EngineTextKey` is a subset of `TranslationKey`, so the key check stays at compile time on both sides.
4. **The engine's index** stops exporting `DE`, `DICTIONARIES`, `EN` and `TranslationKey` and exports `ENGINE_EN` instead (plus the generic `GameText`; `GameTextParams`, `Translate` and `EngineTextKey` stay internal, as nothing outside uses them). The mechanics (`translation.ts`, `language.ts`, `game-text.ts`) stay.
5. **Docs**: the engine's and the game's `CLAUDE.md` say where texts live and that a text the engine renders goes into its four areas. `docs/architecture/README.md` stays as it is: the change adds no project and no dependency (the game already depends on the engine), and the diagrams' drift since their last run is refreshed by its own PR ([#3101](https://github.com/WolfSoko/wol-sok-mono/issues/3101)).

## Acceptance

1. A diff changing only a file under `libs/features/lazy/bacteria-game/src/lib/i18n/texts/` makes neither `feat-shared-bacteria-engine` nor `bacteria-wars-functions` affected (`nx show projects --affected` on that diff), and `tools/ci/release-affected.mjs` on it selects no functions deploy.
2. The engine holds no German text and no English area it does not render: `libs/features/bacteria-engine/src/lib/i18n/` has no `de/` and only the four English areas.
3. A German area missing a key, or holding one too many, still fails to compile (spec-typecheck or build of the game).
4. Every key and every text is unchanged: a JSON dump of `EN` and `DE` taken before the move equals the one after it (checked during the work, noted in the PR, not committed).
5. Golden replays (`golden-replay.spec.ts`), GPU goldens and the `perf` checksums are unchanged; no `BALANCE_VERSION` bump.
6. `npx nx affected -t lint,lint-templates,test,typecheck-specs,build` green; no new project or dependency edge, so no cycle and no tag violation (boundaries lint green).

## Decided questions

- **Scope** (manager, request 1239): this PR delivers step 1 and leaves [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103) open (`Part of [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103)`). Steps 2 to 4 stay later PRs of [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103), no sub-issues.
- **Texts in the game lib** instead of a lib of their own (decision 2): approved as written.

# Step 2: folders by concern in `state/`

Step 1 landed in [#3118](https://github.com/WolfSoko/wol-sok-mono/pull/3118). This section is the spec for step 2.

## Goal (step 2)

`libs/features/bacteria-engine/src/lib/state/` is one flat folder of 76 source files (with their specs and three data files) beside five sub-folders. After this step each concern has a folder of its own and the top level keeps only the three helpers every concern uses, so a reader sees which part of the engine a file belongs to before opening it, and step 3 can name the cloud contract's files by folder.

## Non-goals (step 2)

- No API change: `src/index.ts`, `src/balance.ts` and `src/testing.ts` export exactly the same names; only their `from` paths change. No consumer outside the engine changes an import (none imports a path inside it).
- No code change inside a moved file beyond its import paths: no rename of a file or symbol, no split, no merge.
- No change to what the simulation computes: goldens, GPU goldens and the `perf` checksums unchanged, no `BALANCE_VERSION` bump.
- Steps 3 (the `/cloud` entry) and 4 (narrower `perf` inputs) stay later PRs.
- The old specs and plans under `docs/` keep the paths they were written with (they record what was true then).

## Decisions (step 2)

1. **Six folders, not the issue's five.** The issue puts the match engine and the bots into `simulation/`; that folder would hold 31 files, the flat folder again. `simulation/` is the deterministic physics both rulesets share (what `gpu-int` mirrors and the goldens pin); `match/` is the loop around it: the engine, its run, setup, win conditions, the bots and the computer opponent.
2. **The map** (every spec, JSON and folder moves with its file):

   | Folder        | Files                                                                                                                                                                                                                                                                                                                                               |
   | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `simulation/` | `bacteria-simulation`, `simulation`, `simulation-provider`, `simulation-report`, `grid-format`, `cells`, `arena-fixtures`, `arena-size`, `nutrient-pellets`, `weapon-effects`, `evolution`, `game-balance`, `fixed-tick`; the folders `gpu-int/` and `grid/`                                                                                        |
   | `match/`      | `match-engine`, `match-run`, `match-setup`, `game-mode`, `frame-pacer`, `win-conditions`, `checksum`, `perf-probe`, `bot-controller`, `bot-navigation`, `bot-senses`, `recent-cache`, `neutral-brain` (with `neutral-colonies.spec`), `computer-opponent`, `expected-player`, `difficulty-curve`, `rivalry`, `player.model`, `evolution-match.spec` |
   | `levels/`     | `maps`, `expanse-maps`, `organic-maps`, `outbreak-maps`, `reactor-maps`, `shapes`, `zones`, `game-maps`, `training-levels`, `levels`, `match-level`, `campaign`, `chapters`, `daily`, `endless`, `training`; `level-generator/` as `levels/generator/`                                                                                              |
   | `replay/`     | `replay`, `replay-id`, `replay-link`, `replay-pack`, `replay-reasons`, `replay-score`, `replay-verdict`, `ghost`, `golden-replay.json` with `golden-replay.spec`, `golden-match.spec`                                                                                                                                                               |
   | `progress/`   | `achievement-ids`, `achievements`, `medallions`, `xp`, `earnings`, `progress`, `evolution-progress`, `unlocks`, `ranks`, `skins`, `colony-colors`, `colony-looks`, `play-games-achievements.json` with its spec                                                                                                                                     |
   | `cloud/`      | `boards`, `attempts`, `ranked-match`, `admin-commands`, `command-documents`, `feature-toggles`; `cloud-records/` as `cloud/records/`                                                                                                                                                                                                                |
   | top level     | `geometry`, `is-object`, `base64` (helpers of every concern); `balance/` stays (the `/balance` entry's lab)                                                                                                                                                                                                                                         |

   Reasons for the borderline ones: `evolution` (the traits and weapons) and `fixed-tick` (the tick clock) are read by the physics itself; `difficulty-curve`, `expected-player` and `computer-opponent` choose the computer's strength, which is match setup; `colony-colors`, `colony-looks` and `skins` are unlocked looks; `match-level` picks an online match's level from the ladder; `ranked-match` is the declared attempt, next to `attempts`.

3. **The move is one mechanical commit, made by a script** (`git mv` per entry, then every relative specifier in `libs/features/bacteria-engine/src/**` recomputed from the old to the new location), so git shows renames and a reviewer can rerun it. The script lives in the scratchpad, not the repo: it is used once.
4. **Paths outside the engine** that name a moved file are updated in the same PR: `tools/perf/engine-bench.mjs` (the golden replay), `tools/bacteria-game/play-games.ts`, `apps/bacteria-wars-functions/src/replays/replays.emulator.ts` (the golden replay), `apps/bacteria-wars-android/README.md`, the root `CLAUDE.md`, the engine's and the game's `CLAUDE.md` and the game's `README.md` where they name an engine file.
5. **Release effect accepted**: the move touches the engine's sources, so its release redeploys `bacteria-wars-functions` and the game once, with code that behaves the same.

## Acceptance (step 2)

1. `state/` holds at its top level only `geometry.ts`, `is-object.ts` (with its spec), `base64.ts` and the folders `simulation/`, `match/`, `levels/`, `replay/`, `progress/`, `cloud/`, `balance/`.
2. `src/index.ts`, `src/balance.ts` and `src/testing.ts` export the same names as before (a sorted list of their exported names, compared before and after, noted in the PR).
3. `git diff -M --stat` shows every moved file as a rename; no moved file changes beyond its import lines.
4. Golden replays (`golden-replay.spec.ts`, `golden-match.spec.ts`), GPU goldens (`golden.spec.ts`, `sim-golden.spec.ts`, `self-test-golden.spec.ts`) and the `perf` checksums unchanged; no `BALANCE_VERSION` bump.
5. No path in the repo outside `docs/specs` and `docs/plans` names a moved file at its old place (`grep` over the old paths).
6. `npx nx affected -t lint,lint-templates,test,typecheck-specs,build` green, plus `npx nx run feat-shared-bacteria-engine:perf` and `bacteria-wars-functions:test`.

# Step 3: the `/cloud` entry

Step 2 landed in [#3129](https://github.com/WolfSoko/wol-sok-mono/pull/3129). This section is the spec for step 3.

## Goal (step 3)

The documents the game, `bacteria-wars-functions` and the admin exchange (the boards, the attempts, the commands, the cloud records and the feature toggles) are described in `state/cloud/`, but reach every consumer through the one main entry, so no import says whether it takes the contract with the server or the match's internals. After this step they come from `@wolsok/feat-shared-bacteria-engine/cloud`, and the main entry no longer exports them.

## What the code shows (step 3)

- The main index (`src/index.ts`, 815 lines) exports 658 names: 126 from `state/cloud/` (154 lines), 84 of the GPU mirror (`simulation/gpu-int/`, `simulation/grid/`, `grid-format`, about 120 lines, used only by `feat-bacteria-rendering` and the game's GPU path), 448 others.
- Outside the engine, the cloud names are imported by `bacteria-wars-functions` (about 25 files), the game lib (about 32 files, `admin-kit.ts` included, which hands them on to the admin) and `bacteria-game-remote`'s `firestore-rules-toggles.spec.ts`. 21 of the 126 are imported by nobody outside the engine (`canDeclare`, `requiredAttempt`, `ToMillis`, `REPLAY_COMMAND_TYPES`, `XP_RISE_BASE`, …).
- `state/cloud/` imports from `simulation/`, `levels/`, `progress/`, `replay/` and `social/profile` (an attempt's level and arena, a board's tick cap, the avatar count). An entry of the same project may: the boundary rule counts the entry as the engine.
- The other entries (`/balance`, `/testing`) are a `src/<name>.ts` with a path in `tsconfig.base.json`; the engine's `build` (ng-packagr) builds `src/index.ts` only, and `tsconfig.lib.json` includes every non-spec `.ts`, so its `typecheck` covers a new entry file too. `engine-bundle.spec.ts` bundles `index.ts` alone.

## Decisions (step 3)

1. **The entry is the folder.** `src/cloud.ts` exports what `state/cloud/` (with `records/`) holds and something outside the engine imports, nothing else; the main index drops every name of that folder. `social/profile` (the player's profile document) stays in the main entry: the game's UI uses it for names and avatars as much as the server for its document, and it lives outside `state/cloud/`. Reason: one rule a reader can check by path ("from `state/cloud/` → `/cloud`").
2. **The 21 cloud names nobody outside the engine imports are not exported** by `/cloud`. They stay exported in their files, for the engine's own specs. Reason: the entry is the contract; a name enters it with its first consumer.
3. **Every consumer switches**: the functions, the game (its `admin-kit.ts` re-exports from `/cloud`, so the admin's imports stay as they are) and the remote's rules spec. A file that needs both takes two imports.
4. **Wiring**: the path `@wolsok/feat-shared-bacteria-engine/cloud` in `tsconfig.base.json`; an ng-packagr secondary entry `cloud/ng-package.json` (entry file `../src/cloud.ts`), since the game lib's `build` compiles against the engine's `dist`, into which Nx maps `…/cloud` (`dist/libs/features/bacteria-engine/cloud`; `/balance` and `/testing` need none, as no built lib imports them); the skip in `tools/federation/workspace-federation.js` beside the engine's other entries (the shell and every remote skip it alike); `engine-bundle.spec.ts` bundles `cloud.ts` too (Node only, no Angular, RxJS, Firebase). The `perf` bench bundles `index.ts` and uses no cloud name.
5. **Docs**: the root `CLAUDE.md` (Cloud Functions: "the documents … are described once, in the engine's `state/cloud/records/`", the federation skip list) and the engine's `CLAUDE.md` name the entry. `docs/architecture/README.md` is unchanged: no project and no edge is added.
6. **Release effect accepted**: the engine's, the game's and the functions' sources change, so the release redeploys `bacteria-wars-functions` and the game once, with code that behaves the same.

## Acceptance (step 3)

1. `src/index.ts` exports no name defined under `state/cloud/`; `src/cloud.ts` exports only such names (a spec over both entries' exported names checks it).
2. Outside the engine, no file imports a name of `state/cloud/` from the main entry (the TypeScript build fails where one does, since the name is gone).
3. Every name the main index exported before is exported by exactly one of the two entries afterwards, except the 21 unused cloud names (sorted lists compared, noted in the PR).
4. The engine's bundle check passes for `cloud.ts`; golden replays, GPU goldens and the `perf` checksums unchanged, no `BALANCE_VERSION` bump.
5. `npx nx affected -t lint,lint-templates,test,typecheck-specs,build` green, plus `bacteria-wars-functions:test`, `bacteria-wars-functions:build` and `bacteria-game-remote:build` (the federation build with the new skip).

## Decided question (step 3)

- **The issue's "`src/index.ts` well under half its 791 lines"** is out of reach for `/cloud` alone: the cloud is 126 of 658 names, and the index ends at about 660 lines (about 84%). Decided (manager, request 1353): this step is a pure move of the cloud contract, with acceptance 1 in place of the line count; a later step 3b of [#3103](https://github.com/WolfSoko/wol-sok-mono/issues/3103) adds a `/gpu` entry for the GPU mirror (84 names, the rendering lib's contract) and drops the names nobody outside the engine imports, which brings the index to about 470 lines.

# Step 3b: the `/gpu` entry and the unused names

Step 3 landed in [#3139](https://github.com/WolfSoko/wol-sok-mono/pull/3139) (released with 74.172.7). This section is the spec for step 3b, decided in request 1353.

## Goal (step 3b)

The main entry still mixes the GPU mirror of the simulation, which only `feat-bacteria-rendering` and specs take, with the rest of the engine, and it exports names no consumer imports. After this step the GPU mirror comes from `@wolsok/feat-shared-bacteria-engine/gpu`, and the main entry exports only names something outside the engine imports.

## What the code shows (step 3b)

- After step 3 the main index (`src/index.ts`, 662 lines) exports 532 names. 84 are declared under `simulation/gpu-int/`, `simulation/grid/` and `simulation/grid-format.ts` (the GPU mirror, about 120 lines of the index).
- Of those 84, `feat-bacteria-rendering` imports 47 in its sources and further ones in its specs and `gpu-crosscheck/` (32 in all, partly the same), the game lib 6, all in specs and `perf/int-simulation.bench.ts` (`intSimulation`, `GPU_SELF_TEST_VERSION`, `scenarioRandom`, `skirmish`, `SimScenario`, `GridWar`). The functions, the sound lib and `tools/` import none of them; the `perf` bench plays replays through `playReplay` and names no GPU export.
- 64 of the 532 names are imported by nothing outside the engine: 19 of the GPU mirror (`drawAt`, `pcg3d`, `mulQ14`, `isqrt`, `IntReferencePasses`, `IntGrid`, …) and 45 others (`escapeReach`, `computerProfile`, `GhostController`, `packReplay`, `unpackReplay`, `MAX_TICKS`, `replayEngine`, `playbackRefusal`, `decodeReport`, 20 of them types such as `PlayableReplay`, `ReplaySeat`, `MatchRunResult`, `ArenaSize`). The engine's own specs take them by relative path. Another 46 names are imported only by specs outside the engine; they have consumers and stay.
- The GPU folders import from `simulation/` (`game-balance`, `evolution`, `bacteria-simulation`, `simulation-report`, `arena-fixtures`), `levels/` and `match/player.model`. `GridWar implements Simulation`, and its public members take and return plain data and interfaces (`GameMap`, `Player`, `ColonySummary`, `ActiveEffect`), no engine class.
- `feat-bacteria-rendering` builds with ng-packagr (`@nx/angular:ng-packagr-lite`), like the game lib, so it compiles against the engine's `dist` (learning L530 of step 3).

## Decisions (step 3b)

1. **The entry is the folder**, as for `/cloud`: `src/gpu.ts` exports what `simulation/gpu-int/`, `simulation/grid/` and `simulation/grid-format.ts` declare and something outside the engine imports; the main index drops every name of those paths. `simulation-provider.ts` and `simulation-report.ts`, which use the GPU folders, stay in the main entry: they serve the CPU simulation too. Reason: one rule by path, checked by `entries.spec.ts`.
2. **A name without a consumer outside the engine leaves both entries** (the 19 GPU and 45 other names); it stays exported in its file for the engine's specs, and enters an entry again with its first consumer. Types that appear in the signature of an exported function go too: a consumer infers them. Should a consumer's ng-packagr build then fail to name an inferred type (TS2742), that type stays in its entry: the build proves it has a consumer. Reason: the entry is the contract, as decided for `/cloud`.
3. **Consumers switch**: `feat-bacteria-rendering` (sources, specs, `gpu-crosscheck/`) and the game lib's specs and bench take the GPU names from `/gpu`; a file that needs both takes two imports. No other consumer changes.
4. **Wiring as for `/cloud`**: the path `@wolsok/feat-shared-bacteria-engine/gpu` in `tsconfig.base.json`; the ng-packagr secondary entry `gpu/ng-package.json` (entry file `../src/gpu.ts`), since the rendering lib's `build` compiles against the engine's `dist`; the skip in `tools/federation/workspace-federation.js` beside the other entries; `engine-bundle.spec.ts` bundles `gpu.ts` too (Node only). The `/gpu` signatures expose no engine class (see above), so the second copy in its `dist` does not clash with the main entry's in the rendering build; that build is the proof.
5. **`entries.spec.ts`** grows a second folder rule: `index.ts` exports nothing declared under the GPU paths, `gpu.ts` nothing outside them, `cloud.ts` and `gpu.ts` nothing of each other's folders.
6. **Docs**: the root `CLAUDE.md` (the federation skip list, "its engine (`@wolsok/feat-shared-bacteria-engine`, with …)"), the engine's `CLAUDE.md` (entries, "a new export goes into the index, unless …", the bundle check) and the rendering lib's `README.md` ("depends only on `@wolsok/feat-shared-bacteria-engine`") name the entry. `docs/architecture/README.md` is unchanged: no project and no edge is added.
7. **Release effect accepted**: the engine's and the rendering lib's sources change, so the release redeploys `bacteria-wars-functions` and the game once, with code that behaves the same.

## Non-goals (step 3b)

- No guard that keeps unused names out of the main entry from now on (a workspace-wide consumer scan in a spec); the rule stands in the engine's `CLAUDE.md`, as for `/cloud`.
- No renaming, no moving of files, no change to what a name does.
- Step 4 (narrowing `perf`'s inputs) stays its own step.

## Acceptance (step 3b)

1. `src/index.ts` exports no name declared under the GPU paths or `state/cloud/`; `src/gpu.ts` exports only names declared under the GPU paths (`entries.spec.ts`).
2. Every name `src/index.ts` exports after the change is imported by a file outside the engine (the consumer scan's list, empty, in the PR), except a type kept by decision 2 (named in the PR).
3. Every name the main index exported before is exported by exactly one of `index.ts` and `gpu.ts` afterwards, except the dropped ones, which are listed in the PR (sorted lists compared).
4. The engine's bundle check passes for `gpu.ts`; golden replays, GPU goldens (`golden.spec.ts`, `sim-golden.spec.ts`, `self-test-golden.spec.ts`) and the `perf` checksums unchanged, no `BALANCE_VERSION` or `GPU_SELF_TEST_VERSION` bump.
5. `npx nx affected -t lint,lint-templates,test,typecheck-specs,build` green, plus `feat-bacteria-rendering:build`, `feat-lazy-bacteria-game:build`, `bacteria-wars-functions:build` and `bacteria-game-remote:build` (the federation build with the new skip).

## Open question (step 3b)

- **The issue's "`src/index.ts` well under half its 791 lines"** (under about 395): with `/gpu` and the 45 names gone, the index ends at about 500 lines (from 662), counted in the PR. Recommendation: close #3103's step 3 criterion with the name rules (acceptance 1 and 2) in place of the line count, as request 1353 did for step 3; what remains in the index is the simulation, replay, levels and progress the game, the functions and the rendering lib really import.
