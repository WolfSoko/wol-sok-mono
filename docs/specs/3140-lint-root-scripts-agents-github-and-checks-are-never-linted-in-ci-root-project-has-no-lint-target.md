# Spec: lint the root scripts, `.agents/`, `.github/` and `__checks__/` in CI

Issue: [#3140](https://github.com/WolfSoko/wol-sok-mono/issues/3140) (found in [#3133](https://github.com/WolfSoko/wol-sok-mono/issues/3133))

## Goal

The scripts outside every project (the root configs `.versionrc.cjs`,
`commitlint.config.ts`, `eslint.config.mjs`, `jest.config.ts`,
`jest.preset.cjs`, `lint-staged.config.js`, the monitor-ci scripts under
`.agents/` and `.github/`, and `__checks__/angular-examples.check.js`) are
linted by oxlint in CI, as every project's scripts are, and a new one cannot
slip past it.

## Why they are not linted today

CI lints only through `nx affected -t lint,…`. `@nx/oxlint` infers a `lint`
target for every project except the root project `.`, which it skips unless it
has a `src/` or `lib/` folder (`getProjectUsingOxlintConfig`). The root project
`wolsok` (the root `package.json`) therefore has no targets at all, and its
scripts are linted only by a local `npx oxlint .`.

## Non-goals

- Linting files that are no script (JSON, YAML, Markdown): oxlint lints JS/TS
  only.
- Moving the files into a project of their own: the Jest, ESLint, commitlint
  and lint-staged configs must stay at the root, where their tools look.
- Changing any lint rule or fixing other projects' findings.

## Decisions

1. **A `lint` target on the root project, in a new root `project.json`.**
   It uses the same executor as every inferred target (`@nx/oxlint:lint`,
   batched, cached, `metadata.technologies: ["oxlint"]`), so `nx affected -t
   lint`, `npm run lint` and `nx fix-ci` cover it with no CI change of its own.
   - Not in the root `package.json`'s `nx` key: `tools/ci/release-affected.mjs`
     keeps Nx's verdict for a root `package.json` change, so the change itself
     would redeploy every app once. A root `project.json` is an ordinary
     project file: Nx calls only `wolsok` and `tools` affected by it, and
     `release-affected.mjs` selects nothing (checked on a probe commit: empty
     stdout for `--target=deploy` and `--target=build`).
   - Not an uncached CI step running `npx oxlint …`: it would run on every CI
     run, sit outside `npm run lint` and the Nx cache, and need its own
     error reporting.
2. **Explicit `lintFilePatterns`**: `.agents`, `.github`, `__checks__` and the
   six root files by name. The executor passes them to oxlint as they are, and
   oxlint expands no globs; linting `.` would lint the whole workspace again.
3. **Explicit, narrow `inputs`**: the scripts under those patterns, the root
   `tsconfig.json` (the program that types them), `.oxlintrc.json`,
   `.gitignore`, the workspace plugin `tools/oxlint/workspace-rules.mjs`, and
   the `oxlint`/`oxlint-tsgolint` packages. The root project owns every file
   outside the other projects (docs, workflows, root configs), so Nx calls it
   affected often; with these inputs that is a cache hit unless a linted file
   changed. Nx adds `nx.json`, `tsconfig.base.json` and `.nxignore` itself.
4. **Graph**: with the target, `@nx/oxlint`'s `createDependencies` gives
   `wolsok` one implicit edge, to the leaf `oxlint-workspace-rules`. No cycle:
   the root project depends on nothing else (the issue's note that it depends
   on `feat-lazy-bacteria-game` no longer holds; `nx graph` shows no edge).
5. **A guard keeps the list complete**: `tools/ci/root-lint.test.mjs` fails
   when a linted script that no other project's root contains (so Nx gives
   it to the root project, whatever `tsconfig.json` is nearest) lies under
   none of the target's `lintFilePatterns` or none of its inputs, and
   when a pattern names no tracked file. A new root script makes only
   `wolsok` affected, never `tools`, so, like the two guards before it,
   `ci-cd.yml` runs it on every run as the uncached step "Root scripts are
   linted" (`node --test`, outside Nx, no `if:` or `continue-on-error`), and
   the test checks that step.
6. **Docs**: CLAUDE.md's "Linting & Formatting" says which target lints the
   root scripts and that the guard keeps the list.

## Acceptance

1. `npx nx show project wolsok` lists a `lint` target (`@nx/oxlint:lint`,
   cached) and no other new target; `nx graph` gives `wolsok` only the edge to
   `oxlint-workspace-rules`.
2. `npx nx run wolsok:lint` passes on the current files, and fails on a
   planted `no-unused-vars` error in `__checks__/angular-examples.check.js`.
3. `npx nx show target inputs wolsok:lint` lists the eleven scripts and the
   configs of decision 3, and no file of another project or `docs/`.
4. `npx nx affected -t lint` on CI includes `wolsok:lint` (it is affected by
   the change itself).
5. `node tools/ci/release-affected.mjs --base=origin/main --head=HEAD
   --target=deploy` and `--target=build` print nothing for this PR.
6. `node --test tools/ci/root-lint.test.mjs` passes, fails for a new root
   script missing from the patterns, and `ci-cd.yml` runs it as an uncached
   step.
7. `npx nx test tools` passes.

## Open questions

None.
