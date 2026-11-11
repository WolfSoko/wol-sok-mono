# Plan #2895: nx-aws-cdk-v2 listener leak and test helpers in the build

Spec: [docs/specs/2895-nx-aws-cdk-v2-runcommandprocess-leaks-process-listeners-test-helpers-ship-in-the-published-build.md](../specs/2895-nx-aws-cdk-v2-runcommandprocess-leaks-process-listeners-test-helpers-ship-in-the-published-build.md)

1. **Move the test helpers.** `git mv src/utils/testing.ts
   src/testing/executor.ts`; update the imports of the four executor specs
   (`bootstrap`, `deploy`, `destroy`, `synth`).
   Check: `npx nx test nx-aws-cdk-v2`, `typecheck-specs`, `build`, grep the
   dist for the helper names.
   Commit: `fix(nx-aws-cdk-v2): keep the executor test helpers out of the published build`.
2. **Spec the listener cleanup (red).** New
   `src/utils/executor.util.spec.ts` with a mocked `child_process.exec`
   (the `FakeChildProcess` from `src/testing/executor.ts`, given a `stdin`
   and `kill`): listener counts unchanged after exit 0 and exit 1, stdin
   paused after the run, stdin data forwarded to the child, `SIGTERM` kills
   the child. Fails on main's code for the stdin and `SIGTERM` counts.
3. **Fix (green).** `bindToParentProcess` in `executor.util.ts` returning
   its cleanup; `runCommandProcess` calls it; stdin paused once no `data`
   listener is left.
   Check: `npx nx test nx-aws-cdk-v2` (no "failed to exit gracefully"),
   `typecheck-specs`, `lint`, `format:write`, `npx nx e2e nx-aws-cdk-v2-e2e`.
   Commit (2+3): `fix(nx-aws-cdk-v2): remove runCommandProcess' process listeners once the cdk process closes`.
4. **PR** to `main` with spec, plan and code, `Closes #2895`; review,
   acceptance results in the description.
