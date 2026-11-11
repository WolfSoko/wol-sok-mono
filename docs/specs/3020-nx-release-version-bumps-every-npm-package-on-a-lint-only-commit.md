# Spec #3020: nx release version bumps every npm package on a lint-only commit

Issue: [#3020](https://github.com/WolfSoko/wol-sok-mono/issues/3020). Follows
[#2888](https://github.com/WolfSoko/wol-sok-mono/issues/2888), which fixed the
same file-based verdict for the deploy legs; related
[#3015](https://github.com/WolfSoko/wol-sok-mono/issues/3015).

## Goal

The release's version job bumps a published package (`tag:published`:
`nx-aws-cdk-v2`, `spa-cdk-stack`, `ws-thanos`) only when a file its `build`
task (or a task that build depends on) reads changed since the package's own
last release tag. A `feat` or `fix` commit that changes only `.oxlintrc.json`
or `eslint.config.mjs` bumps no package, so the npm leg of `deploy.yml`, which
publishes what its own selection finds changed, publishes none either.

## Non-goals

- No change to what counts as changed: the root `package.json`, the lockfile,
  a root `tsconfig*.json` other than the base and a deleted file still keep
  Nx's verdict (#2888), so a dependency update still bumps every package.
- No change to the deploy legs, the release trigger in `ci-cd.yml` or
  `version.json`'s release (`commit-and-tag-version`).
- No change to how far a selected package is bumped: Nx still derives
  patch/minor/major from the conventional commits it finds relevant. A commit
  scoped to the package (`feat(ws-thanos): …`) that touches only a lint config
  still counts there, but only when another commit in the range really
  changes the package; a commit scoped elsewhere counts as a patch at most, as
  before.

## Decisions

- **Select before versioning, with #2888's filter.** `nx release version`
  marks a commit relevant to a project through `filterAffected`, the logic of
  `nx affected`, which counts every target's inputs (lint configs included)
  and offers no hook to narrow it. Rather than re-implement conventional
  commit versioning, a script picks the packages to version and the workflow
  passes them as `nx release version --projects=<list>`; with an empty list it
  skips the call (an empty `--projects` could mean every project).
- **Each package against its own last tag.** Versioning is independent: a
  package's range starts at its latest `<project>@<version>` tag
  (`releaseTag.pattern`, Nx's default for independent groups) reachable from
  the head, the newest by version (`git tag --list '<project>@*' --merged
  <head> --sort=-v:refname`). A package without a tag is selected (its first
  release), as Nx would.
- **One selection, reused.** `tools/ci/release-affected.mjs` gains an
  exported `releaseAffected({ base, head, target, projects })`, its CLI's
  body; the new `tools/ci/release-version-projects.mjs` calls it per package
  with `--target=build`, the target the npm leg already selects by. So the
  bump and the publish follow the same rule.
- **A failing selection fails the job.** The workflow assigns the script's
  output in a `run` step (`bash -e`), so an error stops the release instead
  of reading as "nothing to version".

## Acceptance

1. A `feat`/`fix` commit changing only `.oxlintrc.json` or
   `eslint.config.mjs` since every package's tag selects no package, and the
   version step runs no `nx release version`.
2. A commit changing a package's sources (`libs/public/ws-thanos/src/…`)
   selects that package and only it; `nx release version --projects=ws-thanos`
   bumps it.
3. A package without a release tag is selected.
4. A change to the root `package.json` or lockfile still selects every
   package (Nx's verdict, as #2888).
5. `npx nx test tools` covers the selection; `CLAUDE.md` says how the
   version job selects.

## Open questions

None.
