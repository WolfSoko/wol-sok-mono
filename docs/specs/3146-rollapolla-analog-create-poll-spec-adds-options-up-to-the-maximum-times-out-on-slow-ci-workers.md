# 3146: create-poll spec 'adds options up to the maximum' times out on slow CI workers

Issue: [#3146](https://github.com/WolfSoko/wol-sok-mono/issues/3146)

## Goal

The spec `adds options up to the maximum` in `apps/rollapolla-analog/src/app/core/create-poll/create-poll.component.spec.ts` runs in a fraction of Vitest's default 5000 ms timeout even on a loaded Nx Cloud worker, so it no longer turns a main run red. It still proves what it claims: the add button adds options up to `PollsRepoPort.MAX_OPTIONS` and no further, and is disabled at the maximum.

## Non-goals

- No change to `CreatePollComponent` or its template: the component is right, the test is slow.
- No raised timeout, per test or in `vite.config.ts`: that hides the cost instead of removing it.
- No change to the other specs of the file or to other flaky specs elsewhere.

## Decisions

- **Change detection once, not after every click.** The test clicks 20 times and runs `fixture.detectChanges()` after each click, so it renders the growing list of Material form fields 20 times (up to 10 fields each). Those renders are what disabled the button after the eighth click: from then on the disabled native button swallowed the clicks, so the old test checked the `[disabled]` binding and never reached the guard `options.length < maxOptions` in `addOption()`. The click handler changes the form array without change detection, so the new test clicks, then runs change detection once and asserts; the guard alone caps the list, and the one render checks the binding.
- **More clicks than there is room for.** The test clicks `MAX_OPTIONS` times, the count named after the constant instead of the magic `20`. From the two starting options it tries `MAX_OPTIONS + 2` options, so the guard refuses the last two clicks and the list must stop at `MAX_OPTIONS`.
- **The disabled state is asserted after the one render**, as before.

## Acceptance

1. The test clicks the add button more often than there is room for, runs change detection once and expects `MAX_OPTIONS` option inputs and a disabled add button.
2. The loop count derives from `PollsRepoPort.MAX_OPTIONS`; no magic `20`.
3. The test fails if the guard in `addOption()` is removed (checked once by hand).
4. `npx nx test rollapolla-analog` passes; the test's own time drops clearly (measured before and after, noted in the PR).
5. Lint, template lint, format and `typecheck-specs` of `rollapolla-analog` pass.

## Open questions

None.
