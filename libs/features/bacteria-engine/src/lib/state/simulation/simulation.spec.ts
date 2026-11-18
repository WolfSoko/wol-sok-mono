import { rulesetOf, runsOnGpu, SimulationVariant } from './simulation';

describe('simulation variants', () => {
  const cases: [SimulationVariant, ReturnType<typeof rulesetOf>, boolean][] = [
    ['cpu', 'cpu', false],
    ['cpu-int', 'gpu-int', false],
    ['gpu-int', 'gpu-int', true],
    ['gpu-float', null, true],
  ];

  it.each(cases)(
    '%s plays the ruleset %s, on the GPU: %s',
    (variant, ruleset, gpu) => {
      expect(rulesetOf(variant)).toBe(ruleset);
      expect(runsOnGpu(variant)).toBe(gpu);
    }
  );
});
