// Keeps the Jest workers of a task at its share of the cores (#3172). Nx runs
// `parallel` tasks at once; without `maxWorkers` each Jest task starts one
// worker per core minus one, so six of them on a 10-core Nx Cloud worker ran
// up to 54 workers and specs near the 5 s timeout failed at random.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT, readJson } from './workspace-projects.mjs';

const require = createRequire(import.meta.url);

void describe('the Jest workers per task', () => {
  const parallel = readJson('nx.json').parallel;

  void it('divide the cores by the tasks Nx runs at once', () => {
    assert.ok(
      Number.isInteger(parallel) && parallel > 0,
      `nx.json parallel must be a positive integer, got ${parallel}`
    );
  });

  void it('are set by jest.preset.cjs, rounded up', (t) => {
    const preset = require(join(ROOT, 'jest.preset.cjs'));
    // Shows the machine's share in the log; a cache hit replays the log of the
    // machine that ran it, so read it from a cache-miss run (#3172).
    t.diagnostic(
      `cores ${availableParallelism()}, parallel ${parallel}, maxWorkers ${preset.maxWorkers}`
    );
    assert.equal(
      preset.maxWorkers,
      Math.ceil(availableParallelism() / parallel)
    );
  });
});
