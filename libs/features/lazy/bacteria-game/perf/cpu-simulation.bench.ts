/**
 * How long a tick of the `cpu` ruleset takes - `BacteriaSimulation` inside a
 * `MatchEngine`, bot included - on the matches the golden spec plays, and
 * which phase of the step the time goes to. Prints ms per tick; no gate
 * (ADR 0014: CI's workers are shared, absolute times vary).
 *
 *   npx tsx libs/features/lazy/bacteria-game/perf/cpu-simulation.bench.ts
 */
import { BacteriaSimulation } from '../src/lib/state/bacteria-simulation';
import { MatchEngine } from '../src/lib/state/match-engine';
import { MatchPlan, planMatch } from '../src/lib/state/match-setup';

const PLAN: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'vs-computer',
  difficulty: 'hard',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 180,
  seed: 1234,
};

const MATCHES: { name: string; plan: MatchPlan }[] = [
  { name: 'petri-dish', plan: PLAN },
  { name: 'meltdown', plan: { ...PLAN, levelId: 'meltdown' } },
  { name: 'quarantine', plan: { ...PLAN, levelId: 'quarantine' } },
  { name: 'control-room', plan: { ...PLAN, levelId: 'control-room' } },
  {
    name: 'ultra grid',
    plan: { ...PLAN, levelId: 'quarantine', width: 640, height: 360 },
  },
];

const PHASES = [
  'buildGrid',
  'updateNutrients',
  'runCombat',
  'applyCaptures',
  'compact',
  'divide',
  'move',
] as const;

/**
 * Wraps the private phases of one simulation in timers - by name, so a
 * phase renamed in `BacteriaSimulation` is renamed here too.
 */
function timePhases(simulation: BacteriaSimulation): Map<string, number> {
  const totals = new Map<string, number>(PHASES.map((phase) => [phase, 0]));
  const target = simulation as unknown as Record<
    string,
    ((...args: unknown[]) => unknown) | undefined
  >;
  for (const phase of PHASES) {
    const method = target[phase];
    if (typeof method !== 'function') {
      throw new Error(`BacteriaSimulation has no phase ${phase} any more`);
    }
    const original = method.bind(simulation);
    target[phase] = (...args: unknown[]) => {
      const start = performance.now();
      const result = original(...args);
      totals.set(phase, (totals.get(phase) ?? 0) + performance.now() - start);
      return result;
    };
  }
  return totals;
}

function bench(
  name: string,
  plan: MatchPlan,
  ticks: number,
  warmup: number
): void {
  const { spawns, options } = planMatch(plan);
  const engine = new MatchEngine(spawns, options);
  const totals = timePhases(engine.simulation as BacteriaSimulation);
  let start = 0;
  let measured = 0;
  let bacteria = 0;
  let worst = 0;
  for (let tick = 0; tick < ticks && engine.outcome() == null; tick++) {
    engine.setSteering(0, tick < 60 ? { x: 1, y: 0.5 } : { x: 0, y: 0 });
    if (tick === 90) {
      engine.setDragTarget(0, plan.width * 0.6, plan.height * 0.25);
    }
    if (tick === warmup) {
      start = performance.now();
      totals.forEach((_, phase) => totals.set(phase, 0));
    }
    const before = performance.now();
    engine.tick(plan.width, plan.height);
    if (tick >= warmup) {
      worst = Math.max(worst, performance.now() - before);
      measured++;
      bacteria += (engine.simulation as BacteriaSimulation)
        .getColonies()
        .reduce((sum, colony) => sum + colony.cells.length, 0);
    }
  }
  const ms = (performance.now() - start) / measured;
  const phases = [...totals]
    .map(([phase, total]) => `${phase} ${(total / measured).toFixed(3)}`)
    .join(', ');
  console.log(
    `${name} ${plan.width}x${plan.height}: ${ms.toFixed(3)} ms/tick ` +
      `(worst ${worst.toFixed(2)}, ${Math.round(bacteria / measured)} bacteria, ${measured} ticks)\n  ${phases}`
  );
}

for (const { name, plan } of MATCHES) {
  bench(name, plan, 2400, 120);
}
