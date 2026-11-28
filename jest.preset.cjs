const { availableParallelism } = require('node:os');
const { join } = require('node:path');
const nxPreset = require('@nx/jest/preset').default;
require('cross-fetch/polyfill');
const { parallel: CONFIGURED_PARALLEL } = require('./nx.json');

function isTaskCount(value) {
  return Number.isInteger(value) && value > 0;
}

if (!isTaskCount(CONFIGURED_PARALLEL)) {
  throw new Error(
    `jest.preset.cjs: nx.json needs a positive integer "parallel", got ${CONFIGURED_PARALLEL}`
  );
}

/**
 * How many tasks Nx runs at once: `NX_PARALLEL` where the run sets it (tasks
 * inherit it), else `nx.json`'s `parallel`. A `--parallel` flag never reaches
 * the task, so that one run keeps the
 * share of `NX_PARALLEL` or `nx.json`.
 */
function parallelNxTasks() {
  const fromEnv = Number(process.env.NX_PARALLEL);
  return isTaskCount(fromEnv) ? fromEnv : CONFIGURED_PARALLEL;
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
  return Math.ceil(availableParallelism() / parallelNxTasks());
}

module.exports = {
  ...nxPreset,
  coverageReporters: ['lcov', 'html', 'text-summary'],
  maxWorkers: workersPerJestTask(),
  modulePathIgnorePatterns: ['<rootDir>/e2e/'],
  // the Ace wrapper of @wolsok/ui-kit/code-editor names no entry Jest finds;
  // its UMD bundle is CommonJS. A project's own moduleNameMapper replaces
  // this one, so a project with one that renders the editor repeats it.
  moduleNameMapper: {
    '^ngx-ace-editor-wrapper$': join(
      __dirname,
      'node_modules/ngx-ace-editor-wrapper/dist/ngx-ace-editor-wrapper.umd.js'
    ),
  },
};
