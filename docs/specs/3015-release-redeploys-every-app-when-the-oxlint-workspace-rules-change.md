# Spec: release redeploys every app when the oxlint workspace rules change

Issue: [#3015](https://github.com/WolfSoko/wol-sok-mono/issues/3015)

## Goal

A change to the workspace's own oxlint rules (`tools/oxlint/`, project
`oxlint-workspace-rules`) selects no deployable project and no published
package for a release, while every project's `lint` still reruns.

## Today

`@nx/oxlint` (23.3.1, `createDependencies`) adds an implicit graph edge from
every project with a `lint` target to the project that holds a relative
`jsPlugins` entry of `.oxlintrc.json`: `oxlint-workspace-rules`. Through that
edge the rules' files enter every task that reads the dependencies' named
inputs:

- `build` and most `deploy` targets read `^production`;
- the CDK apps' `deploy` targets declare no inputs, so they read `^default`.

`tools/ci/release-affected.mjs` (#2888) therefore keeps 12 deployables
(every app and CDK stack) and all 3 published packages for a change to
`tools/oxlint/workspace-rules.mjs` (measured on `main` at `d204e1c`).

## Decision

The rules project declares its own named inputs `default` and `production`
as empty (`namedInputs` in `tools/oxlint/project.json`). A dependent's
`^default` and `^production` then take nothing from it.

Reasons:

- It fixes the cause where it lies: nothing the rules project holds ships in
  or configures any build, deploy or test of another project. The only task
  that needs its files is `lint`, and the plugin already declares the plugin
  file as a direct input of every `lint` target
  (`{workspaceRoot}/tools/oxlint/workspace-rules.mjs`, `localJsPluginFiles`),
  besides the dependency fileset of the boundaries bridge.
- It keeps the graph edge, so `nx affected -t lint` still reruns lint in every
  project when the rules change, and the project graph stays truthful.
- One file changes; no per-project `implicitDependencies` negation (which
  would also drop the edge lint relies on for `affected`), no move of the
  rules out of a project (a file in `tools/` would make the edge point to
  `tools` instead, which is worse), no special case in
  `release-affected.mjs`.
- The project's own `test` target lists its inputs explicitly
  (`{projectRoot}/**/*`), so it is unaffected.

## Non-goals

- Changing `@nx/oxlint` or the edge it creates.
- Narrowing any other source of over-selection.

## Acceptance

1. `release-affected.mjs --files=tools/oxlint/workspace-rules.mjs` selects
   nothing for `--target=deploy` and nothing for
   `--target=build --projects=tag:published`; the same for the rules' spec and
   `project.json`.
2. Every project's `lint` still reads `tools/oxlint/workspace-rules.mjs`
   (`nx show target inputs <app>:lint`).
3. Every target of `oxlint-workspace-rules` itself (`lint`, `test`) still
   reads its own files: emptying `default` and `production` also empties them
   for the project's own targets, so each must list its inputs explicitly.
   Checked: `test` lists `{projectRoot}/**/*`, and `lint` (inferred by
   `@nx/oxlint`) its lintable filesets plus the rules file; neither takes
   `default` or `production`, so neither needs a change.
4. A spec in `tools/ci/release-affected.test.mjs` keeps 1, 2 and 3.
5. `CLAUDE.md` names the empty named inputs and why, beside the rules
   plugin.

## Open questions

None.
