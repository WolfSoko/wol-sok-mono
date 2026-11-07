# Spec #2831: nx-aws-cdk-v2-e2e: synth test fails on main, and CI never runs the plugin e2e

Found while working on [#2824](https://github.com/WolfSoko/wol-sok-mono/issues/2824)
([PR #2829](https://github.com/WolfSoko/wol-sok-mono/pull/2829)). Related:
[#2822](https://github.com/WolfSoko/wol-sok-mono/issues/2822) (typecheck
targets CI never runs), [#2835](https://github.com/WolfSoko/wol-sok-mono/issues/2835).

## Goal

1. The plugin e2e test _"should synthesize the stack via nx using the cdk
   cli"_ (`apps/nx-aws-cdk-v2-e2e/tests/aws-cdk.spec.ts`) passes again.
2. CI runs the plugin e2e whenever `nx-aws-cdk-v2` (or the e2e project
   itself) is affected, so a broken published plugin no longer reaches `main`
   unnoticed.

Today the synth task succeeds, but `runNxCommandAsync('run <app>:synth')`
gets only Nx's run summary on stdout (_"Re-run with --output-style=static to
inline logs"_): with stdout not a terminal, Nx no longer inlines a task's log.
`expect(stdout).toContain(plugin)` then misses the stack name the cdk CLI
printed. The test `nx test <app>` avoids the same trap by passing
`--output-style=stream`.

CI runs `nx affected -t=...,e2e-ci,...`; the e2e project has only an `e2e`
target, so nothing ever runs it outside a developer's shell.

## Non-goals

- No change to the plugin itself (`libs/public/nx-aws-cdk-v2`): the synth
  works, only the test reads the wrong output.
- The skipped `bootstrap` tests stay skipped (they need an AWS account or
  LocalStack).
- No new runner or CI job: the e2e runs on the Nx Cloud workers like every
  other `e2e-ci` task.
- [#2822](https://github.com/WolfSoko/wol-sok-mono/issues/2822)'s typecheck
  targets stay their own issue.

## Decisions

1. **Ask Nx for the task log instead of dropping the assertion.** The synth
   call passes `--output-style=stream`, like the `nx test` call already does.
   The stdout check is the one place the test sees that the cdk CLI itself ran
   and reported the stack, so it asserts on the template cdk prints
   (`aws:cdk:path: <stack>/CDKMetadata`), not on the stack name, which Nx's own
   lines carry too; `cdk.out` alone would also pass if the files came
   from somewhere else. Both calls go through one helper in the spec
   (`runNxTaskWithLogs`), which adds the flag and strips terminal escape
   codes, so the next test that reads a task's output does not fall into the
   same trap.
2. **CI runs it through an `e2e-ci` target that depends on `e2e`.** The e2e
   project gets `"e2e-ci": { "executor": "nx:noop", "dependsOn": ["e2e"] }`.
   `nx affected -t e2e-ci` then picks it up whenever the plugin is affected
   (the project's `implicitDependencies` already name `nx-aws-cdk-v2`), with
   no second copy of the Jest options; `npx nx e2e nx-aws-cdk-v2-e2e` stays
   the command to run it by hand. Renaming `e2e` to `e2e-ci` would break that
   documented command for nothing.
3. **No cache, no coverage for `e2e`.** The suite installs the generated
   app's dependencies from the registry against caret ranges
   (`aws-cdk-lib`, `aws-cdk`), so the same inputs can give another result
   tomorrow: `e2e` sets `cache: false`, and a run that is affected always
   runs. Its `ci` configuration turns off the `codeCoverage` the Jest
   defaults switch on for CI, so the e2e's coverage does not reach Codecov
   as unit-test coverage. CI still runs it only when the plugin or the e2e
   is affected; a new aws-cdk-lib release alone does not trigger it.
4. **The CLAUDE.md line about the plugin e2e is updated**: CI now runs it on
   affected PRs; running it by hand after a plugin change stays useful for a
   fast loop.

## Acceptance

1. `npx nx e2e nx-aws-cdk-v2-e2e` passes locally: all 6 tests that are not
   skipped, the synth test included (it failed on `main` before the change,
   reproduced in this session).
2. `npx nx show projects --affected -t e2e-ci` (or the project graph) lists
   `nx-aws-cdk-v2-e2e` when `nx-aws-cdk-v2` changes, and `npx nx run
   nx-aws-cdk-v2-e2e:e2e-ci` runs the Jest suite.
3. The PR's CI run (`nx affected -t ...,e2e-ci,...`) runs
   `nx-aws-cdk-v2-e2e:e2e` on the Nx Cloud workers and it passes there.
4. `nx lint nx-aws-cdk-v2-e2e`, `nx format:check` pass.

## Open questions

- If the suite cannot pass on the Nx Cloud workers (for example because the
  throwaway workspace's `npm install` or the Nx environment of the parent
  task interferes), the PR stops there and asks before any workaround.
