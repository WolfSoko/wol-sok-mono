import { activeRects, reachSinceReport } from './active-area';

const WIDTH = 640;
const HEIGHT = 360;

function box(minX: number, minY: number, maxX: number, maxY: number) {
  return { minX, minY, maxX, maxY };
}

describe('activeRects', () => {
  it('grows each colony box by the margin', () => {
    expect(activeRects([box(100, 100, 119, 109)], 8, WIDTH, HEIGHT)).toEqual([
      { x: 92, y: 92, width: 36, height: 26 },
    ]);
  });

  it('keeps the grown box on the arena', () => {
    expect(activeRects([box(0, 2, 9, 9)], 8, WIDTH, HEIGHT)).toEqual([
      { x: 0, y: 0, width: 18, height: 18 },
    ]);
    expect(activeRects([box(630, 350, 639, 359)], 8, WIDTH, HEIGHT)).toEqual([
      { x: 622, y: 342, width: 18, height: 18 },
    ]);
  });

  it('leaves out colonies that are gone', () => {
    expect(
      activeRects([null, box(10, 10, 19, 19), null], 0, WIDTH, HEIGHT)
    ).toHaveLength(1);
    expect(activeRects([null], 0, WIDTH, HEIGHT)).toEqual([]);
  });

  it('keeps boxes apart that do not touch', () => {
    const rects = activeRects(
      [box(10, 10, 19, 19), box(300, 200, 309, 209)],
      4,
      WIDTH,
      HEIGHT
    );

    expect(rects).toHaveLength(2);
  });

  it('merges boxes in a row, also through a box merged later', () => {
    // a and c are far apart, b bridges them.
    const rects = activeRects(
      [box(10, 10, 19, 19), box(60, 10, 69, 19), box(20, 10, 59, 19)],
      0,
      WIDTH,
      HEIGHT
    );

    expect(rects).toEqual([{ x: 10, y: 10, width: 60, height: 10 }]);
  });

  it('runs over the whole arena once the boxes cover most of it', () => {
    expect(
      activeRects(
        [box(0, 0, 400, 359), box(380, 0, 600, 359)],
        0,
        WIDTH,
        HEIGHT
      )
    ).toEqual([{ x: 0, y: 0, width: WIDTH, height: HEIGHT }]);
  });

  it('keeps two boxes that only overlap at a corner apart', () => {
    // The box around both would be nearly twice the two.
    expect(
      activeRects([box(0, 0, 99, 99), box(90, 90, 189, 189)], 0, WIDTH, HEIGHT)
    ).toHaveLength(2);
  });

  it('keeps the rects it is given as they are, merged with the boxes', () => {
    const rects = activeRects([box(10, 10, 19, 19)], 2, WIDTH, HEIGHT, [
      { x: 20, y: 8, width: 10, height: 14 },
      { x: 300, y: 300, width: 5, height: 5 },
    ]);

    expect(rects).toEqual([
      { x: 8, y: 8, width: 22, height: 14 },
      { x: 300, y: 300, width: 5, height: 5 },
    ]);
  });
});

describe('reachSinceReport', () => {
  it('adds up the reach of the ticks since the report and of its own tick', () => {
    // Newest first: this tick, then the three before - the report's.
    expect(reachSinceReport([4, 3, 5, 6, 9], 3)).toBe(4 + 3 + 5 + 6);
  });

  it('knows no reach once a tick that counts is no longer kept', () => {
    expect(reachSinceReport([4, 3, 5], 3)).toBeNull();
  });
});
