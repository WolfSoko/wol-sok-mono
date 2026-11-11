# Spec #3020: nx release version bumps every npm package on a lint-only commit

Issue: [#3020](https://github.com/WolfSoko/wol-sok-mono/issues/3020). Follows
[#2888](https://github.com/WolfSoko/wol-sok-mono/issues/2888), which fixed the
same file-based verdict for the deploy legs; related
[#3015](https://github.com/WolfSoko/wol-sok-mono/issues/3015).

## Goal

The release's version job bumps a published package (`tag:published`:
`nx-aws-cdk-v2`, `spa-cdk-stack`, `ws-thanos`) only when this release changes
a file its `build` task (or a task that build depends on) reads. A `feat` or
`fix` commit that changes only `.oxlintrc.json` or `eslint.config.mjs` bumps
no package, so the npm leg of `deploy.yml`, which publishes what its own
selection finds changed, publishes none either.

## Non-goals

- No change to what counts as changed: the root `package.json`, the lockfile,
  a root `tsconfig*.json` other than the base and a deleted file still keep
  Nx's verdict (#2888), so a dependency update still bumps every package.
- No change to the deploy legs, the release trigger in `ci-cd.yml` or
  `version.json`'s release (`commit-and-tag-version`).
- No change to how far a selected package is bumped: Nx still derives
  patch/minor/major from the conventional commits since the package's own
  tag, as it finds them relevant. A commit scoped to the package
  (`feat(ws-thanos): …`) that touched only a lint config, in this release or
  an earlier one, still counts there once a real change selects the package;
  a commit scoped elsewhere counts as a patch at most, as before.

## Decisions

- **Select before versioning, with #2888's filter.** `nx release version`
  marks a commit relevant to a project through `filterAffected`, the logic of
  `nx affected`, which counts every target's inputs (lint configs included)
  and offers no hook to narrow it. Rather than re-implement conventional
  commit versioning, the workflow selects the packages with
  `tools/ci/release-affected.mjs --target=build --projects='tag:published'`
  and passes them as `nx release version --projects=<list>`; with an empty
  list it skips the call (an empty `--projects` could mean every project).
- **The range is the release, not each package's history.** Base is the last
  workspace release `v<version.json>`, head the validated commit: exactly the
  command `ci-cd.yml` already runs to decide whether to release. A package's
  own tag can lag many releases behind; over that long range a deleted file
  or a root `package.json` change is almost certain, and either keeps Nx's
  verdict, so a per-package range would bump every package again (review of
  the first draft). A package changed in an earlier release was versioned
  then, as it was selected then.
- **A failing selection fails the job.** The workflow assigns the script's
  output in a `run` step (`bash -e`, no pipefail) without a pipe, so an
  error stops the release instead of reading as "nothing to version".

## Acceptance

1. A `feat`/`fix` commit changing only `.oxlintrc.json` or
   `eslint.config.mjs` selects no package, and the version step runs no
   `nx release version`; `version.json`'s release still runs.
2. A commit changing a package's sources (`libs/public/ws-thanos/src/…`)
   selects that package and only it; `nx release version --projects=ws-thanos`
   bumps it.
3. A change to the root `package.json` or lockfile still selects every
   package (Nx's verdict, as #2888).
4. `npx nx test tools` pins the Version step: the selection runs without a
   pipe, `nx release version` gets `--projects` and is skipped on an empty
   list; `CLAUDE.md` says how the version job selects.

## Open questions

None.
