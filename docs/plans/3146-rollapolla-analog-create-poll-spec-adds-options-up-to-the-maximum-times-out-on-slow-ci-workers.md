# Plan 3146: create-poll spec 'adds options up to the maximum' times out on slow CI workers

Spec: `docs/specs/3146-rollapolla-analog-create-poll-spec-adds-options-up-to-the-maximum-times-out-on-slow-ci-workers.md`

1. **Measure the current time.** Run `npx nx test rollapolla-analog` on the file with Vitest's verbose reporter and note the test's duration.
2. **Rewrite the test** in `apps/rollapolla-analog/src/app/core/create-poll/create-poll.component.spec.ts`: click `PollsRepoPort.MAX_OPTIONS` times without change detection, then `fixture.detectChanges()` once, then assert `MAX_OPTIONS` inputs and the disabled button. Check by hand that removing the guard in `addOption()` fails it, then restore the guard. Measure again.
3. **Checks and commit.** `npx nx format:write`, `npx nx affected -t lint,lint-templates`, `npx nx run rollapolla-analog:typecheck-specs`, `npx nx test rollapolla-analog`. One commit with spec, plan and test: `test(rollapolla-analog): render the create-poll form once in the max-options spec (#3146)`.
