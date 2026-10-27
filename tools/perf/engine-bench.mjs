// The engine benchmark (ADR 0014, gate 2): plays fixed replays through the
// pure engine, bundled from `engine.ts` as the functions bundle it, and
// compares each one's time with a calibration loop timed in the same
// process - a ratio, so a slower or busier machine changes little.
//
//   node tools/perf/engine-bench.mjs                 measure and gate
//   node tools/perf/engine-bench.mjs --report-only   measure, never fail
//   node tools/perf/engine-bench.mjs --update        write the baseline
//
// With `node --expose-gc` it also reports the heap a play keeps once it is
// over, a sign of a leak in the engine (reported, not gated).
import { build, stop } from 'esbuild';
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '../..');
const ENGINE = join(ROOT, 'libs/features/lazy/bacteria-game/src/engine.ts');
const BASELINE = join(import.meta.dirname, 'engine-baseline.json');

/** Above this much over its baseline a ratio fails the gate. */
const FAIL_ABOVE = 0.2;
/** Above this much it warns, and below its negative it asks for a lower baseline. */
const WARN_ABOVE = 0.1;
const WARM_UPS = 1;
const RUNS = 7;
/**
 * The calibration loop is short and was at times twice as slow on its first
 * runs: it warms up longer and takes more samples, before and after.
 */
const CALIBRATION_WARM_UPS = 10;
const CALIBRATION_RUNS = 15;

/**
 * The replays timed: the golden replay, short and small, on both rulesets -
 * `cpu` as online matches play it, `gpu-int` on `IntSimulation` as ranked
 * matches are checked - and the heavy case, the largest map with neutral
 * colonies on the online grid, ten seconds into a full arena.
 */
const FIXTURES = [
  {
    name: 'golden-cpu',
    file: 'libs/features/lazy/bacteria-game/src/lib/state/golden-replay.json',
  },
  {
    name: 'golden-gpu-int',
    file: 'libs/features/lazy/bacteria-game/src/lib/state/golden-replay.json',
    gpuInt: true,
  },
  { name: 'heavy-cpu', file: 'tools/perf/fixtures/expanse-heavy.json' },
];

const args = new Set(process.argv.slice(2));
const update = args.has('--update');
const reportOnly = args.has('--report-only');

/** The engine as one ESM file, imported from a temporary path. */
async function loadEngine() {
  const out = join(tmpdir(), `engine-bench-${process.pid}.mjs`);
  await build({
    entryPoints: [ENGINE],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: out,
    logLevel: 'silent',
  });
  // esbuild's service process would still be busy while the timing starts.
  await stop();
  try {
    return await import(pathToFileURL(out).href);
  } finally {
    rmSync(out, { force: true });
  }
}

/**
 * Fixed work of the kind a tick does - integer arithmetic over typed
 * arrays, with a pseudo-random walk - whose result is used, so it is not
 * optimised away.
 */
function calibrate() {
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
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Milliseconds of each of `runs` runs after `warmUps` untimed ones. */
function samples(run, warmUps, runs) {
  for (let i = 0; i < warmUps; i++) {
    run();
  }
  const times = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  return times;
}

const calibration = () =>
  samples(calibrate, CALIBRATION_WARM_UPS, CALIBRATION_RUNS);

/** Plays a heap measurement averages over: a leak adds up, noise does not. */
const HEAP_PLAYS = 3;

/**
 * The heap a play keeps once it is over, in KiB, where the GC can be run.
 * A few hundred KiB either way are V8's own; a leak grows with the ticks.
 */
function heapKeptKiB(play) {
  if (typeof globalThis.gc !== 'function') {
    return null;
  }
  const settled = () => {
    // Twice: one full GC can leave garbage a second one still frees.
    globalThis.gc();
    globalThis.gc();
    return process.memoryUsage().heapUsed;
  };
  const before = settled();
  for (let i = 0; i < HEAP_PLAYS; i++) {
    play();
  }
  return (settled() - before) / 1024 / HEAP_PLAYS;
}

const engine = await loadEngine();
const { BALANCE_VERSION, GPU_INT_REPLAY_VERSION, parseReplay, playReplay } =
  engine;

function replayOf(fixture) {
  const raw = JSON.parse(readFileSync(join(ROOT, fixture.file), 'utf8'));
  const replay = parseReplay(raw);
  if (replay === null) {
    throw new Error(`${fixture.name}: ${fixture.file} does not parse`);
  }
  // Played on the current balance, whatever the fixture says - as the
  // golden replay's spec plays it.
  return {
    ...replay,
    header: {
      ...replay.header,
      balanceVersion: BALANCE_VERSION,
      ...(fixture.gpuInt
        ? { version: GPU_INT_REPLAY_VERSION, simulation: 'gpu-int' }
        : {}),
    },
  };
}

const calibrationBefore = calibration();
const measured = FIXTURES.map((fixture) => {
  const replay = replayOf(fixture);
  const play = () => playReplay(replay);
  const result = play();
  if (result === null) {
    throw new Error(`${fixture.name}: the replay does not play back`);
  }
  return {
    name: fixture.name,
    ms: median(samples(play, WARM_UPS, RUNS)),
    result: {
      checksum: result.checksum,
      ticks: result.ticks,
      outcome: result.outcome,
    },
    heap: heapKeptKiB(play),
  };
});
const calibrationMs = median([...calibrationBefore, ...calibration()]);

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const rows = measured.map((entry) => {
  const ratio = entry.ms / calibrationMs;
  const base =
    baseline.balanceVersion === BALANCE_VERSION
      ? baseline.fixtures[entry.name]
      : undefined;
  const sameResult =
    base !== undefined &&
    base.checksum === entry.result.checksum &&
    base.ticks === entry.result.ticks &&
    JSON.stringify(base.outcome) === JSON.stringify(entry.result.outcome);
  const change = base === undefined ? null : ratio / base.ratio - 1;
  const verdict =
    base === undefined
      ? 'no baseline'
      : !sameResult
        ? 'played differently'
        : change > FAIL_ABOVE
          ? 'slower: fails'
          : change > WARN_ABOVE
            ? 'slower: warns'
            : change < -WARN_ABOVE
              ? 'faster: lower the baseline'
              : 'ok';
  return { ...entry, ratio, change, verdict };
});

const percent = (value) =>
  value === null ? '–' : `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
const table = [
  `Calibration loop: ${calibrationMs.toFixed(1)} ms (median of ${CALIBRATION_RUNS} runs before and ${CALIBRATION_RUNS} after)`,
  '',
  '| Fixture | ms | ratio | vs baseline | heap kept/play | verdict |',
  '| --- | ---: | ---: | ---: | ---: | --- |',
  ...rows.map(
    (row) =>
      `| ${row.name} | ${row.ms.toFixed(1)} | ${row.ratio.toFixed(3)} | ${percent(row.change)} | ${
        row.heap === null ? '–' : `${row.heap.toFixed(0)} KiB`
      } | ${row.verdict} |`
  ),
].join('\n');
console.log(`\nEngine benchmark (ADR 0014, gate 2)\n\n${table}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Engine benchmark\n\n${table}\n`
  );
}

if (update) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        balanceVersion: BALANCE_VERSION,
        node: process.version,
        fixtures: Object.fromEntries(
          rows.map((row) => [
            row.name,
            { ratio: Number(row.ratio.toFixed(4)), ...row.result },
          ])
        ),
      },
      null,
      2
    )}\n`
  );
  console.log(`Wrote ${BASELINE}.`);
  process.exit(0);
}

const failing = rows.filter((row) =>
  ['slower: fails', 'played differently', 'no baseline'].includes(row.verdict)
);
if (failing.length > 0) {
  console.log(
    `${failing.map((row) => `${row.name}: ${row.verdict}`).join('; ')}.` +
      ' A change to what a tick does takes a new baseline' +
      ' (node tools/perf/engine-bench.mjs --update), in a commit of its own.'
  );
  if (!reportOnly) {
    process.exit(1);
  }
  console.log('Report only (ADR 0014): not failing.');
}
