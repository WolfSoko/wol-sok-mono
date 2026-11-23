# Plan: Jest workers oversubscribe the CPU under Nx parallel 6 ([#3172](https://github.com/WolfSoko/wol-sok-mono/issues/3172))

Spec: [docs/specs/3172-ci-jest-workers-oversubscribe-the-cpu-under-nx-parallel-6.md](../specs/3172-ci-jest-workers-oversubscribe-the-cpu-under-nx-parallel-6.md)

## Task 1: a test that pins the Jest share

- Test first: `tools/ci/jest-workers.test.mjs` (`node --test`, run by
  `npx nx test tools`): loads `jest.preset.cjs` and expects `maxWorkers` to
  equal `ceil(os.availableParallelism() / nx.json parallel)`, and
  `nx.json`'s `parallel` to be a positive integer. Red before task 2.
- Commit with task 2.

## Task 2: `maxWorkers` in the preset

- Code: `jest.preset.cjs`: a named function `workersPerJestTask()` that reads
  `parallel` from `nx.json` and divides `availableParallelism()` by it,
  rounded up; the preset sets `maxWorkers` from it. `jest.preset.cjs`
  joins the inputs of `tools:test` (`tools/project.json`), which now reads it. A comment says
  why (#3172) and that a project's or the command line's `maxWorkers` wins.
- Commit: `fix(tools): cap the Jest workers of a task at its share of the cores`

## Task 3: docs

- `CLAUDE.md`, Testing: one bullet on the Jest share and the test that keeps it.
- Spec: fill in the measurement table.
- Same commit as task 2.

## Checks

- `npx nx test tools`
- The 8-core run of every Jest project (spec, Measurement), with and
  without the change.
- `npx nx run portfolio-cdk:test` (own `maxWorkers: 1`) and one project with
  `--maxWorkers=2` (acceptance 2).
- `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
