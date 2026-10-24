import { expect, test } from '@playwright/test';
import { buildSync } from 'esbuild';
import { join } from 'node:path';
import { BALANCE_VERSION } from '../src/engine';
import { SIM_SCENARIOS } from '../src/lib/state/gpu-int/sim-scenarios';
import golden from './golden-gpu-int.json';
import simGolden from './golden-gpu-sim.json';
import { SCENARIOS } from './scenarios';

/**
 * The integer shaders against their TypeScript reference, tick by tick, on
 * SwiftShader (ADR 0015, steps 6 and 7) - the passes alone, and whole
 * matches through the game's `GpuSimulation` against `IntSimulation` - plus
 * the self-test a device runs. The deterministic simulation promises the
 * same state on every GPU, and this is the one CI can run. A device whose
 * driver breaks the promise fails the self-test there, not here.
 */
const bundle = buildSync({
  entryPoints: [join(__dirname, 'harness.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'gpuCrosscheck',
  write: false,
  logLevel: 'silent',
}).outputFiles[0].text;

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><title>GPU cross-check</title>');
  await page.addScriptTag({ content: bundle });
});

interface Harness {
  crosscheck(name: string): number[];
  simCrosscheck(name: string): number[];
  selfTest(): {
    ok: boolean;
    firstBadTick?: number;
    renderer: string;
    ms: number;
  };
  renderer(): string;
}

declare global {
  interface Window {
    gpuCrosscheck: Harness;
  }
}

test('runs on SwiftShader, with goldens of this balance version', async ({
  page,
}) => {
  const renderer = await page.evaluate(() => window.gpuCrosscheck.renderer());
  expect(renderer).toMatch(/SwiftShader/i);
  expect(golden.balanceVersion).toBe(BALANCE_VERSION);
  expect(simGolden.balanceVersion).toBe(BALANCE_VERSION);
});

test("the game's self-test passes on SwiftShader", async ({ page }) => {
  const result = await page.evaluate(() => window.gpuCrosscheck.selfTest());
  console.log(
    `GPU self-test: ${result.ms.toFixed(1)} ms on ${result.renderer}`
  );
  expect(result.ok, `the first tick that differs: ${result.firstBadTick}`).toBe(
    true
  );
});

for (const scenario of SIM_SCENARIOS) {
  test(`${scenario.name}: the game's GpuSimulation plays as IntSimulation`, async ({
    page,
  }) => {
    const gpu = await page.evaluate(
      (name) => window.gpuCrosscheck.simCrosscheck(name),
      scenario.name
    );
    // The goldens are IntSimulation's hashes - `sim-golden.spec.ts` checks it.
    const expected =
      simGolden.hashes[scenario.name as keyof typeof simGolden.hashes];
    const firstMismatch = gpu.findIndex((hash, i) => hash !== expected[i]);
    expect(
      firstMismatch,
      'the first tick the GPU differs on, -1 for none'
    ).toBe(-1);
    expect(gpu).toEqual(expected);
  });
}

for (const name of Object.keys(SCENARIOS)) {
  test(`${name}: every tick on the GPU hashes as the reference`, async ({
    page,
  }) => {
    const gpu = await page.evaluate(
      (scenario) => window.gpuCrosscheck.crosscheck(scenario),
      name
    );
    // The goldens are the reference's hashes - `golden.spec.ts` checks that.
    const expected = golden.hashes[name as keyof typeof golden.hashes];
    const firstMismatch = gpu.findIndex((hash, i) => hash !== expected[i]);
    expect(
      firstMismatch,
      'the first tick the GPU differs on, -1 for none'
    ).toBe(-1);
    expect(gpu).toEqual(expected);
  });
}
