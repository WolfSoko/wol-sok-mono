# Spec #3049: Release: the npm leg publishes packages whose version was not bumped

Issue: [#3049](https://github.com/WolfSoko/wol-sok-mono/issues/3049). Found in
the review of [#3020](https://github.com/WolfSoko/wol-sok-mono/issues/3020)
(PR [#3044](https://github.com/WolfSoko/wol-sok-mono/pull/3044)); related
[#2888](https://github.com/WolfSoko/wol-sok-mono/issues/2888).

## Goal

The npm leg of `deploy.yml` publishes exactly the published packages
(`tag:published`: `nx-aws-cdk-v2`, `spa-cdk-stack`, `ws-thanos`) whose
`package.json` `version` changed since the last `*-npm-deployed` tag, the
packages `nx release version` bumped. A commit of a non-releasing type
(`refactor`, `chore`, `perf`, `docs`, …) in `libs/public/<pkg>/src` changes a
build input but bumps no version, so it publishes nothing, rather than running
`nx release publish` for a version npm already has.

## Non-goals

- No change to how the release versions packages (`release.yml`, #3020).
- No change to the other legs, to the dispatch override (`projects` names
  the packages to publish, as now), or to the deploy tags.
- No check against the npm registry. A leg that failed halfway (one package
  published, the next refused) still retries the published one with the next
  release, as today.

## Decisions

- **The version is the selection.** The version job already decides which
  package gets a release (conventional commits over #3020's file filter); a
  second, file-based selection in the deploy can only disagree with it. The
  leg compares each published package's `<root>/package.json` `version` at
  `NX_BASE` (the last `*-npm-deployed` tag) and `NX_HEAD` (the release tag)
  and publishes those that differ. Comparing across the whole range, not the
  last release commit alone, keeps a bump whose publish failed: its tag was
  never set, so the next release still sees the change.
- **A package without a `package.json` at the base counts as bumped**: a new
  package, or the first deploy (`NX_BASE` is the empty tree), publishes its
  version once.
- **One small script, `tools/ci/bumped-packages.mjs`**, beside
  `release-affected.mjs` and `deploy-override.mjs`: `--base`, `--head`,
  `--projects=<pattern>`; it takes the packages and their roots from Nx and the
  versions from `git show <ref>:<root>/package.json`, prints one package a
  line and fails (non-zero) on any error, so the leg never reads a failure as
  an empty list. Its decision is a pure function, `bumpedPackages`, unit
  tested.
- **The leg builds what it publishes**: `Build npm packages` and `Publish npm
  packages` keep taking `RELEASE_PROJECTS`, now the bumped list.

## Acceptance

1. A release whose range holds only a `refactor` commit in
   `libs/public/ws-thanos/src` (no version change) selects no npm package:
   the leg skips and sets no `*-npm-deployed` tag.
2. A release that bumped `ws-thanos` (its `package.json` version changed
   since the last npm deploy tag) selects `ws-thanos` alone.
3. A package missing at the base (or the empty-tree base) is selected.
4. `bumped-packages.mjs` with `--base=HEAD --head=HEAD` prints nothing; with
   the empty tree as base it prints every published package.
5. A dispatch naming projects still publishes those (deploy-override), and
   the other legs still select through `release-affected.mjs`.
6. `tools/ci/deploy-workflow.test.mjs` pins the npm leg to
   `bumped-packages.mjs`; `npx nx test tools` passes.
7. `CLAUDE.md` ("What a release deploys") says how the npm leg selects.

## Open questions

None.
