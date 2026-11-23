const { availableParallelism } = require('node:os');
const nxPreset = require('@nx/jest/preset').default;
require('cross-fetch/polyfill');
const { parallel: NX_PARALLEL_TASKS } = require('./nx.json');

if (!Number.isInteger(NX_PARALLEL_TASKS) || NX_PARALLEL_TASKS < 1) {
  throw new Error(
    `jest.preset.cjs: nx.json needs a positive integer "parallel", got ${NX_PARALLEL_TASKS}`
  );
}

/**
 * The workers one Jest task may start: its share of the cores, rounded up.
 * Nx runs `parallel` tasks at once, and Jest alone would start a worker per
 * core minus one in each, which oversubscribed the CPU on the CI workers until
 * specs near the timeout failed at random (#3172). Rounding up keeps the
 * largest suites off a single in-band process (an Nx Cloud worker reports
 * 10 cores; with 6 tasks that is 2 workers each).
 * A project's own `maxWorkers` and `--maxWorkers` on the command line win;
 * the root `jest.config.ts` (`projects` mode, which Nx never runs) ignores it.
 */
function workersPerJestTask() {
  return Math.ceil(availableParallelism() / NX_PARALLEL_TASKS);
}

module.exports = {
  ...nxPreset,
  coverageReporters: ['lcov', 'html', 'text-summary'],
  maxWorkers: workersPerJestTask(),
  modulePathIgnorePatterns: ['<rootDir>/e2e/'],
};
