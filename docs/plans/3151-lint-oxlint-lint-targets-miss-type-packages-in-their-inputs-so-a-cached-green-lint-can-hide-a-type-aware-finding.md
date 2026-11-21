# Plan: the lockfile is an input of every oxlint `lint` target

Spec: [`docs/specs/3151-…`](../specs/3151-lint-oxlint-lint-targets-miss-type-packages-in-their-inputs-so-a-cached-green-lint-can-hide-a-type-aware-finding.md),
issue [#3151](https://github.com/WolfSoko/wol-sok-mono/issues/3151).

Branch `3151-lint-lockfile-input` off `main`, one PR.

## 1. Guard first

- Files: `tools/ci/lint-lockfile-input.test.mjs` (new), `tools/ci/root-lint.test.mjs`,
  `LOCKFILE_INPUT` in `tools/ci/workspace-projects.mjs`.
- Tests: `nx.json`'s `targetDefaults["@nx/oxlint:lint"].inputs` is
  `['...', '{workspaceRoot}/package-lock.json']`; no `project.json` sets
  `lint` inputs that neither spread nor name the lockfile; the root
  `project.json`'s `lint` inputs name it.
- Red: no entry yet.

## 2. Target default and root target

- Files: `nx.json` (the `targetDefaults` entry), `project.json` (lockfile in,
  the ignored `externalDependencies` entry out).
- Checks: `npx nx test tools`; spec acceptance 1 to 4 with
  `nx show target inputs --check` and the graph; `npx nx run-many -t lint`.
- Commit: `fix(tools): make the lockfile an input of every oxlint lint target (#3151)`.

(A first version registered a local Nx plugin for the same job; the
`/simplify` review replaced it with the target default, approved by the
manager.)

## 3. Docs

- Files: `CLAUDE.md` ("Linting & Formatting": the entry, the guards, why
  `externalDependencies` does not work on the executor).
- Checks: `npx nx format:write`, `npx nx affected -t lint,lint-templates
  --base=origin/main`.
