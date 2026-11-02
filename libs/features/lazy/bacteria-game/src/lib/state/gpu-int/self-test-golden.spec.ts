import { BALANCE_VERSION } from '../game-balance';
import { IntSimulation } from './int-simulation';
import { SELF_TEST_GOLDEN } from './self-test-golden';
import {
  playScenario,
  scenarioRandom,
  SELF_TEST_SCENARIO,
  selfTestVerdict,
} from './sim-scenarios';

describe('the GPU self-test', () => {
  it('compares with the reference hashes of this balance version', () => {
    const scenario = SELF_TEST_SCENARIO;
    expect(SELF_TEST_GOLDEN.balanceVersion).toBe(BALANCE_VERSION);
    expect(
      playScenario(
        scenario,
        new IntSimulation(
          scenario.balance,
          scenarioRandom(scenario),
          scenario.matchSeed
        )
      )
    ).toEqual(SELF_TEST_GOLDEN.hashes);
  });

  it('passes a run that agrees on every tick', () => {
    expect(selfTestVerdict([1, 2, 3], [1, 2, 3])).toEqual({ ok: true });
  });

  it('names the first tick that differs', () => {
    expect(selfTestVerdict([1, 2, 9, 4], [1, 2, 3, 4])).toEqual({
      ok: false,
      firstBadTick: 3,
    });
  });

  it('fails a run that stopped short', () => {
    expect(selfTestVerdict([1, 2], [1, 2, 3])).toEqual({
      ok: false,
      firstBadTick: 3,
    });
  });
});
