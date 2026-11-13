# Plan: fail fast in every inline init step of the Nx Cloud workers

Spec: [docs/specs/3067-ci-fail-fast-in-the-workers-install-necessary-binaries-init-step.md](../specs/3067-ci-fail-fast-in-the-workers-install-necessary-binaries-init-step.md).

1. **Guard first (red).** `tools/ci/nx-cloud-workers.test.mjs`: split the template into its init steps at each list item (`initSteps`, replacing `stepScript`, so a step whose first key is not `name:` is found too) with the commands of each inline `script:`, and assert that each script's first command is `set -eu`, naming the step. Replace the download step's own first-line check by it; keep the check that every `npx firebase setup:emulators:` runs in that step. Run `npx nx test tools`: fails on "Install necessary binaries" and "Install Node Modules".
2. **Fix (green).** `.nx/workflows/workers.yml`: `set -eu` as the first line of "Install necessary binaries" and "Install Node Modules"; move the comment on why POSIX `set -eu` so it covers all inline steps. `npx nx test tools` passes.
3. **Checks and commit.** `npx nx format:write`, `npx nx affected -t lint,lint-templates,test`; one commit `fix(tools): fail fast in every inline init step of the Nx Cloud workers` with spec and plan.
4. **PR** to `main` with `Closes #3067`; the PR's CI run proves the workers still start.
