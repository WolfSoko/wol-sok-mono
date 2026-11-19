# Plan: test-only Vite configs are no production input (#3136)

Spec: [docs/specs/3136-release-test-only-vite-config-files-count-as-production-inputs-and-release-published-libs.md](../specs/3136-release-test-only-vite-config-files-count-as-production-inputs-and-release-published-libs.md)

One PR, branch `3136-test-only-vite-configs`, squash-merged.

## 1. Guard test (red)

- Files: `tools/ci/test-only-vite-configs.test.mjs` (new; helpers from `tools/ci/workspace-projects.mjs`).
- Tests: `production` excludes `{projectRoot}/vitest.config.*` and no `vite.config`; every tracked `vite.config.*` sits in a project building with Vite (no `build` in `project.json`, or `@analogjs/platform:vite` / `@nx/vite:build`). Pure helpers (`isTestOnlyViteConfig`, the `production` check) get cases of their own on fixtures, so the failure paths are covered without changing the workspace.
- Check: `npx nx test tools` fails on the three libs and on `nx.json`.

## 2. Rename and exclude (green)

- Files: `nx.json` (`!{projectRoot}/vitest.config.*` beside `playwright.config`); `libs/public/spa-cdk-stack/{vite → vitest}.config.mts`, `project.json`, `tsconfig.spec.json`, `tsconfig.lib.json`; `libs/shared/analytics/{vite → vitest}.config.mts`, `project.json`, `tsconfig.spec.json`; `libs/shared/data-access/{vite → vitest}.config.mts`, `project.json`, `tsconfig.spec.json`.
- Tests: `npx nx test tools`, `npx nx run-many -t test,build -p spa-cdk-stack,shared-analytics,shared-data-access`, the `release-affected` runs of acceptance 1 and 2.

## 3. Docs

- Files: `CLAUDE.md` (Testing → Unit (Vitest): a project running Vite only for Vitest names its config `vitest.config.mts`, which `production` leaves out).

Steps 1 to 3 go in one commit, `fix(tools): keep test-only Vite configs out of production inputs`, after `npx nx format:write` and `npx nx affected -t lint,lint-templates`.
