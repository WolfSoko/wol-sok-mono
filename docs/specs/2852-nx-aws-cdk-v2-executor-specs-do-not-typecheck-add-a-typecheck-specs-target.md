# Spec #2852: nx-aws-cdk-v2: executor specs do not typecheck; add a typecheck-specs target

Sub-issue of [#2822](https://github.com/WolfSoko/wol-sok-mono/issues/2822),
found during [#2842](https://github.com/WolfSoko/wol-sok-mono/issues/2842).

## Goal

`npx tsc -p libs/public/nx-aws-cdk-v2/tsconfig.spec.json --noEmit` reports no
errors, and CI keeps it that way through a `typecheck-specs` target on
`nx-aws-cdk-v2`.

Today the command reports 16 errors, all in
`src/executors/{bootstrap,deploy,destroy,synth}/*.spec.ts`:

- 14 × TS18048 `'mockProcess' is possibly 'undefined'`: every test declares an
  untyped `let mockProcess;`, assigns it inside the `exec` mock's
  implementation and then calls `mockProcess.emit('close', 0)`.
- TS7053 in `deploy.spec.ts` (`option['hotswap'] = true`) and in
  `synth.spec.ts` (`option['exclusively'] = true`): the schema types hold only
  `stacks`, `profile` and `context`, while `schema.json` allows further
  properties, which the executors forward to the cdk CLI.

## Non-goals

- No change to the executors, their `schema.json` or their published
  `schema.d.ts` types (the specs follow the types, as in
  [#2815](https://github.com/WolfSoko/wol-sok-mono/issues/2815)).
- No typecheck-specs target for the other projects of #2822.
- The flaky synth test of `nx-aws-cdk-v2-e2e` stays out of scope.

## Decisions

- **One fake child process and one run helper for all four specs**, in
  `src/utils/testing.ts` beside `mockExecutorContext`: `FakeChildProcess` (an
  `EventEmitter` with `stdout` and `stderr`) and
  `runExecutorToExit(exec, run, exitCode = 0)`, which starts the executor,
  takes the process the mocked `exec` spawned last and lets it close with the
  exit code. It throws when the executor spawned no fake process, rather than
  letting the test hang. The four specs each copy their own `MockChildProcess`
  and the same five lines per test today; this removes both the copies and
  the untyped variable. The helper takes the mock as a parameter and uses no
  Jest globals, because `testing.ts` is compiled by `tsconfig.lib.json`,
  which has no Jest types.
- **Options outside the schema typed as an intersection**:
  `DeployExecutorSchema & { hotswap: boolean }` (and
  `SynthExecutorSchema & { exclusively: boolean }`). That states what the
  test exercises, an option the schema type does not name, without widening
  the published types with an index signature.
- **One new test**: the deploy executor reports `success: false` when the cdk
  process exits with a non-zero code. The helper's `exitCode` makes it a
  one-liner, and no spec covers the failure path today.
- **`"typecheck-specs": {}`** in `project.json`; command, inputs and caching
  come from `targetDefaults` in `nx.json`.
- **Commit type `test(nx-aws-cdk-v2)`**: no behaviour of the published
  plugin changes, so no release of it is needed.

## Acceptance

1. `npx tsc -p libs/public/nx-aws-cdk-v2/tsconfig.spec.json --noEmit` reports
   no errors.
2. `npx nx typecheck-specs nx-aws-cdk-v2` exists and passes; it fails when a
   type error is put into a spec (checked by hand, not committed).
3. `npx nx test nx-aws-cdk-v2` passes, including the new non-zero-exit test.
4. `npx nx build nx-aws-cdk-v2` and `npx nx lint nx-aws-cdk-v2` pass.
5. No spec of the four executors declares its own child-process fake or an
   untyped `mockProcess`.

## Open questions

None.
