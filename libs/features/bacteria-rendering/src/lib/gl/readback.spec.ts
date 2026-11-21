import { flipRows } from './readback';

describe('flipRows', () => {
  it('puts the bottom row first on top', () => {
    const pixels = Uint8Array.from([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);

    expect(Array.from(flipRows(pixels, 1, 3))).toEqual([
      3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1,
    ]);
  });
});
