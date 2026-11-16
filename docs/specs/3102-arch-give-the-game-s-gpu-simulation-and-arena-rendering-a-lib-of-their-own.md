# Bacteria Wars: the GPU simulation and the arena rendering in a lib of their own

Issue: [#3102](https://github.com/WolfSoko/wol-sok-mono/issues/3102), tracked in [#2370](https://github.com/WolfSoko/wol-sok-mono/issues/2370)

## Goal

`feat-lazy-bacteria-game` (about 46k lines of source, 172 spec files) holds two folders that form a subsystem of their own: `src/lib/gl/` (the GPU simulation, its shaders and the self-test, 3.8k lines) and `src/lib/arena/` (the painters, the WebGL arena painter, the shaders, the camera, 11.5k lines). Move them, with the GPU cross-check (`gpu-crosscheck/`, `playwright.config.ts`), into a project of their own, so that:

- a change to the game's menus, sound, state or network no longer makes the GPU cross-check, its Jest goldens or the rendering specs affected;
- the rest of the game reaches the rendering only through the new lib's public API (`src/index.ts`), not through relative paths into single files;
- "this PR touches the GPU code" is a fact of the Nx graph.

No behaviour changes: the same code runs, only its project changes.

## Non-goals

- `src/lib/sound/` into a lib of its own: the follow-up PR the issue names (step 5).
- Splitting or reworking any painter, shader or the GPU simulation.
- The manual device check on a real GPU is the owner's (CLAUDE.md, Performance Gates): CI has no GPU. The PR asks for it.

## Decisions

1. **Name, place, tag.** `libs/features/bacteria-rendering`, project `feat-bacteria-rendering`, alias `@wolsok/feat-bacteria-rendering`, selector prefix `feat-bac-render`, tag `feature:game-kit`.
   - Not `feat-shared`: the lib depends on the engine (`feat-shared`), and `feat-shared` may depend only on `shared`, `utils`, `api`. Opening `feat-shared → feat-shared` would loosen the rule for the Node-only engine and the basketball libs too.
   - `.oxlintrc.json` gets the constraint `feature:game-kit → feat-shared, shared, utils, api`, and `feature:game-kit` joins what `feature:lazy` and `feature:admin` may depend on. Since the project's name drops `-shared-`, nobody reads it as one of the shared libs.
2. **The two Angular services stay in the game.** `SimulationOverrideService` and `GpuSelfTestService` (`gl/*.service.ts`) wire the GPU choice to the game's device storage and analytics; nothing in `gl/` or `arena/` injects them, only the game's stage, menu, replays and ranked service do. They move to the game lib's `src/lib/gpu-choice/` with their specs. The issue's alternative, a port (injection token) the game provides, would add an abstraction only these two services use; keeping them where their dependencies are needs none. `simulation-check.ts` (`gpuTrusted`, `simulationCheckLines`) goes with them: its lines are keys of the game's settings texts, which #3103 moves out of the engine into the game lib, where the rendering lib cannot reach them. The pure parts with no game texts (`gpu-self-test.ts`, `stored-self-test.ts`, `simulation-choice.ts`) move with `gl/`.
3. **`player-color.ts` and `reduced-motion.ts` move with `arena/`.** The arena imports them, and they import the arena (`player-color` takes `Rgb` and `rgba` from it): they belong to the rendering. Their game-side importers take them through the new lib's index.
4. **Folder layout inside the new lib:** `src/lib/gl/`, `src/lib/arena/` (with its `gl/` painter folder as today), `src/lib/player-color.ts`, `src/lib/reduced-motion.ts`; `gpu-crosscheck/` and `playwright.config.ts` at the project root, as today. Relative imports between the moved files stay as they are.
5. **Public API.** `src/index.ts` exports exactly what files outside the moved folders import today (about 36 files: menu previews, replay viewer and scene, stage, `GameStateService`, `PlayerService`, HUD, ranked service). No `export *` of whole folders: the index lists names, so a painter's internals stay internal. Specs of the game that import internals for fakes get them through the index too; a name exported only for specs goes into a `testing` entry only if one is needed.
6. **Component selectors** change from `feat-lazy-bac-game-arena-view` / `-look-preview` to `feat-bac-render-arena-view` / `-look-preview`; `eslint.config.mjs` gets the prefix in `selectorPrefixes`, and the three templates and the replay viewer's spec using them follow.
7. **Project setup** copies the game lib's: buildable with `@nx/angular:ng-packagr-lite` (a buildable lib cannot import a non-buildable one), Jest with `jest-preset-angular` zoneless setup, `typecheck-specs`, `tsconfig.*` as the game's, a `package.json` with its peer dependencies, MIT. The Playwright plugin infers the cross-check as the new lib's `e2e-ci--gpu-crosscheck/gpu-int.crosscheck.ts`.
8. **Federation.** `@wolsok/feat-bacteria-rendering` is skipped in `tools/federation/workspace-federation.js` beside the game lib and the engine, so the shell and every remote agree.
9. **Lint overrides follow the files.** The watch entry's `no-restricted-imports` override in `.oxlintrc.json` lists `gl/stored-self-test.ts` and `arena/arena-content.ts`. The boundary rule keeps the new lib off the game's storage (a workspace project); npm packages it keeps off through `bannedExternalImports` on the `feature:game-kit` constraint (Firebase, `@angular/fire`, NgRx), so the ban follows the tag and both lines go. The engine's override drops its old `**/arena/*` and `**/gl/*` patterns: its tag already forbids the rendering lib.
10. **Docs.** CLAUDE.md's GPU cross-check paragraph and the "Native Federation" skip list name the new lib; the game lib's `CLAUDE.md`/`README.md` point to it for rendering and GPU code; `docs/architecture/README.md` is regenerated (`npm run arch:diagrams`).

## Acceptance

1. `gl/`, `arena/`, `player-color.ts`, `reduced-motion.ts`, `gpu-crosscheck/` and `playwright.config.ts` live in `libs/features/bacteria-rendering`, which imports nothing from `feat-lazy-bacteria-game` (`nx graph`: no edge to it; lint green with the boundary rule).
2. A change only to `libs/features/lazy/bacteria-game/src/lib/menu/**` no longer makes the cross-check affected: `nx show projects --affected -t e2e-ci --files=<a menu file>` lists no `feat-bacteria-rendering`, and `feat-bacteria-rendering` is not affected at all.
3. No file outside the new lib imports a path inside it; every import goes through `@wolsok/feat-bacteria-rendering` (grep for `bacteria-rendering/src` and for relative paths into `gl/`/`arena/` from the game finds nothing).
4. `nx run-many -t test,typecheck-specs,lint,lint-templates,build` is green for the game lib, the new lib, the admin lib and `bacteria-game-remote`; the cross-check passes in its new project.
5. `bacteria-game-remote`'s production build stays within its budgets (`anyScript`, `allScript`, `initial`) and `check-lazy-admin.mjs` passes; `angular-examples`' build passes.
6. The game runs standalone (`bacteria-game-remote` e2e smoke) and in the shell (the game route loads); a match paints the arena.
7. `docs/architecture/README.md` shows the new project with no cycle and no tag violation (`npm run arch:diagrams` up to date).

## Open questions

- None blocking. If the manager prefers the issue's tag option (`feat-shared` with `feat-shared → feat-shared` allowed), only decision 1 and the project's name change.
