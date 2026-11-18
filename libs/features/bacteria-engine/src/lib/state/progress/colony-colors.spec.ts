import {
  COLONY_COLORS,
  getColonyColor,
  isColonyColor,
  pickColor,
} from './colony-colors';

describe('colony colours', () => {
  it('uses unique ids', () => {
    const ids = COLONY_COLORS.map((color) => color.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('falls back to the first colour for an unknown id', () => {
    expect(getColonyColor('gold')).toBe(COLONY_COLORS[0]);
    expect(isColonyColor('gold')).toBe(false);
    expect(isColonyColor('green')).toBe(true);
  });
});

describe('pickColor', () => {
  it('gives the seat the colour it picked', () => {
    expect(pickColor(['orange', 'blue'], 1, 'green')).toEqual([
      'orange',
      'green',
    ]);
  });

  it("swaps when a seat picks the other seat's colour", () => {
    expect(pickColor(['orange', 'blue'], 0, 'blue')).toEqual([
      'blue',
      'orange',
    ]);
  });
});
