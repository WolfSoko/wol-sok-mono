import { ENERGY_SCALE } from './grid-format';
import {
  decodeReport,
  nearestEnemyBlock,
  reportLayout,
} from './simulation-report';

// An arena of 4 x 2 coarse cells, the last column cut short at the edge.
const layout = reportLayout(30, 16, 8);

/** A raw read back with the given texels set. */
function readBack(
  texels: { x: number; y: number; value: [number, number, number, number] }[]
): Uint32Array {
  const data = new Uint32Array(layout.width * layout.height * 4);
  for (const { x, y, value } of texels) {
    data.set(value, (y * layout.width + x) * 4);
  }
  return data;
}

describe('reportLayout', () => {
  it('has two rows per coarse row and four for the pellets and totals', () => {
    // Counts and energy rows per coarse row, then pellets, captures, losses
    // and the hold zone.
    expect(layout).toMatchObject({ blocksX: 4, blocksY: 2, height: 8 });
    // Wide enough for every pellet even on a small arena.
    expect(layout.width).toBeGreaterThanOrEqual(16);
  });
});

describe('decodeReport', () => {
  it('adds up bacteria and energy and finds the centre and box of a colony', () => {
    const report = decodeReport(
      readBack([
        // Counts in the first rows, energy two rows down.
        { x: 0, y: 0, value: [10, 0, 0, 0] },
        { x: 0, y: 2, value: [10 * ENERGY_SCALE, 0, 0, 0] },
        { x: 1, y: 1, value: [10, 4, 0, 0] },
        { x: 1, y: 3, value: [5 * ENERGY_SCALE, 4 * ENERGY_SCALE, 0, 0] },
      ]),
      layout
    );

    const [first, second] = report.colonies;
    expect(first.count).toBe(20);
    expect(first.totalEnergy).toBe(15);
    // Halfway between the centres of the two coarse cells.
    expect(first.center).toEqual({ x: 7.5, y: 7.5 });
    expect(first.bounds).toEqual({ minX: 0, minY: 0, maxX: 15, maxY: 15 });
    expect(second.count).toBe(4);
    expect(second.bounds).toEqual({ minX: 8, minY: 8, maxX: 15, maxY: 15 });
  });

  it('clips the box of the last coarse cell at the arena edge', () => {
    const report = decodeReport(
      readBack([{ x: 3, y: 0, value: [1, 0, 0, 0] }]),
      layout
    );

    expect(report.colonies[0].bounds).toEqual({
      minX: 24,
      minY: 0,
      maxX: 29,
      maxY: 7,
    });
  });

  it('reports a colony without bacteria as gone', () => {
    const report = decodeReport(readBack([]), layout);

    expect(report.colonies[1]).toMatchObject({
      count: 0,
      center: null,
      bounds: null,
    });
  });

  it('reads the eaters per pellet and colony and sums the running totals per column', () => {
    const report = decodeReport(
      readBack([
        // 7 eaters: 3 of the first colony, 4 of the second, none else.
        { x: 2, y: 4, value: [7, 0, 3 | (4 << 16), 0] },
        // Of the third and the fourth, in alpha.
        { x: 5, y: 4, value: [9, 0, 0, 2 | (7 << 16)] },
        // Captures per colony, then losses per colony.
        { x: 0, y: 5, value: [3, 1, 0, 2] },
        { x: 3, y: 5, value: [1, 1, 0, 0] },
        { x: 0, y: 6, value: [2, 5, 1, 0] },
        { x: 3, y: 6, value: [1, 1, 0, 0] },
      ]),
      layout
    );

    expect(report.eaters[2]).toEqual([3, 4, 0, 0]);
    expect(report.eaters[5]).toEqual([0, 0, 2, 7]);
    expect(report.colonies[0]).toMatchObject({ captured: 4, lost: 3 });
    expect(report.colonies[1]).toMatchObject({ captured: 2, lost: 6 });
    expect(report.colonies[2]).toMatchObject({ captured: 0, lost: 1 });
    expect(report.colonies[3]).toMatchObject({ captured: 2, lost: 0 });
  });
});

describe('decodeReport poisoned', () => {
  it('sums the deaths by antibiotic over the columns of the pellet row', () => {
    const report = decodeReport(
      readBack([
        { x: 0, y: 4, value: [7, 2, 0, 0] },
        { x: 3, y: 4, value: [0, 5, 0, 0] },
        // Beyond the arena's columns: a pellet's eaters only.
        { x: 9, y: 4, value: [1, 99, 0, 0] },
      ]),
      layout
    );

    expect(report.poisoned).toBe(7);
  });

  it('sums the bacteria of each colony on the hold zone over the columns', () => {
    const report = decodeReport(
      readBack([
        { x: 0, y: 7, value: [3, 1, 0, 2] },
        { x: 2, y: 7, value: [4, 6, 1, 0] },
      ]),
      layout
    );

    expect(report.colonies.map((colony) => colony.onHill)).toEqual([
      7, 7, 1, 2,
    ]);
  });
});

describe('nearestEnemyBlock', () => {
  it('finds the closest coarse cell of any other colony', () => {
    const report = decodeReport(
      readBack([
        { x: 0, y: 0, value: [5, 0, 0, 0] },
        { x: 3, y: 1, value: [0, 2, 0, 0] },
        { x: 1, y: 0, value: [0, 3, 0, 0] },
      ]),
      layout
    );

    expect(nearestEnemyBlock(report, layout, 0, { x: 2, y: 2 })).toEqual({
      x: 11.5,
      y: 3.5,
    });
    expect(nearestEnemyBlock(report, layout, 1, { x: 20, y: 10 })).toEqual({
      x: 3.5,
      y: 3.5,
    });
  });
});
