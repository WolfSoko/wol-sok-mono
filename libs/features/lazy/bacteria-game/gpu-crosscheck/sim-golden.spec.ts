/**
 * @jest-environment node
 */
import { BALANCE_VERSION, IntSimulation } from '../src/engine';
import {
  playScenario,
  scenarioRandom,
  SIM_SCENARIOS,
} from '../src/lib/state/gpu-int/sim-scenarios';
import golden from './golden-gpu-sim.json';

/**
 * The golden hashes of the whole-match scenarios the GPU cross-check plays
 * through `GpuSimulation` are `IntSimulation`'s: a change to the simulation
 * or the balance shows up here first, without a browser. Regenerate them by
 * writing what `playScenario` returns; a change to what the simulation
 * computes also bumps `BALANCE_VERSION`, a change to the scenarios does not.
 * `SELF_TEST_GOLDEN` holds the self-test scenario's hashes once more, for
 * the device: keep it in step (`self-test-golden.spec.ts`).
 */
describe('the golden hashes of the whole-match cross-check', () => {
  it('belong to this balance version and these scenarios', () => {
    expect(golden.balanceVersion).toBe(BALANCE_VERSION);
    expect(Object.keys(golden.hashes).sort()).toEqual(
      SIM_SCENARIOS.map(({ name }) => name).sort()
    );
  });

  it.each(SIM_SCENARIOS.map((scenario) => [scenario.name, scenario] as const))(
    'are IntSimulation’s hashes of %s',
    (name, scenario) => {
      expect(
        playScenario(
          scenario,
          new IntSimulation(
            scenario.balance,
            scenarioRandom(scenario),
            scenario.matchSeed
          )
        )
      ).toEqual(golden.hashes[name as keyof typeof golden.hashes]);
    }
  );
});
