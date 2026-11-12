# Plan 2985: `void` for node:test calls under tools/

Spec: [docs/specs/2985-tools-lint-flaky-add-void-to-describe-it-in-tools-ci-nx-cloud-workers-test-mjs.md](../specs/2985-tools-lint-flaky-add-void-to-describe-it-in-tools-ci-nx-cloud-workers-test-mjs.md)

1. **Baseline.** Run `npx nx test tools` and note the test count.
2. **Mark the calls.** Prefix every `describe(`/`it(` with `void` in `tools/ci/nx-cloud-workers.test.mjs`, `tools/ci/deploy-inputs.test.mjs`, `tools/ci/release-affected.test.mjs` and `tools/ci/target-inputs.test.mjs`. Test: grep finds no un-voided call; `npx nx test tools` shows the same count; `npx nx lint tools --skip-nx-cache` passes. Commit: `fix(tools): mark node:test describe and it calls with void`.
3. **Spec and plan** go in with the fix, in one PR.
