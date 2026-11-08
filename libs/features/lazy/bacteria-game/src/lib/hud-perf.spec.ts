import { perfMs, simulationLabel } from './hud-perf';

describe('simulationLabel', () => {
  it.each([
    ['gpu-int', 'GPU int'],
    ['gpu-float', 'GPU float'],
    ['cpu-int', 'CPU int'],
    ['cpu', 'CPU'],
  ] as const)('names %s %s', (variant, label) => {
    expect(simulationLabel(variant)).toBe(label);
  });
});

describe('perfMs', () => {
  it('shows one decimal', () => {
    expect(perfMs(6.25)).toBe('6.3');
    expect(perfMs(0)).toBe('0.0');
  });
});
