import { gameBalance } from '@wolsok/feat-shared-bacteria-engine';
import { GpuCellPasses } from './gpu-cell-passes';
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
});
