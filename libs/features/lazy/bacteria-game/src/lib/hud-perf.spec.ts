import { perfMs, simulationLabel } from './hud-perf';

describe('simulationLabel', () => {
  it.each([
    ['gpu', 'gpu-int', 'GPU int'],
    ['gpu', null, 'GPU float'],
    ['int', 'gpu-int', 'CPU int'],
    ['cpu', 'cpu', 'CPU'],
  ] as const)('names %s on %s %s', (kind, ruleset, label) => {
    expect(simulationLabel(kind, ruleset)).toBe(label);
  });
});

describe('perfMs', () => {
  it('shows one decimal', () => {
    expect(perfMs(6.25)).toBe('6.3');
    expect(perfMs(0)).toBe('0.0');
  });
});
