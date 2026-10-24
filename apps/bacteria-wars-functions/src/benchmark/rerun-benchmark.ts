/**
 * The CPU benchmark ADR 0012 asks for before the verification budgets are
 * set: how long the real engine takes per tick to play a match again in
 * Node, on the levels the boards and the gallery re-run, on the online grid.
 *
 * Run with `nx run bacteria-wars-functions:benchmark`. It prints a table
 * per ruleset (`cpu`, `gpu-int`) and the CPU seconds per match minute the
 * budgets in `src/replays/budgets.ts` are worked out from. Not part of the build or
 * of any test target: it takes minutes.
 *
 * Two ways of playing each level:
 * - `rerun`: `playReplay` of a recorded match whose human stands still -
 *   exactly what `verify.ts` does, one bot and one ghost. The bot wins
 *   early, so it measures a lopsided match.
 * - `contest`: both seats played by the normal bot until the match ends or
 *   3 minutes pass - two busy colonies all match long, the heavy case of a
 *   human who fights back. A re-run never costs more per tick than this:
 *   a ghost steers for free where a bot thinks.
 */
import { performance } from 'node:perf_hooks';
import type { MatchPlan, Ruleset } from '@wolsok/feat-lazy-bac-game/engine';
import { loadEngine } from '../engine';

/** Ticks a contest plays at most: 3 minutes. */
const CONTEST_TICKS = 3 * 60 * 60;
/** Ticks a re-run is recorded for at most: 3 minutes. */
const RERUN_TICKS = 3 * 60 * 60;
/** Runs per case; the median counts. */
const RUNS = Number(process.env['BENCHMARK_RUNS'] ?? 3);
/**
 * The rulesets a stored replay is played again on (ADR 0015): `cpu` on
 * `BacteriaSimulation`, `gpu-int` - every ranked attempt - on
 * `IntSimulation`. `BENCHMARK_RULESETS=gpu-int` measures one.
 */
const RULESETS = (process.env['BENCHMARK_RULESETS'] ?? 'cpu,gpu-int')
  .split(',')
  .filter((name): name is Ruleset => name === 'cpu' || name === 'gpu-int');

interface Case {
  label: string;
  levelId: string;
}

interface Measured {
  label: string;
  ruleset: Ruleset;
  mode: 'rerun' | 'contest';
  ticks: number;
  msPerTick: number;
}

/** Only the cases whose label holds one of these, e.g. `expanse,quarantine`. */
const ONLY = (process.env['BENCHMARK_CASES'] ?? '')
  .split(',')
  .filter((part) => part !== '');

async function cases(): Promise<Case[]> {
  return (await allCases()).filter(
    ({ label }) =>
      ONLY.length === 0 || ONLY.some((part) => label.includes(part))
  );
}

async function allCases(): Promise<Case[]> {
  const engine = await loadEngine();
  // Saturdays play the daily level at its highest difficulty, 7; four in a
  // row cover the four recipes.
  const saturdays = ['2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14'];
  return [
    ...saturdays.map((day) => ({
      label: `daily ${day}`,
      levelId: engine.dailyLevelId(day),
    })),
    // The ladder level with neutral colonies that plays online.
    { label: 'ladder quarantine', levelId: 'quarantine' },
    // A big map (size 2) - local matches only, re-run by the gallery.
    { label: 'ladder expanse', levelId: 'expanse' },
  ];
}

/** CPU seconds per match minute at a cost per tick. */
function perMinute(msPerTick: number): string {
  return ((msPerTick * 60 * 60) / 1000).toFixed(1);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function rerun(
  plan: MatchPlan,
  ruleset: Ruleset
): Promise<{ ticks: number; ms: number }> {
  const engine = await loadEngine();
  const draft = engine.replayOf(plan, ruleset, RERUN_TICKS, {
    steers: [],
    drags: [],
    boosts: [],
    weapons: [],
  });
  const started = performance.now();
  const played = engine.playReplay(draft);
  const ms = performance.now() - started;
  if (played === null) {
    throw new Error(`${plan.levelId} does not play`);
  }
  return { ticks: played.ticks, ms };
}

async function contest(
  plan: MatchPlan,
  ruleset: Ruleset
): Promise<{ ticks: number; ms: number }> {
  const engine = await loadEngine();
  const { spawns, options } = engine.planMatch(plan);
  const match = new engine.MatchEngine(
    spawns.map((spawn, seat) =>
      seat === 0 ? { ...spawn, isBot: true } : spawn
    ),
    {
      ...options,
      simulation:
        ruleset === 'gpu-int' ? engine.intSimulation : engine.cpuSimulation,
    }
  );
  try {
    const started = performance.now();
    while (match.outcome() === null && match.tickCount < CONTEST_TICKS) {
      match.tick(plan.width, plan.height);
    }
    return { ticks: match.tickCount, ms: performance.now() - started };
  } finally {
    match.dispose();
  }
}

async function main(): Promise<void> {
  const engine = await loadEngine();
  const results: Measured[] = [];
  for (const { label, levelId } of await cases()) {
    for (const ruleset of RULESETS) {
      for (const mode of ['rerun', 'contest'] as const) {
        const perTick: number[] = [];
        let ticks = 0;
        for (let run = 0; run < RUNS; run++) {
          const plan = engine.rankedPlan(levelId, 1000 + run);
          const played =
            mode === 'rerun'
              ? await rerun(plan, ruleset)
              : await contest(plan, ruleset);
          perTick.push(played.ms / Math.max(1, played.ticks));
          ticks = Math.max(ticks, played.ticks);
        }
        const measured = {
          label,
          ruleset,
          mode,
          ticks,
          msPerTick: median(perTick),
        };
        results.push(measured);
        console.log(
          `${label.padEnd(20)} ${ruleset.padEnd(8)} ${mode.padEnd(8)} ${String(ticks).padStart(6)} ticks  ${measured.msPerTick.toFixed(2)} ms/tick  ${perMinute(measured.msPerTick)} CPU-s per match minute`
        );
      }
    }
  }
  for (const ruleset of RULESETS) {
    const own = results.filter((result) => result.ruleset === ruleset);
    const worst = Math.max(...own.map((result) => result.msPerTick));
    const worstDaily = Math.max(
      ...own
        .filter((result) => result.label.startsWith('daily'))
        .map((result) => result.msPerTick)
    );
    console.log(
      `\n${ruleset} worst: ${worst.toFixed(2)} ms/tick (${perMinute(worst)} CPU-s per match minute)` +
        (worstDaily > 0
          ? `; worst daily level: ${worstDaily.toFixed(2)} ms/tick (${perMinute(worstDaily)} CPU-s per match minute)`
          : '')
    );
  }
  console.log(`node ${process.version}, ${RUNS} runs per case, median`);
}

void main();
