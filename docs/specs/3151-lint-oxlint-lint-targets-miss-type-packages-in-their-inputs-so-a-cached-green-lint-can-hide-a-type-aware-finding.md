# Spec: the lockfile is an input of every oxlint `lint` target

Issue: [#3151](https://github.com/WolfSoko/wol-sok-mono/issues/3151) (found in
the review of [PR #3150](https://github.com/WolfSoko/wol-sok-mono/pull/3150),
[#3140](https://github.com/WolfSoko/wol-sok-mono/issues/3140))

## Goal

A change of an installed package that type-aware oxlint reads (a type package
such as `@types/node`, `@types/jest`, `vitest/globals`, or a package that only
a tsconfig names) gives every oxlint `lint` task a new hash, so Nx never
replays a cached green lint that would now report a finding.

## What Nx hashes today

Checked with `npx nx show target inputs <project>:lint --check …` and Nx's
`HashPlanInspector` on Nx 23.3 / `@nx/oxlint` 23.3.1:

- The inferred target lists `{ externalDependencies: ['oxlint'] }`, and the
  root `wolsok:lint` lists `["oxlint", "oxlint-tsgolint", "@nx/oxlint"]`. Nx
  **ignores** that input for an executor target (its schema: "for
  `nx:run-commands` and community plugins"): a probe with
  `{ externalDependencies: ['rxjs'] }` or `['@types/node']` added, or as the
  only input, left both out of the hash. What Nx hashes instead is the
  executor package `@nx/oxlint` and its dependency closure (which happens to
  hold `oxlint`, `oxlint-tsgolint` and `typescript`).
- Through `{ fileset: …, dependencies: true }` Nx also hashes the npm packages
  the project and its project dependencies import (`rxjs`, `@angular/core`,
  `firebase` for the game lib; `@angular/common` for a lib that gets it only
  through `utils-gpu-calc`).
- Not hashed: packages no source imports but a tsconfig names in `types` (or
  TypeScript loads automatically from `node_modules/@types`). `@types/jest`
  is in no project's lint hash, although 57 tsconfigs name `jest`;
  `@types/node` is missing from `utils-browser-storage:lint` and every other
  project that imports nothing pulling it in. The root `wolsok:lint` has no
  `dependencies: true` fileset, so not even the packages its scripts import
  (`@nx/jest`, `@commitlint/*`) count.

So a lockfile bump of such a package can change a type-aware finding while
the cache answers green.

## Non-goals

- Making `nx affected` select the lint tasks on a lockfile change. Nx marks
  a project affected by a lockfile change only through its graph edges to the
  touched packages, so a bump of `@types/jest` alone still lints nothing in
  its own PR; the next run that does lint such a project misses the cache and
  reports the finding. A graph edge to the type packages would fix that, but
  also widens what a lockfile change releases (`release-affected.mjs` keeps
  Nx's verdict for the lockfile): raised as a follow-up instead.
- Changing the inferred inputs in `@nx/oxlint` upstream.
- `lint-templates` (ESLint, not type-aware here) and `typecheck-specs`
  (`nx:run-commands`, which hashes every external package already).

## Decisions

1. **The input is `{workspaceRoot}/package-lock.json`.** It is the one tracked
   file that pins every installed version, transitive type packages
   (`@types/estree` and the like) included. A per-package list cannot be
   expressed: Nx ignores `externalDependencies` on this executor (above), and
   `node_modules` is not hashed. The cost: every lockfile change misses every
   lint cache once. Lint runs cached per project in CI, so that is one
   uncached lint per project the next time it is affected, not a full run per
   Renovate PR.
2. **A local Nx plugin adds it to every inferred target**:
   `tools/nx/lint-lockfile-input.mjs`, registered in `nx.json` right after
   `@nx/oxlint`. It matches `**/project.json` (not the root project `.`)
   whose folder or an ancestor below the root holds a `tsconfig.json` (the
   nested `tools-*` projects have none of their own and share
   `tools/tsconfig.json`), and contributes
   `lint: { inputs: ['...', '{workspaceRoot}/package-lock.json'] }`; Nx's
   `'...'` spread keeps everything `@nx/oxlint` inferred and appends the
   lockfile (checked: the merged target keeps the executor and its 13 inputs).
   Every project with an oxlint `lint` has a `tsconfig.json` (the guard of
   #3074/#3133 requires each linted script to belong to one), and the one
   project without `lint`, `bacteria-wars-android`, has none, so the plugin
   creates no half target.
   - Not `targetDefaults.lint` in `nx.json`: same file, but the plugin keeps
     the rule and its reason in one tested module, as `typecheck-specs.mjs`
     does, and a later change to it touches no `nx.json`.
   - Registering it changes `nx.json` once, and `release-affected.mjs` keeps
     Nx's verdict for that file, so **the merging release redeploys every app
     once**. Folding the rule into `typecheck-specs.mjs` would avoid that, but
     mixes two concerns in a module named for one; this spec accepts the one
     full release (to be confirmed in the approval).
3. **The root `wolsok:lint`** (hand-written in the root `project.json`, which
   replaces inferred inputs) gets `{workspaceRoot}/package-lock.json` too, and
   loses its `externalDependencies` entry, which Nx ignores and which reads as
   if it worked. The plugin skips the root project, so `project.json` stays
   the only place for it.
4. **A guard**: `tools/nx/lint-lockfile-input.test.mjs` (part of
   `npx nx test tools`) checks the plugin's `createNodes` (pattern, roots it
   takes and skips, the spread input) and that no `project.json` replaces
   the inferred `lint` inputs without the lockfile; `tools/ci/root-lint.test.mjs`
   (run on every CI run) checks that the root `project.json`'s `lint` inputs
   name the lockfile and no `externalDependencies`.
5. **Docs**: CLAUDE.md's "Linting & Formatting" says that the lockfile is a
   lint input and why `externalDependencies` cannot be used.

## Acceptance

1. `npx nx show target inputs <p>:lint --check package-lock.json` reports an
   input for `utils-browser-storage`, `feat-lazy-bacteria-game`, `tools`,
   `oxlint-workspace-rules` and `wolsok`.
2. Every other inferred input stays: `npx nx show project
   utils-browser-storage --json` lists the same lint inputs as before plus the
   lockfile, executor `@nx/oxlint:lint`.
3. `bacteria-wars-android` still has no `lint` target.
4. A lint hash changes with the lockfile: `nx run utils-browser-storage:lint`
   twice is a cache hit; after a whitespace-only edit of `package-lock.json`
   it is a miss.
5. `npx nx test tools` passes, including the new test;
   `npx nx run-many -t lint` passes.
6. `node tools/ci/release-affected.mjs --base=origin/main --head=HEAD
   --target=deploy` on the PR: the selection Nx gives for an `nx.json` change
   (every app), as decision 2 states.

## Open questions

- Decision 2: accept one full release for the `nx.json` registration, or fold
  the rule into `tools/nx/typecheck-specs.mjs` to avoid it? Recommended:
  accept it.
