import { cssColor, splitColor } from './player-color';

describe('splitColor', () => {
  it('splits an opaque colour into its channels and an alpha of 1', () => {
    expect(splitColor([255, 0, 0, 255])).toEqual({
      rgb: [255, 0, 0],
      alpha: 1,
    });
  });

  it('turns an alpha from 0 to 255 into one from 0 to 1', () => {
    expect(splitColor([0, 0, 255, 51]).alpha).toBe(0.2);
  });

  it('takes a colour without an alpha as opaque', () => {
    expect(splitColor([0, 0, 255]).alpha).toBe(1);
  });
});

describe('cssColor', () => {
  it('writes an opaque colour with an alpha of 1', () => {
    expect(cssColor([255, 100, 20, 255])).toBe('rgba(255,100,20,1)');
  });

  it('writes the alpha from 0 to 1, as CSS reads it', () => {
    expect(cssColor([0, 0, 255, 51])).toBe('rgba(0,0,255,0.2)');
  });

  it('writes a colour without an alpha as opaque', () => {
    expect(cssColor([0, 0, 255])).toBe('rgba(0,0,255,1)');
  });
});
