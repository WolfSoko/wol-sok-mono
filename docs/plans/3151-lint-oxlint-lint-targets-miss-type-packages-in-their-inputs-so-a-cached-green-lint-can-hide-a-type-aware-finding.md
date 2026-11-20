# Plan: the lockfile is an input of every oxlint `lint` target

Spec: [`docs/specs/3151-…`](../specs/3151-lint-oxlint-lint-targets-miss-type-packages-in-their-inputs-so-a-cached-green-lint-can-hide-a-type-aware-finding.md),
issue [#3151](https://github.com/WolfSoko/wol-sok-mono/issues/3151).

Branch `3151-lint-lockfile-input` off `main`, one PR.

## 1. Plugin test first

- Files: `tools/nx/lint-lockfile-input.test.mjs` (new, in the style of
  `typecheck-specs.test.mjs`: a temp workspace, the plugin's `createNodes`).
- Tests: the pattern is `**/tsconfig.json`; a `tsconfig.json` beside a
  `project.json` gets `lint.inputs` `['...', '{workspaceRoot}/package-lock.json']`
  and nothing else; one without a `project.json` and the root `tsconfig.json`
  get nothing; the root `project.json`'s `lint` inputs name
  `{workspaceRoot}/package-lock.json` and hold no `externalDependencies`.
- Red: no plugin yet.
- Commit: folded into 2 (the pre-commit hook runs the affected tests).

## 2. Plugin, registration, root target

- Files: `tools/nx/lint-lockfile-input.mjs` (new), `nx.json` (plugin entry
  right after `@nx/oxlint`), `project.json` (lockfile input in, the
  `externalDependencies` entry out).
- Checks: `npx nx test tools`; acceptance 1 to 4 of the spec with
  `nx show target inputs --check` and `nx show project`; `npx nx run-many -t
  lint`.
- Commit: `fix(tools): make the lockfile an input of every oxlint lint target (#3151)`.

## 3. Docs

- Files: `CLAUDE.md` ("Linting & Formatting": the lockfile input, the plugin,
  why `externalDependencies` does not work on the executor).
- Checks: `npx nx format:write`, `npx nx affected -t lint,lint-templates
  --base=origin/main`.
- Commit: `docs(tools): note the lockfile lint input (#3151)`, or folded into 2.
