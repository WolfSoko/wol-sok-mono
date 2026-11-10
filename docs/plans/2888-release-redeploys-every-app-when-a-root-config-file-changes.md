# Plan #2888: Release redeploys every app when a root config file changes

Spec: [docs/specs/2888-release-redeploys-every-app-when-a-root-config-file-changes.md](../specs/2888-release-redeploys-every-app-when-a-root-config-file-changes.md)

## 1. Pure selection, test first

- `tools/ci/release-affected.test.mjs`: cases for `selectReleaseAffected({ candidates, changedFiles, deletedFiles, inputsOf })`:
  a changed lint config that no project reads selects none; a changed file in
  one project's inputs selects it only; a lockfile or root `package.json`
  change keeps every candidate; a deleted file keeps every candidate; no
  candidates selects none.
- `tools/ci/release-affected.mjs`: export `selectReleaseAffected`.
- Commit: `fix(tools): select release projects by their task inputs`.

## 1b. Refined changes, test first

- Same spec: `tsconfigBaseChanges` (new, removed, retargeted alias; other
  change) and `isVersionBumpOnly` (version alone; any other change).
- Same file: the CLI replaces a changed `tsconfig.base.json` by its result and
  drops version-only `package.json` bumps for `--target=deploy`.

## 2. CLI around it

- Same file: when run directly, take `--base`, `--head`, `--target` (`deploy`
  or `build`), and either `--exclude=<pattern>` or `--projects=<pattern>`
  (handed to `nx show projects --affected --json`); changed and deleted files
  from `git diff --name-status <base> <head>`; inputs from
  `nx show target inputs <p>:<target> --json` into a temp file; print the
  selected projects, one a line, and on stderr why each candidate was kept or
  dropped.
- Test: a spec case running the CLI against the real workspace with
  `--files`-like ranges is not possible without commits, so the CLI gets an
  `--files` option (as Nx has) used by an integration case: `.oxlintrc.json`
  and `eslint.config.mjs` select nothing, `firebase.pacetrainer.json` selects
  `pacetrainer`.
- Commit: same as 1 (one commit if small).

## 3. Workflows

- `deploy.yml`: "Show affected projects" calls the script per leg (npm:
  `--target=build --projects=tag:published`; others:
  `--target=deploy --exclude=<pattern>`), writes the list to `$GITHUB_ENV`
  as `RELEASE_PROJECTS`; "Publish npm packages" runs
  `nx release publish --projects=$RELEASE_PROJECTS`; "Build npm packages"
  builds those; "Deploy Apps" runs `nx run-many -t deploy --projects=$RELEASE_PROJECTS`.
- `ci-cd.yml`: the release trigger calls the script twice the same way.
- Guard: every step passing `$RELEASE_PROJECTS` also checks it is not empty,
  and no step uses `nx affected` (a `deploy.yml` case in the spec).
- Commit: `fix(github): deploy only what the deploy task reads`.

## 4. Docs and check

- CLAUDE.md: one line under Testing / deploy inputs naming the script.
- Run acceptance 5 in a worktree at `v74.140.0` (node_modules linked) and note
  the result in the PR.
- `npx nx format:write`, `npx nx affected -t lint,lint-templates,test`.
