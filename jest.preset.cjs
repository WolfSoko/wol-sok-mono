const { availableParallelism } = require('node:os');
const nxPreset = require('@nx/jest/preset').default;
require('cross-fetch/polyfill');
const { parallel: NX_PARALLEL_TASKS } = require('./nx.json');

/**
 * The workers one Jest task may start: its share of the cores, rounded up.
 * Nx runs `parallel` tasks at once, and Jest alone would start a worker per
 * core minus one in each, which oversubscribed the CPU on the CI workers until
 * specs near the timeout failed at random (#3172). Rounding up keeps the
 * largest suites off a single in-band process (8 cores, 6 tasks: 2 each).
 * A project's own `maxWorkers` and `--maxWorkers` on the command line win.
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
