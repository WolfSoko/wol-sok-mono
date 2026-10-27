import { appendFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { BacteriaGamePo } from './pos/bacteria-game.po';

/**
 * Frame time in the browser (ADR 0014, gate 3), report-only: a local match
 * against the computer on the CPU simulation, played for {@link MATCH_SEC}
 * seconds from a fixed seed, and what it cost - the frame interval, long
 * tasks and the engine's time per tick through the game's probe
 * (`state/perf-probe.ts`). It fails only when nothing was measured.
 * Headless Chromium on a shared CI worker with a software renderer says
 * little about a phone: the numbers show trends and catch a regression by
 * an order of magnitude.
 */

/** Seconds of the match measured. */
const MATCH_SEC = 20;
/** The seed `Math.random` is pinned to, so the match plays alike each run. */
const SEED = 20261027;
/** A task this long is a long task to the browser. */
const LONG_TASK_MS = 50;

interface PageNumbers {
  frameMs: number[];
  tickMs: number[];
  longTaskMs: number[];
  calibrationMs: number;
}

test('should report the frame time of a match on the CPU simulation', async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== 'chromium', 'Measured in Chromium only');
  test.setTimeout(120_000);

  await page.addInitScript(
    ({ seed, probeKey }) => {
      // The seed of the match, and everything else drawn at random.
      let state = seed >>> 0;
      Math.random = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const scope = window as unknown as Record<string, unknown>;
      scope[probeKey] = { tickMs: [] };
      const frameMs: number[] = [];
      const longTaskMs: number[] = [];
      scope['__perfFrames'] = frameMs;
      scope['__perfLongTasks'] = longTaskMs;
      let last: number | null = null;
      const onFrame = (now: number): void => {
        if (last !== null) {
          frameMs.push(now - last);
        }
        last = now;
        requestAnimationFrame(onFrame);
      };
      requestAnimationFrame(onFrame);
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTaskMs.push(entry.duration);
        }
      }).observe({ type: 'longtask' });
    },
    { seed: SEED, probeKey: '__bacteriaPerfProbe' }
  );

  const po = new BacteriaGamePo(page);
  await po.goto('/?sim=cpu');
  await po.startMatch();
  await expect(po.playArea).toHaveAttribute('data-simulation', 'cpu');

  // Measured from the start of the match on.
  await page.evaluate(() => {
    const scope = window as unknown as Record<string, unknown[]>;
    scope['__perfFrames'].length = 0;
    scope['__perfLongTasks'].length = 0;
    (scope['__bacteriaPerfProbe'] as unknown as { tickMs: number[] }).tickMs =
      [];
  });
  await page.waitForTimeout(MATCH_SEC * 1000);
  // A match over sooner would leave the frames measured past its end and
  // the ticks short of them: the numbers would not compare.
  await expect(po.winner).toHaveCount(0);

  const numbers = await page.evaluate((): PageNumbers => {
    const scope = window as unknown as Record<string, unknown>;
    // The calibration loop of the engine benchmark
    // (tools/perf/engine-bench.mjs), run in the page: keep the two alike.
    const calibrate = (): number => {
      const cells = new Int32Array(1 << 16);
      const energy = new Float32Array(1 << 16);
      let seed = 0x9e3779b9;
      let sum = 0;
      for (let round = 0; round < 120; round++) {
        for (let i = 0; i < cells.length; i++) {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          const j = (seed >>> 0) & (cells.length - 1);
          cells[j] = (cells[j] + i) | 0;
          energy[i] = energy[i] * 0.98 + (cells[j] & 255) * 0.01;
          sum = (sum + cells[i]) | 0;
        }
      }
      return sum + energy[7];
    };
    const times: number[] = [];
    for (let i = 0; i < 25; i++) {
      const start = performance.now();
      calibrate();
      // The first 10 warm up.
      if (i >= 10) {
        times.push(performance.now() - start);
      }
    }
    times.sort((a, b) => a - b);
    return {
      frameMs: [...(scope['__perfFrames'] as number[])],
      tickMs: [
        ...(scope['__bacteriaPerfProbe'] as { tickMs: number[] }).tickMs,
      ],
      longTaskMs: [...(scope['__perfLongTasks'] as number[])],
      calibrationMs: times[Math.floor(times.length / 2)],
    };
  });

  const report = summarise(numbers);
  const table = [
    `Frame time (ADR 0014, gate 3): ${MATCH_SEC} s of a match on the CPU simulation, seed ${SEED}`,
    `Calibration loop in the page: ${report.calibrationMs.toFixed(1)} ms`,
    '',
    '| Measure | p50 | p95 | max | ratio p50 / calibration |',
    '| --- | ---: | ---: | ---: | ---: |',
    row('frame interval', report.frame, report.calibrationMs),
    row('engine tick', report.tick, report.calibrationMs),
    '',
    `Ticks played: ${report.ticks} · frames: ${report.frames} · long tasks (over ${LONG_TASK_MS} ms): ${report.longTasks.count}, ${report.longTasks.totalMs.toFixed(0)} ms in all`,
  ].join('\n');
  console.log(`\n${table}\n`);
  if (process.env['GITHUB_STEP_SUMMARY']) {
    appendFileSync(
      process.env['GITHUB_STEP_SUMMARY'],
      `### Frame time\n\n${table}\n`
    );
  }
  await testInfo.attach('frame-time.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });

  // Report-only: it fails only when there was nothing to measure.
  expect(report.ticks).toBeGreaterThan(0);
  expect(report.frames).toBeGreaterThan(0);
});

interface Spread {
  p50: number;
  p95: number;
  max: number;
}

function spread(values: number[]): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number): number =>
    sorted.length === 0
      ? 0
      : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return { p50: at(0.5), p95: at(0.95), max: sorted.at(-1) ?? 0 };
}

function summarise(numbers: PageNumbers) {
  return {
    seed: SEED,
    matchSec: MATCH_SEC,
    calibrationMs: numbers.calibrationMs,
    frames: numbers.frameMs.length,
    frame: spread(numbers.frameMs),
    ticks: numbers.tickMs.length,
    tick: spread(numbers.tickMs),
    longTasks: {
      count: numbers.longTaskMs.length,
      totalMs: numbers.longTaskMs.reduce((sum, ms) => sum + ms, 0),
    },
  };
}

function row(name: string, values: Spread, calibrationMs: number): string {
  return `| ${name} | ${values.p50.toFixed(2)} ms | ${values.p95.toFixed(2)} ms | ${values.max.toFixed(1)} ms | ${(values.p50 / calibrationMs).toFixed(4)} |`;
}
