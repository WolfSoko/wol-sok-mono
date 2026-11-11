# Spec #2895: nx-aws-cdk-v2: runCommandProcess leaks process listeners; test helpers ship in the published build

Issue: [#2895](https://github.com/WolfSoko/wol-sok-mono/issues/2895). Found on
[#2852](https://github.com/WolfSoko/wol-sok-mono/issues/2852)
([PR #2893](https://github.com/WolfSoko/wol-sok-mono/pull/2893)). Both parts
are in `libs/public/nx-aws-cdk-v2`, published as `@wolsok/nx-aws-cdk-v2`.

## Goal

1. A finished `runCommandProcess` (`src/utils/executor.util.ts`) leaves no
   listener on the parent process behind: no `exit`, no `SIGTERM` and no
   stdin `data` listener, and stdin no longer kept flowing by it. Executor
   runs and specs no longer pile up listeners, and `npx nx test
   nx-aws-cdk-v2` no longer warns "A worker process has failed to exit
   gracefully".
2. The published package holds no test helper: `mockExecutorContext`,
   `spawnFakeChildProcess` and `runExecutorToExit` are not in
   `dist/libs/public/nx-aws-cdk-v2`.

## Non-goals

- No change to the command the executors build, its output forwarding or
  its result (`true` on exit code 0, else `false`).
- No switch from `exec` to `spawn`, no new stdin semantics (stdin is still
  forwarded once and then closed on the child).
- No `tsconfig` target change (`libs/public/*` stay as they are).

## Decisions

- **One place owns the parent's listeners.** A small function in
  `executor.util.ts`, `bindToParentProcess(childProcess)`, adds the `exit`
  and `SIGTERM` listener (kill the child) and the stdin `data` forwarder,
  and returns the function that removes all three. `runCommandProcess`
  calls it on start and on the child's `close`, so the add and the remove
  can no longer name different functions (the bug:
  `process.stdin.removeListener('data', processExitListener)` named a
  function that was never on stdin).
- **Stdin is paused again once no `data` listener is left.** Node does not
  pause a stream when its last `data` listener goes, so a removed listener
  alone still keeps stdin flowing and the event loop alive. Pausing replaces
  the old `process.stdin.end()` on a TTY, which ends the writable side of a
  readable stream and did not stop the reading. Another listener (a second
  executor still running) keeps stdin flowing. Binding resumes stdin
  explicitly, since a stream paused that way stays paused when the next
  run adds its `data` listener.
- **The helpers move to `src/testing/`**, as `src/testing/executor.ts`:
  `tsconfig.lib.json` already excludes `src/testing/**` and
  `tsconfig.spec.json` already includes it (it holds `generated-test.ts`).
  That is cheaper to keep right than another exclude entry for a file
  inside `src/utils/`, which the next helper beside it would miss.
- **A spec proves both parts.** `executor.util.spec.ts` checks the listener
  counts on `process` and `process.stdin` before and after a run (also on a
  failing exit code), that stdin is paused afterwards, and that a run still
  forwards stdin and kills the child on `SIGTERM`. The build check is a
  manual acceptance step (the build output is listed in the PR), since a
  spec of the dist would need the build in the test target.

## Acceptance

1. `executor.util.spec.ts`: after `runCommandProcess` resolves (exit code 0
   and non-zero), `process.listenerCount('exit')`,
   `process.listenerCount('SIGTERM')` and
   `process.stdin.listenerCount('data')` equal their values before the run.
2. Same spec: while running, stdin flows and its data reaches the child's
   stdin, a `SIGTERM` listener call kills the child, and stdin is paused
   after each of two runs in a row.
3. `npx nx test nx-aws-cdk-v2` passes without the "failed to exit
   gracefully" warning.
4. `npx nx build nx-aws-cdk-v2`: no file under
   `dist/libs/public/nx-aws-cdk-v2` contains `mockExecutorContext`,
   `spawnFakeChildProcess` or `runExecutorToExit`, and no `src/utils/testing.*`
   exists there.
5. `typecheck-specs`, `lint` pass; `npx nx e2e nx-aws-cdk-v2-e2e` behaves as
   on main.

## Open questions

None.
