# Plan #3020: nx release version bumps every npm package on a lint-only commit

Spec: [docs/specs/3020-…](../specs/3020-nx-release-version-bumps-every-npm-package-on-a-lint-only-commit.md).
Test first in each task; `npx nx format:write` and
`npx nx affected -t lint,lint-templates` before each commit.

1. **Export the selection** — `tools/ci/release-affected.mjs`: move `main`'s
   body into an exported `releaseAffected(options)` returning
   `{ selected, reasons }`; the CLI prints as before. Test: the existing CLI
   tests stay green. Commit `refactor(tools): export the release-affected selection`.
2. **Select the packages to version** — new
   `tools/ci/release-version-projects.mjs` (`releaseVersionProjects({ head,
   packages, lastTagOf, select })`, a package without a tag selected outright; CLI printing one project a line) and
   `tools/ci/release-version-projects.test.mjs`. Tests: acceptance 1–4 with a
   fake `select`/`lastTagOf`; acceptance 1–2 are checked once by hand on
   scratch commits (`nx release version --dry-run`), noted in the PR. Commit
   `fix(tools): version only the packages whose build reads a change`.
3. **Use it in the release** — `.github/workflows/release.yml` Version step:
   select, then `nx release version --projects=…` or skip. Commit with task 2.
4. **Docs** — `CLAUDE.md` "What a release deploys" paragraph. Commit with
   task 2.
