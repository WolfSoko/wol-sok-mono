# Plan #2831: nx-aws-cdk-v2-e2e synth test and CI

Spec: [docs/specs/2831-nx-aws-cdk-v2-e2e-synth-test-fails-on-main-and-ci-never-runs-the-plugin-e2e.md](../specs/2831-nx-aws-cdk-v2-e2e-synth-test-fails-on-main-and-ci-never-runs-the-plugin-e2e.md)

1. **Reproduce.** Run `npx nx e2e nx-aws-cdk-v2-e2e` on `main` and keep the
   failing assertion as the red test (no new test needed: the existing synth
   test is the failing one).
2. **Fix the synth test.** `apps/nx-aws-cdk-v2-e2e/tests/aws-cdk.spec.ts`:
   add `runNxTaskWithLogs(command)` (adds `--output-style=stream`, returns
   stdout and stderr without escape codes), use it for `nx test` and
   `nx run <app>:synth`. Run the suite: green. Commit
   `fix(nx-aws-cdk-v2-e2e): read the synth task's log in the plugin e2e`.
3. **Run it in CI.** `apps/nx-aws-cdk-v2-e2e/project.json`: add
   `e2e-ci` (`nx:noop`, `dependsOn: ["e2e"]`). Check with
   `npx nx show project nx-aws-cdk-v2-e2e` and `npx nx run
   nx-aws-cdk-v2-e2e:e2e-ci`. Update the "Plugin E2E" line in `CLAUDE.md`.
   Commit `ci(nx-aws-cdk-v2-e2e): run the plugin e2e in CI through e2e-ci`.
4. **Checks.** `npx nx format:write`, `npx nx affected -t lint,lint-templates`,
   push, PR with `Closes #2831`, watch the CI run's `e2e-ci` on the workers.
