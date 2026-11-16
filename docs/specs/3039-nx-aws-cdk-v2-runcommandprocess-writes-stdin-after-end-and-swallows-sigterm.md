# nx-aws-cdk-v2: runCommandProcess writes stdin after end and swallows SIGTERM

Issue: [#3039](https://github.com/WolfSoko/wol-sok-mono/issues/3039)

## Goal

`runCommandProcess` (`libs/public/nx-aws-cdk-v2/src/utils/executor.util.ts`), which all four executors (`bootstrap`, `deploy`, `destroy`, `synth`) of the published `@wolsok/nx-aws-cdk-v2` use, has two faults found by the review of PR [#3029](https://github.com/WolfSoko/wol-sok-mono/pull/3029):

1. It forwards the parent's stdin to the `cdk` child by hand and calls `stdin.end()` after the first chunk, but keeps listening. A second chunk (Enter typed twice at cdk's y/n prompt, piped input split in two) writes after end: an uncaught `ERR_STREAM_WRITE_AFTER_END` crashes the executor mid-deploy.
2. Its `SIGTERM` listener replaces Node's default handler and only kills the child, so a cancelled CI job keeps the executor running and it ends as a plain failure instead of being terminated.

After this change, `cdk` reads the terminal directly, and a `SIGTERM` to the executor ends both processes, the executor by the signal.

## Non-goals

- No change to the command the executors build (`createCommand`, `generateCommandString`) or to their options.
- No `SIGINT` handling: Ctrl-C reaches the whole foreground process group, `cdk` included, and Node's default ends the executor.
- No timeout or `SIGKILL` escalation when `cdk` ignores a forwarded `SIGTERM`.

## Decisions

- **`spawn(command, { shell: true, stdio: 'inherit', cwd, env })` instead of `exec`.** The child shares the parent's stdin, stdout and stderr: no forwarding, so no write after end, and no `pause`/`resume` of `process.stdin` (the fix of [#2895](https://github.com/WolfSoko/wol-sok-mono/issues/2895) goes away with its cause). `shell: true` keeps the command string as it is built today (it quotes the `-a` app command). As a bonus `cdk` sees the real terminal (colours, prompts) where there is one.
- **`maxBuffer` and `LARGE_BUFFER` go**: `spawn` with inherited stdio buffers nothing. `LARGE_BUFFER` is not exported from the package's entry point.
- **`SIGTERM` is forwarded, then re-raised.** The issue suggested `inherit` removes the SIGTERM problem too; it does not on its own: without a listener the executor dies at once and `cdk` keeps running unless whoever sent the signal kills the whole tree. So the listener stays, sends `SIGTERM` to the child, and once the child has closed it removes every listener it added and sends `SIGTERM` to its own process again (`process.kill(process.pid, 'SIGTERM')`): with no other listener, Node's default ends the executor terminated by the signal; listeners Nx or a consumer added still run. The promise does not settle after a forwarded signal. The child is the shell `shell: true` starts, and neither `sh` nor `npm exec` passes the signal on, so what runs below it (`cdk`, the app) is ended by whoever stops the whole tree: Nx does (`killProcessTreeGraceful`), checked through Nx below. Killing the tree from the executor is no goal here.
- **The `exit` listener stays**: when the executor's process exits otherwise (`process.exit`), it kills the child.
- **Exit code as before**: the promise resolves `true` for exit code 0, `false` for anything else, a child ended by a signal included.
- **Test fake**: `FakeChildProcess` (`src/testing/executor.ts`) loses its stdout/stderr/stdin parts and records the signals it was killed with; the executor specs mock `spawn` instead of `exec`.
- **README**: the section "How the executors invoke the CDK CLI" says that `cdk` shares the task's terminal and how `SIGTERM` is handled.

## Acceptance

1. `runCommandProcess` spawns the command with `shell: true`, `stdio: 'inherit'`, the given `cwd` and `process.env`, and adds no `data` listener to `process.stdin` (spec).
2. It resolves `true` on exit code 0 and `false` otherwise, and leaves no `exit` or `SIGTERM` listener behind (spec).
3. On `SIGTERM` it sends `SIGTERM` to the child; once the child closed it removes its listeners and re-raises `SIGTERM` on its own process (spec, with `process.kill` stubbed).
4. Each executor spec calls `spawn` with its command and the options above (specs).
5. Run by hand from a real Node process: two stdin chunks reach a child that reads both, with no crash; `SIGTERM` to the parent ends its direct child and the parent exits by the signal (manual, noted in the PR).
6. Run by hand through Nx (a synth target): cdk's output shows in Nx's task output and is replayed on a cache hit, and `SIGTERM` to the `nx` process ends cdk (manual, noted in the PR).
7. `nx test nx-aws-cdk-v2`, its lint and `nx e2e nx-aws-cdk-v2-e2e` pass (the e2e's synth case as on `main`).

## Open questions

None.
