import { gameBalance } from '@wolsok/feat-shared-bacteria-engine';
import { GpuCellPasses } from './gpu-cell-passes';
import { diagnose } from './gl-diagnostics';
import { GpuIntRules } from './gpu-rules';
import { fakeGl, glConstant } from './testing/fake-gl';

describe('GpuCellPasses', () => {
  const arena = {
    width: 32,
    height: 16,
    layout: {
      blocksX: 4,
      blocksY: 2,
      cellSize: 8,
      width: 4,
      height: 4,
      arenaWidth: 32,
      arenaHeight: 16,
    },
  };

  function passes() {
    const fake = fakeGl();
    const balance = gameBalance;
    const cellPasses = new GpuCellPasses(
      fake.gl,
      balance,
      new GpuIntRules(balance, 1)
    );
    return { fake, cellPasses };
  }

  it('renders without dithering, which would change the integers the glow packs', () => {
    const { fake, cellPasses } = passes();

    cellPasses.allocate(arena);

    expect(fake.callsOf('disable', glConstant('DITHER'))).toBeGreaterThan(0);
  });

  it('switches dithering off again for every new arena', () => {
    const { fake, cellPasses } = passes();
    cellPasses.allocate(arena);
    const before = fake.callsOf('disable', glConstant('DITHER'));

    cellPasses.allocate(arena);

    expect(fake.callsOf('disable', glConstant('DITHER'))).toBe(before + 1);
  });

  /** The first tick of a match with two colonies, no report yet. */
  const FIRST_TICK = {
    step: 1,
    mostSteps: 1,
    escapeSteps: 0,
    colonies: 2,
    report: null,
    reportStep: 0,
    generation: [],
  };
  const sink = { take: jest.fn() };

  it('never asks for GL errors while nobody diagnoses its context', () => {
    const { fake, cellPasses } = passes();
    cellPasses.allocate(arena);

    cellPasses.runTick(FIRST_TICK, sink);

    expect(fake.callsOf('getError')).toBe(0);
  });

  it('checks its tick for GL errors while the context is diagnosed', () => {
    const { fake, cellPasses } = passes();
    cellPasses.allocate(arena);
    const diagnostics = diagnose(fake.gl);
    fake.failOn('readPixels', glConstant('INVALID_OPERATION'));

    cellPasses.runTick({ ...FIRST_TICK, step: 2 }, sink);
    cellPasses.runTick({ ...FIRST_TICK, step: 3 }, sink);

    expect(fake.callsOf('getError')).toBeGreaterThan(0);
    expect(diagnostics.errors().map(({ pass }) => pass)).toEqual([
      'simulation tick',
    ]);
  });
});
