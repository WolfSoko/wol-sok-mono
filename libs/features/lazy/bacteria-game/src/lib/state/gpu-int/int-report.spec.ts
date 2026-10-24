import { LOSER_SHIFT, POISONED } from '../grid-format';
import { decodeReport, reportLayout } from '../simulation-report';
import { WALL_BIT, ZONE_CODE, ZONE_SHIFT } from '../zones';
import { intReport, IntReportInputs } from './int-report';

const WIDTH = 20;
const HEIGHT = 10;
const CELL = 8;
const layout = reportLayout(WIDTH, HEIGHT, CELL);
const noPellets: IntReportInputs = {
  pellets: new Float32Array(48),
  pelletCount: 0,
  pelletRadius: 2,
  countHill: false,
};

function grid() {
  return {
    width: WIDTH,
    height: HEIGHT,
    state: new Uint16Array(WIDTH * HEIGHT * 4),
    mask: new Uint8Array(WIDTH * HEIGHT),
  };
}

function put(
  state: Uint16Array,
  x: number,
  y: number,
  owner: number,
  energy = 0,
  record = 0
): void {
  const at = (y * WIDTH + x) * 4;
  state[at] = owner;
  state[at + 1] = energy;
  state[at + 3] = record;
}

describe('intReport', () => {
  it('counts each colony and its energy per coarse cell', () => {
    const g = grid();
    put(g.state, 1, 1, 1, 16384);
    put(g.state, 2, 1, 1, 8192);
    put(g.state, 17, 9, 2, 16384);
    const report = decodeReport(
      intReport(g, g.state, layout, noPellets, null),
      layout,
      2
    );
    expect(report.colonies.map(({ count }) => count)).toEqual([2, 1]);
    expect(report.colonies[0].totalEnergy).toBe(1.5);
    expect(Array.from(report.blockCounts[1])).toEqual([0, 0, 0, 0, 0, 1]);
  });

  it('adds this tick’s captures, losses and poisonings to the last report', () => {
    const g = grid();
    const events = new Uint16Array(g.state.length);
    put(events, 3, 3, 1, 0, 1 | (2 << LOSER_SHIFT));
    put(events, 12, 4, 0, 0, (1 << LOSER_SHIFT) | POISONED);
    const first = intReport(g, events, layout, noPellets, null);
    const second = decodeReport(
      intReport(g, events, layout, noPellets, first),
      layout,
      2
    );
    expect(second.colonies.map(({ captured }) => captured)).toEqual([2, 0]);
    expect(second.colonies.map(({ lost }) => lost)).toEqual([2, 2]);
    expect(second.poisoned).toBe(2);
  });

  it('counts the hold zone afresh, and only on a map with one', () => {
    const g = grid();
    g.mask[WIDTH + 1] = ZONE_CODE.hill << ZONE_SHIFT;
    g.mask[WIDTH + 2] = (ZONE_CODE.hill << ZONE_SHIFT) | WALL_BIT;
    put(g.state, 1, 1, 2);
    const hill = { ...noPellets, countHill: true };
    const first = intReport(g, g.state, layout, hill, null);
    const onHill = (data: Uint32Array) =>
      decodeReport(data, layout, 2).colonies.map((colony) => colony.onHill);
    expect(onHill(intReport(g, g.state, layout, hill, first))).toEqual([0, 1]);
    expect(onHill(intReport(g, g.state, layout, noPellets, null))).toEqual([
      0, 0,
    ]);
  });

  it('counts the bacteria within reach of each pellet, per colony', () => {
    const g = grid();
    put(g.state, 5, 5, 1);
    put(g.state, 6, 6, 1);
    put(g.state, 7, 7, 2);
    put(g.state, 9, 5, 3);
    const pellets = new Float32Array(48);
    pellets.set([5.9, 5.2, 1, 0, 0, 0]);
    const report = decodeReport(
      intReport(
        g,
        g.state,
        layout,
        { ...noPellets, pellets, pelletCount: 2 },
        null
      ),
      layout,
      3
    );
    // Reach 2 from the cell (5, 5): the third colony's (9, 5) is too far.
    expect(report.eaters[0]).toEqual([2, 1, 0]);
    expect(report.eaters[1]).toEqual([0, 0, 0]);
  });
});
