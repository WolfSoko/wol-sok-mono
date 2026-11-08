/**
 * How long a tick of `intSimulation` takes - the deterministic simulation
 * on the CPU (ADR 0015) - at the sizes the game plays. Prints ms per tick;
 * no gate (ADR 0014: CI's workers are shared, absolute times vary).
 *
 *   npx tsx --tsconfig tsconfig.base.json libs/features/lazy/bacteria-game/perf/int-simulation.bench.ts
 */
import {
  createPlayer,
  intSimulation,
  Player,
  scenarioRandom,
  SimScenario,
  skirmish,
  TICK_SEC,
} from '@wolsok/feat-shared-bacteria-engine';

function msPerTick(scenario: SimScenario, warmup: number): number {
  const simulation = intSimulation(
    scenario.balance,
    scenarioRandom(scenario),
    scenario.matchSeed
  );
  simulation.setMap(scenario.map);
  simulation.resize(scenario.width, scenario.height);
  simulation.init(scenario.spawns);
  const players: Player[] = scenario.spawns.map((spawn) =>
    createPlayer({ id: spawn.playerId, color: spawn.color, x: NaN, y: NaN })
  );
  let start = 0;
  for (let tick = 1; tick <= scenario.ticks; tick++) {
    if (tick === warmup + 1) {
      start = performance.now();
    }
    scenario.crosshairs(tick).forEach((aim, seat) => {
      players[seat].x = aim?.x ?? NaN;
      players[seat].y = aim?.y ?? NaN;
    });
    for (const fired of scenario.effects(tick)) {
      simulation.addEffect({ ...fired });
    }
    simulation.step(players, TICK_SEC);
  }
  return (performance.now() - start) / (scenario.ticks - warmup);
}

const SIZES: readonly (readonly [number, number, number])[] = [
  [96, 64, 200],
  [320, 180, 120],
  [320, 180, 600],
];

for (const [width, height, ticks] of SIZES) {
  const scenario = skirmish('bench', width, height, ticks, 0xbe9c4);
  const ms = msPerTick(scenario, 20);
  console.log(`${width}x${height}: ${ms.toFixed(2)} ms per tick`);
}
