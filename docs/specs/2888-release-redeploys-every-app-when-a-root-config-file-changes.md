# Spec #2888: Release redeploys every app when a root config file changes

Issue: [#2888](https://github.com/WolfSoko/wol-sok-mono/issues/2888), found on the
release of [#2876](https://github.com/WolfSoko/wol-sok-mono/issues/2876).

## Goal

A release deploys an app (and publishes a package) only when a file that is an
input of its `deploy` task (for a package: its `build` task) changed since the
last deploy of its kind. A change to a lint-only root config (`.oxlintrc.json`,
`eslint.config.mjs`) deploys nothing and publishes nothing.

## Cause

`deploy.yml` (and the release trigger in `ci-cd.yml`) pick projects with
file-based `nx affected` / `nx show projects --affected`. Nx marks a project
affected when a changed file matches the inputs of _any_ of its targets.
`@nx/oxlint` gives every `lint` target `{workspaceRoot}/.oxlintrc.json`, and
`@nx/eslint/plugin` every `lint-templates` target
`{workspaceRoot}/eslint.config.mjs`, so a change to either makes every project
affected, whatever its `deploy` reads. `-t deploy` only filters by having the
target, not by its inputs.

`npx nx show target inputs <project>:deploy` resolves the deploy task's own
inputs (its `production` files, `^production` of every dependency, the root
files named in its `inputs`, and the files Nx hashes for every task: `nx.json`,
`tsconfig.base.json`, `.gitignore`, `.nxignore`). Neither lint config is among
them.

## Non-goals

- No change to the `deploy` targets' inputs or to `nx.json`'s named inputs.
- `nx.json` stays an input of every task (Nx adds it): a change to it keeps
  every project Nx calls affected.
- `version.json` changes with every release and is an input of every app
  reading `@wolsok/utils-version` (by design, CLAUDE.md), so those still deploy
  with every release.
- Which packages `nx release version` bumps stays as it is. It picks them by
  the same file-based affected logic, so a lint-only commit still bumps (and
  the npm leg then publishes) every package. Raised as a follow-up.
- The implicit edge from every project to `oxlint-workspace-rules`
  (`tools/oxlint`, which `@nx/oxlint` adds for the local plugin) stays: a change
  to the workspace's oxlint rules still deploys every app. Raised as a follow-up.
- No comparison of build output hashes.

## Decisions

- **Filter Nx's affected list by the task's resolved inputs, don't replace it.**
  A project is deployed when Nx calls it affected _and_ at least one changed
  file is an input of its deploy task. Keeping Nx's list keeps its granular
  handling of `package.json`, `package-lock.json`, `tsconfig.base.json` and
  `nx.json`; the filter only drops projects whose deploy reads none of the
  changed files. Reason: the smallest change that removes the false positives
  without re-implementing Nx's diff analysis.
- **Changes to the lockfile or root `package.json` keep Nx's verdict.** The
  deploy task's inputs list npm packages, not those files; Nx already maps a
  lockfile change to the projects using the changed packages.
- **A deleted file keeps Nx's verdict.** A file gone at the release tag is in no
  resolved input set, so the filter cannot judge it; deleting a file a project
  owned still deploys it. Conservative on purpose.
- **One script, `tools/ci/release-affected.mjs`, for all three places**: the
  release trigger in `ci-cd.yml`, the "Show affected projects" step and the
  deploy step in `deploy.yml`. The deploy step runs
  `nx run-many -t deploy --projects=<list>` and the npm leg
  `nx release publish --projects=<list>`, so what is shown is what runs.
  Inputs are read with `nx show target inputs <p>:<target> --json` into a
  file (its stdout is cut off at 64 KiB when piped).
- **A paths-only change to `tsconfig.base.json` counts as the files of the
  aliases it adds, removes or retargets** (`tsconfigBaseChanges`). Nx hashes
  the file into every task, so as a plain input it would keep every candidate
  whenever another file (a lint config) made them all affected; an alias
  matters only through what it points to and the files importing it, which
  change with it. Any other change to the file counts as the file.
- **A version-only change of a project's `package.json` deploys no app**
  (`isVersionBumpOnly`, deploy legs only): the release commit bumps the
  published packages, and the apps bundle their sources through the path
  alias; nothing in `libs/public/*/src` reads the version. The npm leg still
  counts it, since the new version must be published.
- **Packages use their `build` inputs** (`nx-release-publish` depends on
  `build` and has none of its own).
- The pure selection (`selectReleaseAffected`) is separate from the Nx and git
  calls and has a `node:test` spec in `tools/ci/`, run by `npx nx test tools`.

## Acceptance

1. With `--files=.oxlintrc.json` (and with `--files=eslint.config.mjs`), the
   script selects no deployable project and no package.
2. With a file of one app (`apps/pacetrainer/src/main.ts`), it selects that app
   only; with a file of a shared lib, the deployable apps depending on it.
3. With `firebase.pacetrainer.json`, it selects `pacetrainer`.
4. A deleted file or a lockfile change keeps every project Nx calls affected.
   A paths-only `tsconfig.base.json` change counts as its alias targets; a
   version-only `package.json` bump deploys no app.
5. Run at the tag `v74.140.0` over the ranges that release deployed
   (non-cdk and cdk from `v74.139.12`, npm from `v74.139.9`), the selections
   hold only the projects whose deploy or build inputs changed in them, not
   every app. An empty selection skips the leg's deploy, publish and tag.
6. `deploy.yml` and `ci-cd.yml` select through the script; `deploy.yml` deploys
   and publishes exactly the selected list.
7. `npx nx test tools` passes with the new spec.

## Open questions

None.
