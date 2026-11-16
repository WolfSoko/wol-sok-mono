# Plan: release redeploys every app when the oxlint workspace rules change

Spec: [docs/specs/3015-release-redeploys-every-app-when-the-oxlint-workspace-rules-change.md](../specs/3015-release-redeploys-every-app-when-the-oxlint-workspace-rules-change.md)

1. **Failing spec.** In `tools/ci/release-affected.test.mjs`, add
   `tools/oxlint/workspace-rules.mjs` (and its spec and `project.json`) to the
   "deploys and publishes nothing" cases, and a case that `pacetrainer:lint`
   and `korbjaeger:lint` still read `tools/oxlint/workspace-rules.mjs`
   (`nx show target inputs … --json`). Run `npx nx test tools`: the new
   release case fails.
2. **Fix.** Add `"namedInputs": { "default": [], "production": [] }` to
   `tools/oxlint/project.json`. Rerun `npx nx test tools` and
   `npx nx test oxlint-workspace-rules`: green.
3. **Docs.** One sentence in `CLAUDE.md`'s linting section on why the rules
   project's named inputs are empty.
4. **Checks and commit.** `npx nx format:write`,
   `npx nx affected -t lint,lint-templates`; one commit
   `fix(oxlint-workspace-rules): keep the workspace rules out of every release`
   with spec, plan, test, fix and docs; PR to `main` with `Closes #3015`.
