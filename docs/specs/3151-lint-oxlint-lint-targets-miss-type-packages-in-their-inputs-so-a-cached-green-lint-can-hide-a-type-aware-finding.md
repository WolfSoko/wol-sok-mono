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
2. **`nx.json`'s `targetDefaults` adds it to every inferred target**, keyed
   by the executor: `"@nx/oxlint:lint": { "inputs": ["...",
   "{workspaceRoot}/package-lock.json"] }`. Nx merges target defaults after
   the inferring plugins, so the `'...'` spread keeps every input
   `@nx/oxlint` inferred and appends the lockfile (checked on the graph: all
   65 lint targets, executor and inputs kept; `bacteria-wars-android` gets no
   `lint`, since the entry applies only where the executor already is).
   - First approved as a local Nx plugin matching `project.json` files with a
     `tsconfig.json`; the `/simplify` review showed that the executor-keyed
     entry does the same job with no code and no heuristic that could drift
     from `@nx/oxlint`'s own detection, and the manager approved the switch.
   - It changes `nx.json`, and `release-affected.mjs` keeps Nx's verdict for
     that file, so **the merging release redeploys every app once** (owner
     approved). A later change to the entry does so again; it is one stable
     line.
3. **The root `wolsok:lint`** (hand-written in the root `project.json`, which
   replaces inferred inputs) gets `{workspaceRoot}/package-lock.json` too, and
   loses its `externalDependencies` entry, which Nx ignores and which reads as
   if it worked. Its explicit inputs replace the target default's, so
   `project.json` stays the only place for it.
4. **A guard**: `tools/ci/lint-lockfile-input.test.mjs` (part of
   `npx nx test tools`) checks the `targetDefaults` entry and fails on a
   `project.json` whose `lint` inputs neither spread `'...'` nor name the
   lockfile; `tools/ci/root-lint.test.mjs` (run on every CI run) checks that
   the root `project.json`'s `lint` inputs name the lockfile.
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

None left: the full release and the switch to `targetDefaults` were approved.
