import { TICK_SEC } from '../fixed-tick';
import { colonyCapacity } from '../game-balance';
import { createPlayer } from '../player.model';
import { IntSimulation } from './int-simulation';
import { DETERMINISTIC_REPORT_LAG } from './int-readback';
import { intColonyCounts } from './int-tick';
import {
  playScenario,
  scenarioRandom,
  SELF_TEST_SCENARIO,
  SIM_SCENARIOS,
  SimScenario,
} from './sim-scenarios';

function simulationOf(scenario: SimScenario): IntSimulation {
  return new IntSimulation(
    scenario.balance,
    scenarioRandom(scenario),
    scenario.matchSeed
  );
}

function scenarioNamed(name: string): SimScenario {
  const scenario = SIM_SCENARIOS.find((candidate) => candidate.name === name);
  if (scenario == null) {
    throw new Error(`No scenario ${name}`);
  }
  return scenario;
}

/** Plays a scenario tick by tick, handing each tick to `look`. */
function play(
  scenario: SimScenario,
  look: (tick: number, simulation: IntSimulation) => void
): void {
  const simulation = simulationOf(scenario);
  simulation.setMap(scenario.map);
  simulation.resize(scenario.width, scenario.height);
  simulation.init(scenario.spawns);
  const players = scenario.spawns.map((spawn) =>
    createPlayer({ id: spawn.playerId, color: spawn.color })
  );
  for (let tick = 1; tick <= scenario.ticks; tick++) {
    scenario.crosshairs(tick).forEach((aim, seat) => {
      players[seat].x = aim?.x ?? NaN;
      players[seat].y = aim?.y ?? NaN;
    });
    scenario.effects(tick).forEach((effect) => simulation.addEffect(effect));
    simulation.step(players, TICK_SEC);
    look(tick, simulation);
  }
}

describe('IntSimulation', () => {
  it('plays a scenario the same every time', () => {
    const scenario = SELF_TEST_SCENARIO;
    expect(playScenario(scenario, simulationOf(scenario))).toEqual(
      playScenario(scenario, simulationOf(scenario))
    );
  });

  it('plays another match from another seed', () => {
    const other = { ...SELF_TEST_SCENARIO, matchSeed: 1 };
    expect(playScenario(other, simulationOf(other))).not.toEqual(
      playScenario(SELF_TEST_SCENARIO, simulationOf(SELF_TEST_SCENARIO))
    );
  });

  it('counts the colonies of exactly DETERMINISTIC_REPORT_LAG ticks ago', () => {
    const counts: number[][] = [];
    const reported: number[][] = [];
    play(SELF_TEST_SCENARIO, (_, simulation) => {
      counts.push(intColonyCounts(simulation.readState() ?? [], 4).slice(0, 4));
      reported.push(simulation.summaries().map(({ count }) => count));
    });
    const lag = DETERMINISTIC_REPORT_LAG;
    // Tick t (from 1) shows the report of tick t - lag.
    expect(reported.slice(lag)).toEqual(counts.slice(0, -lag));
  });

  it('draws every bacterium of the state as a cell of its colony', () => {
    let counts: number[] = [];
    let drawn: number[] = [];
    play({ ...SELF_TEST_SCENARIO, ticks: 5 }, (_, simulation) => {
      counts = intColonyCounts(simulation.readState() ?? [], 4);
      drawn = simulation
        .colonyLayers(new Map())
        .map((layer) => (layer.kind === 'cells' ? layer.bacterias.length : -1));
    });
    expect(drawn).toEqual(counts);
  });

  it('keeps every colony near its capacity where room is short', () => {
    const crowded = scenarioNamed('crowded');
    const capacity = colonyCapacity(crowded.balance, crowded.spawns.length);
    let most = 0;
    play(crowded, (_, simulation) => {
      for (const count of intColonyCounts(simulation.readState() ?? [], 4)) {
        most = Math.max(most, count);
      }
    });
    // The budget keeps the growth of the lagged ticks inside the room, with
    // the start's blob a little over the cap on this small arena.
    expect(most).toBeLessThan(capacity * 1.5);
  });

  it('is a CPU simulation with no state before it has a size', () => {
    const simulation = simulationOf(SELF_TEST_SCENARIO);
    expect(simulation.kind).toBe('cpu');
    expect(simulation.readState()).toBeNull();
  });
});
