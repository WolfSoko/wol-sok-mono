# Lint: script and config files outside tools/ belong to no tsconfig

Issue: [#3133](https://github.com/WolfSoko/wol-sok-mono/issues/3133)

## Goal

Every git-tracked script file that oxlint lints belongs to the program of its nearest `tsconfig.json` (that config or a project it references), so type-aware oxlint types each file the same way in `nx lint <project>`, a batched `nx run-many -t lint` and `npx oxlint .`. A workspace-wide guard test keeps it so, replacing the `tools/`-only one from #3074.

## Survey (2026-11-19, `main` at 8d94d6a0)

A script is any tracked `*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}` except declaration files. Unowned outside `tools/`:

| Nearest `tsconfig.json`                                                                       | Unowned files                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| none (root)                                                                                   | `jest.config.ts`, `jest.preset.cjs`, `eslint.config.mjs`, `commitlint.config.ts`, `lint-staged.config.js`, `.versionrc.cjs`, `.agents/skills/monitor-ci/scripts/*.mjs` (2), `.github/skills/monitor-ci/scripts/*.mjs` (2), `__checks__/angular-examples.check.js` |
| `apps/{angular-examples,bacteria-game-remote,fourier-analysis-remote,shader-examples-remote}` | `federation.config.js`                                                                                                                                                                                                                                            |
| `apps/ws-thanos-test-app`                                                                     | `playwright.config.ts`, `e2e/ws-thanos.spec.ts`                                                                                                                                                                                                                   |
| `libs/features/lazy/tensorflow-examples`                                                      | five `*.component.cy.ts`                                                                                                                                                                                                                                          |
| `libs/public/spa-cdk-stack`                                                                   | `test-nested-build-path/main.js` (`test-build-path/` is in oxlint's `ignorePatterns` already)                                                                                                                                                                     |
| `libs/shared/e2e-server`                                                                      | `src/wait-for-server.mjs`                                                                                                                                                                                                                                         |

## Non-goals

- **No new lint target for the root files.** The root project `wolsok` has no `lint` target, so the root scripts, `.agents/`, `.github/` and `__checks__/` are linted only by a whole-workspace `npx oxlint .`. Whether they should get an Nx target is a separate question (raised to the manager as a follow-up).
- **No change to the scripts' code** beyond what lint then reports, and no edit of the vendored `monitor-ci` skill scripts.
- **No change to type-aware rules or oxlint options.**

## Decisions

- **A lint-only root `tsconfig.json`** owns the root scripts, `.agents/`, `.github/` and `__checks__/`. It extends nothing (no `paths`, no `baseUrl`), has `allowJs`, `noEmit`, `module: preserve`, `moduleResolution: bundler`, `types: ["node"]` and `skipLibCheck`, and an explicit `include` (dot folders need explicit patterns: TypeScript's `**` skips them). Reasons: oxlint takes the nearest `tsconfig.json`, and the root files cannot move. Checked side effects: `tsx` without `--tsconfig` now reads it, but it sets none of the options tsx applies (`paths`, `jsx*`, decorators, `useDefineForClassFields`), so `tools/version-handling/latest-non-cdk-deployed-tag.ts` runs the same; Jest's ts-node load of a `jest.config.ts` still works (`nx test shared-e2e-server` green, direct `ts-node` register checked); `nx show projects --affected --files=tsconfig.json` names only `wolsok` and `tools`, neither has a `deploy`, so the change releases nothing. CLAUDE.md's "a root `tsconfig.json`, which the workspace lacks" is reworded: scripts still pass `--tsconfig tools/tsconfig.tools.json`, since the root config holds no aliases.
- **Federation configs** go into each app's `tsconfig.editor.json` `include` (already referenced, `allowJs` from the base; excluded from `production` inputs, so no release), which also gets `noEmit`: with a JS input and no `outDir`, TypeScript refuses the config ("would overwrite input file") and oxlint reports `tsconfig-error`.
- **ws-thanos-test-app** gets a `tsconfig.e2e.json` (as pacetrainer and rollapolla-analog have) with `playwright.config.ts` and `e2e/**/*.ts`, referenced from its `tsconfig.json`.
- **The tensorflow `*.cy.ts` files are deleted**: Cypress is no dependency of the workspace any more, nothing runs them (`cy.mount` is undefined), so they are dead code rather than files to own.
- **spa-cdk-stack's `test-nested-build-path/`** is a build-output fixture like `test-build-path/`: it joins `ignorePatterns` in `.oxlintrc.json` (`**/test-nested-build-path/**`) instead of a tsconfig.
- **e2e-server's `src/wait-for-server.mjs`** goes into `tsconfig.lib.json`'s `include` (`src/**/*.mjs`); the lib has no build, so nothing is emitted.
- **One guard test for the workspace**: `tools/ci/script-tsconfig.test.mjs` replaces `tools/ci/tools-tsconfig.test.mjs`. For every tracked script not matched by `.oxlintrc.json`'s `ignorePatterns`, it finds the nearest `tsconfig.json` and asserts the file is in that config's program or a referenced one (transitively), listing the unowned files grouped by config. The old "only tsconfig.json under tools/" case goes: checking the nearest config of every file covers nested configs.
- **The guard runs outside Nx in CI too**, as `target-inputs.test.mjs` does: a new file in an app makes only that app affected, never `tools`, so `tools:test` would miss it. `ci-cd.yml` gets the uncached step "Scripts belong to their tsconfig" (`node --test tools/ci/script-tsconfig.test.mjs`) beside "Target inputs name existing files", and the test checks that the step exists without `if:` or `continue-on-error`. The `stepBlock` helper both tests need moves into `tools/ci/workspace-projects.mjs`.

## Acceptance

1. `node --test tools/ci/script-tsconfig.test.mjs` passes, and fails (naming the file) when an unowned script is added, e.g. a stray `apps/pacetrainer/x.mjs`.
2. `tools/ci/tools-tsconfig.test.mjs` is gone; `npx nx test tools` passes.
3. `ci-cd.yml` runs the guard as its own step; the test fails when the step is missing or gets `if:`/`continue-on-error`.
4. `npx oxlint .` reports no new findings compared with `main` (type-aware, same counts), and `npx nx affected -t lint,lint-templates,test` passes.
5. `npx nx test shared-e2e-server` and `npx tsx ./tools/version-handling/latest-non-cdk-deployed-tag.ts` still work with the root `tsconfig.json`.
6. No `*.cy.ts` file is left in the workspace.
7. CLAUDE.md names the new guard and the root `tsconfig.json`, and no longer says the workspace lacks one.
8. `npx nx format:check` passes.

## Open questions

- None blocking. Follow-up for the manager: the root project has no `lint` target, so root scripts, `.agents/`, `.github/` and `__checks__/` are only linted by a whole-workspace run.
