// Keeps the Jest workers of a task at its share of the cores (#3172). Nx runs
// `parallel` tasks at once; without `maxWorkers` each Jest task starts one
// worker per core minus one, so six of them on a 10-core Nx Cloud worker ran
// up to 54 workers and specs near the 5 s timeout failed at random.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT, readJson } from './workspace-projects.mjs';

const PRESET = join(ROOT, 'jest.preset.cjs');

/** The preset's `maxWorkers`, loaded in a process with the given NX_PARALLEL. */
function presetWorkers(nxParallel) {
  const env = { ...process.env };
  delete env.NX_PARALLEL;
  if (nxParallel !== undefined) env.NX_PARALLEL = nxParallel;
  const script = `process.stdout.write(String(require(${JSON.stringify(PRESET)}).maxWorkers))`;
  return Number(execFileSync(process.execPath, ['-e', script], { env }));
}

void describe('the Jest workers per task', () => {
  const parallel = readJson('nx.json').parallel;
  const cores = availableParallelism();

  void it('divide the cores by the tasks Nx runs at once', () => {
    assert.ok(
      Number.isInteger(parallel) && parallel > 0,
      `nx.json parallel must be a positive integer, got ${parallel}`
    );
  });

  void it('are set by jest.preset.cjs from nx.json, rounded up', (t) => {
    const workers = presetWorkers(undefined);
    // Shows the machine's share in the log; a cache hit replays the log of the
    // machine that ran it, so read it from a cache-miss run (#3172).
    t.diagnostic(`cores ${cores}, parallel ${parallel}, maxWorkers ${workers}`);
    assert.equal(workers, Math.ceil(cores / parallel));
  });

  void it('follow NX_PARALLEL where a run sets it', () => {
    assert.equal(presetWorkers('1'), cores);
    assert.equal(presetWorkers(String(cores * 2)), 1);
  });

  void it('fall back to nx.json on an unusable NX_PARALLEL', () => {
    assert.equal(presetWorkers('lots'), Math.ceil(cores / parallel));
  });
});
