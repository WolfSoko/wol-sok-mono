# Plan #3049: Release: the npm leg publishes packages whose version was not bumped

Spec: [docs/specs/3049-…](../specs/3049-release-the-npm-leg-publishes-packages-whose-version-was-not-bumped.md).
Test first; `npx nx format:write` and `npx nx affected -t lint,lint-templates`
before the commit.

1. **Decision, test first** — `tools/ci/bumped-packages.test.mjs`:
   `bumpedPackages(packages, versionAt)` keeps a changed version and a package
   missing at the base, drops an equal version and a package missing at the
   head; the CLI prints nothing for `HEAD..HEAD` and every published package
   from the empty tree (acceptance 2–4). Red first.
2. **Script** — `tools/ci/bumped-packages.mjs`: args, packages and roots from
   `nx show projects`/`nx show project`, versions from `git show`, one name a
   line, non-zero exit on error.
3. **Workflow** — `.github/workflows/deploy.yml`: the npm leg's automatic
   selection calls `bumped-packages.mjs --base="$NX_BASE" --head="$NX_HEAD"
   --projects='tag:published'`; `deploy-workflow.test.mjs` pins it and keeps
   `release-affected.mjs` for the other legs (acceptance 1, 5, 6).
4. **Docs** — `CLAUDE.md` "What a release deploys" (acceptance 7).

One commit: `fix(tools): publish only the npm packages whose version was bumped`.
