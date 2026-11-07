import { boostRingRadius, crosshairBars, CursorShape } from './arena-painter';

/** Expected values below are worked out by hand, not through the code. */
describe('crosshairBars', () => {
  /** Off the diagonal, so swapped coordinates show. */
  const cursor: CursorShape = {
    x: 50,
    y: 30,
    color: [255, 0, 0, 255],
    boostLeft: null,
  };

  it('draws bars 13 base cells long and 2 thick on the base grid', () => {
    expect(crosshairBars(cursor, 1)).toEqual([
      { x: 44, y: 29.5, width: 13, height: 2 },
      { x: 49.5, y: 24, width: 2, height: 13 },
    ]);
  });

  it('draws the bars twice as long and thick on a grid of two cells per base cell', () => {
    expect(crosshairBars(cursor, 2)).toEqual([
      { x: 38, y: 29, width: 26, height: 4 },
      { x: 49, y: 18, width: 4, height: 26 },
    ]);
  });
});

describe('boostRingRadius', () => {
  it('rings a fresh boost at 9 base cells', () => {
    expect(boostRingRadius(1)).toBe(9);
  });

  it('widens the ring to 13 base cells as the boost runs out', () => {
    expect(boostRingRadius(0)).toBe(13);
  });

  it('widens the ring by 4 base cells over the boost', () => {
    expect(boostRingRadius(0.25)).toBe(12);
  });
});
