# Plan: test-only files still count as production inputs ([#3205](https://github.com/WolfSoko/wol-sok-mono/issues/3205))

Spec: [docs/specs/3205-release-namedinputs-production-still-counts-apps-e2e-and-rules-test-folders-so-test-only-changes-redeploy-apps.md](../specs/3205-release-namedinputs-production-still-counts-apps-e2e-and-rules-test-folders-so-test-only-changes-redeploy-apps.md)

## Task 1: guard test, red

- Test first: `tools/ci/test-only-inputs.test.mjs` (pure helper
  `unexcluded(production, files)` with unit cases, then the workspace case
  over `gitLsFiles` and `readProjects` from `workspace-projects.mjs`, as
  `test-only-vite-configs.test.mjs` does). Run `node --test
  tools/ci/test-only-inputs.test.mjs`: fails on the e2e, rules-test,
  `tsconfig.e2e.json` and `jest.config.cts` files.

## Task 2: `nx.json` production, green

- `nx.json` `namedInputs.production`: `!{projectRoot}/jest.config.*` in
  place of `!{projectRoot}/jest.config.[jt]s`; add
  `!{projectRoot}/tsconfig.e2e.json`, `!{projectRoot}/e2e/**/*`,
  `!{projectRoot}/rules-test/**/*`.
- Test: the guard passes; the per-file `release-affected.mjs` table of the
  spec's acceptance 1 and 2; `nx show target inputs` for acceptance 3.
- Commit (tasks 1, 2 and the docs together, one behaviour):
  `fix(nx): keep e2e, rules-test and every jest config out of production inputs`

## Task 3: docs

- `CLAUDE.md`, Testing: one sentence that `production` leaves out a
  project's `e2e/`, `rules-test/`, `tsconfig.e2e.json` and `jest.config.*`,
  kept by `tools/ci/test-only-inputs.test.mjs`.

## Checks

`npx nx test tools`, `npx nx lint tools`, `npx nx format:write`,
`npx nx affected -t lint,lint-templates`.
