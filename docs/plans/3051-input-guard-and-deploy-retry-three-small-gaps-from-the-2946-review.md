# Plan: input guard and deploy retry, three small gaps (#3051)

Spec: [docs/specs/3051-input-guard-and-deploy-retry-three-small-gaps-from-the-2946-review.md](../specs/3051-input-guard-and-deploy-retry-three-small-gaps-from-the-2946-review.md).

1. **Retry: no second attempt after a cancel during the pause.**
   Files: `tools/deploy/run-with-one-retry.ts`, `tools/deploy/run-with-one-retry.spec.ts`, `tools/deploy/retry-once.ts`.
   Test first: a spec where `cancelledBy` answers `SIGTERM` after the pause expects `128 + 15`, one run and the `not retried` line. Then add `cancelledBy` to `RetryDeps` and check it after `pause`; `retry-once.ts` passes `() => cancelledBy`.
   Check: `npx nx test tools-deploy`, `npx nx run tools:typecheck-tools`.
   Commit: `fix(tools): skip the deploy retry when the job was cancelled during the pause`.

2. **Guard: `{projectRoot}` and `fileset` inputs.**
   Files: `tools/ci/target-inputs.test.mjs`.
   Test first: unit cases for the resolver (a `{projectRoot}` path against the project's folder, a `fileset` object, a glob, a negation, a named input, an `nx.json` `{projectRoot}` left out), red before the resolver exists; then collect `{ where, input, projectRoot }` for strings and filesets and check existence.
   Check: `npx nx test tools`.
   Commit: `fix(tools): check {projectRoot} and fileset inputs for missing files`.

3. **Guard on every CI run.**
   Files: `.github/workflows/ci-cd.yml`, `tools/ci/target-inputs.test.mjs`.
   Test first: a case that reads `ci-cd.yml` and expects a step running `node --test tools/ci/target-inputs.test.mjs`; then add the step after "Sync check".
   Check: `npx nx test tools`.
   Commit: `ci(tools): run the target-input guard on every CI run`.

4. **Docs.** `CLAUDE.md`'s Testing bullet on `target-inputs.test.mjs` names the `{projectRoot}`/`fileset` cases and the CI step. Goes with task 3's commit.

Before each commit: `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
