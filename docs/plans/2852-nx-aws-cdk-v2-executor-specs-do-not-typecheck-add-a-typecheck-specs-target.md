# Plan #2852: nx-aws-cdk-v2: executor specs do not typecheck; add a typecheck-specs target

Spec: [docs/specs/2852-…](../specs/2852-nx-aws-cdk-v2-executor-specs-do-not-typecheck-add-a-typecheck-specs-target.md)

## Task 1: target first

- Files: `libs/public/nx-aws-cdk-v2/project.json`.
- Add `"typecheck-specs": {}`; `npx nx typecheck-specs nx-aws-cdk-v2` fails
  with the 16 errors.

## Task 2: shared fake process

- Files: `libs/public/nx-aws-cdk-v2/src/utils/testing.ts`.
- Add `FakeChildProcess` and `runExecutorToExit(exec, run, exitCode = 0)`.

## Task 3: specs on the helper

- Files: `src/executors/{bootstrap,deploy,destroy,synth}/*.spec.ts`.
- Mock `exec` with a factory that returns `FakeChildProcess`; run each test
  through `runExecutorToExit`; type the extra options as intersections; add
  the deploy non-zero-exit test.
- `npx nx run-many -t typecheck-specs,test,build,lint -p nx-aws-cdk-v2`
  pass; check acceptance 2's failure case by hand.

## Task 4: commit and PR

- `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
- One commit `test(nx-aws-cdk-v2): typecheck the executor specs` with spec
  and plan. PR to `main` with `Closes #2852`.
