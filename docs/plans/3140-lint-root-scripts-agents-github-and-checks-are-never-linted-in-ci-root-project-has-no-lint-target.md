# Plan: lint the root scripts in CI

Spec: [`docs/specs/3140-…`](../specs/3140-lint-root-scripts-agents-github-and-checks-are-never-linted-in-ci-root-project-has-no-lint-target.md),
issue [#3140](https://github.com/WolfSoko/wol-sok-mono/issues/3140).

Branch `3140-lint-root-scripts` off `main`, one PR.

## 1. Guard first

- Files: `tools/ci/root-lint.test.mjs` (new), using `workspace-projects.mjs`
  (`ROOT`, `gitLsFiles`, `readJson`, `stepBlock`, `SKIPPING_KEYS`,
  `CI_WORKFLOW`).
- Tests: the scripts the root `tsconfig.json` is nearest to (the same
  selection as `script-tsconfig.test.mjs`: tracked, not `.d.ts`, outside
  `.oxlintrc.json`'s `ignorePatterns`) each lie under a `lintFilePatterns`
  entry of the root `project.json`'s `lint` target and match one of its
  `{projectRoot}/` inputs; each pattern names a tracked file or folder; the
  target is `@nx/oxlint:lint` and cached; `ci-cd.yml` has the step "Root
  scripts are linted" running the test, with no skipping key.
- Red: no root `project.json` yet.
- Commit: `test(tools): guard that the root scripts are linted (#3140)`
  (squashed with 2 if the hook requires green).

## 2. Root `lint` target and CI step

- Files: `project.json` (new, name `wolsok`, the `lint` target of spec
  decisions 2 and 3), `.github/workflows/ci-cd.yml` (step "Root scripts are
  linted" after "Scripts belong to their tsconfig").
- Checks: `node --test tools/ci/root-lint.test.mjs` green;
  `npx nx run wolsok:lint` green, red with a planted error;
  `npx nx show target inputs wolsok:lint`; `release-affected.mjs` empty for
  deploy and build; `npx nx test tools`.
- Commit: `fix(wolsok): lint the root scripts, .agents/, .github/ and __checks__ (#3140)`.

## 3. Docs

- Files: `CLAUDE.md` ("Linting & Formatting": the root project's `lint`
  target in `project.json`, its explicit list, the guard and CI step).
- Checks: `npx nx format:write`, `npx nx affected -t lint,lint-templates
  --base=origin/main`.
- Commit: `docs(wolsok): note the root lint target (#3140)`, or folded into 2.
