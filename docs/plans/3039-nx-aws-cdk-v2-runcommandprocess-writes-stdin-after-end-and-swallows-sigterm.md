# Plan: nx-aws-cdk-v2 runs cdk with inherited stdio

Spec: [docs/specs/3039-nx-aws-cdk-v2-runcommandprocess-writes-stdin-after-end-and-swallows-sigterm.md](../specs/3039-nx-aws-cdk-v2-runcommandprocess-writes-stdin-after-end-and-swallows-sigterm.md)

1. **Fake** — `src/testing/executor.ts`: `FakeChildProcess` without stdout/stderr/stdin, recording `kill` signals; `spawnFakeChildProcess` for a mocked `spawn`. Same commit as 2.
2. **runCommandProcess** — test first: `src/utils/executor.util.spec.ts` (spawn options, no stdin listener, exit codes, no listeners left, SIGTERM forwarded then re-raised after close with `process.kill` stubbed); then `executor.util.ts` (`spawn` with `shell: true` and `stdio: 'inherit'`, `bindToParentProcess` with `exit` and `SIGTERM` only, `LARGE_BUFFER` removed). Commit `fix(nx-aws-cdk-v2): run cdk with the task's stdio and end on SIGTERM`.
3. **Executor specs** — `bootstrap`, `deploy`, `destroy`, `synth` specs mock `spawn` and expect the new options. Same commit.
4. **README** — "How the executors invoke the CDK CLI": terminal and SIGTERM. Same commit.
5. **Manual check** — a scratch script runs `runCommandProcess` from a real Node process: two stdin chunks, then SIGTERM; result into the PR.
6. Checks: `nx format:write`, `nx affected -t lint,lint-templates,test --base=origin/main`, `nx e2e nx-aws-cdk-v2-e2e`.
