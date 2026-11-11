# Plan #3020: nx release version bumps every npm package on a lint-only commit

Spec: [docs/specs/3020-…](../specs/3020-nx-release-version-bumps-every-npm-package-on-a-lint-only-commit.md).
Test first; `npx nx format:write` and `npx nx affected -t lint,lint-templates`
before the commit.

1. **Pin the Version step** — `tools/ci/release-affected.test.mjs`: a
   `release.yml` suite (selection over `v<version.json>`..HEAD with
   `--target=build --projects='tag:published'`, no pipe, `nx release version
   --projects="$packages"` only behind a non-empty check). Red first.
2. **Select in the release** — `.github/workflows/release.yml` Version step:
   select, then `nx release version --projects=…` or skip. Acceptance 1–3
   checked by hand on scratch commits (`nx release version --dry-run`, the
   selection's CLI), noted in the PR; 3 is also covered by the existing
   `selectReleaseAffected` tests.
3. **Docs** — `CLAUDE.md` "What a release deploys" paragraph.

One commit: `fix(tools): version only the packages whose build reads a change`.
