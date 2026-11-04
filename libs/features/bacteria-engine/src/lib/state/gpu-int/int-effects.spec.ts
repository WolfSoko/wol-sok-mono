import { WEAPON_CODE } from '../weapon-effects';
import { TARGET_MAX } from './fixed-point';
import {
  createIntEffectUniforms,
  INT_EFFECT_RADIUS_MAX,
  intEffectOver,
  setIntEffect,
} from './int-effects';

const TOXIN = WEAPON_CODE['toxin-bomb'];
const BLOOM = WEAPON_CODE['agar-bloom'];

describe('int effects', () => {
  it('converts circles into sixteenths of a cell', () => {
    const u = createIntEffectUniforms();
    setIntEffect(u, 0, {
      x: 10.5,
      y: -2,
      radius: 3.25,
      hostile: true,
      kind: TOXIN,
      owner: 2,
    });
    expect(Array.from(u.circles.subarray(0, 4))).toEqual([168, -32, 52, 1]);
    expect(Array.from(u.kinds.subarray(0, 2))).toEqual([TOXIN, 2]);
  });

  it('keeps centres and radii in range', () => {
    const u = createIntEffectUniforms();
    setIntEffect(u, 0, {
      x: 1e9,
      y: -1e9,
      radius: 1e9,
      hostile: false,
      kind: BLOOM,
      owner: 1,
    });
    expect(u.circles[0]).toBe(TARGET_MAX);
    expect(u.circles[1]).toBe(-TARGET_MAX);
    expect(u.circles[2]).toBe(INT_EFFECT_RADIUS_MAX);
    setIntEffect(u, 1, {
      x: Number.NaN,
      y: 0,
      radius: -4,
      hostile: false,
      kind: BLOOM,
      owner: 1,
    });
    expect(u.circles[4]).toBe(0);
    expect(u.circles[6]).toBe(0);
  });

  it('acts on enemies when hostile and on its own colony otherwise', () => {
    const u = createIntEffectUniforms();
    setIntEffect(u, 0, {
      x: 10,
      y: 10,
      radius: 3,
      hostile: true,
      kind: TOXIN,
      owner: 1,
    });
    setIntEffect(u, 1, {
      x: 20,
      y: 10,
      radius: 3,
      hostile: false,
      kind: BLOOM,
      owner: 1,
    });
    u.count = 2;
    expect(intEffectOver(u, 10, 10, 2, TOXIN)).toBe(1);
    expect(intEffectOver(u, 10, 10, 1, TOXIN)).toBe(0);
    expect(intEffectOver(u, 20, 10, 1, BLOOM)).toBe(1);
    expect(intEffectOver(u, 20, 10, 2, BLOOM)).toBe(0);
    expect(intEffectOver(u, 20, 10, 2, TOXIN)).toBe(0);
  });

  it('covers the cells of its circle and no others', () => {
    const u = createIntEffectUniforms();
    setIntEffect(u, 0, {
      x: 10,
      y: 10,
      radius: 3,
      hostile: true,
      kind: TOXIN,
      owner: 1,
    });
    u.count = 1;
    expect(intEffectOver(u, 13, 10, 2, TOXIN)).toBe(1);
    expect(intEffectOver(u, 12, 12, 2, TOXIN)).toBe(1);
    expect(intEffectOver(u, 13, 11, 2, TOXIN)).toBe(0);
    expect(intEffectOver(u, 14, 10, 2, TOXIN)).toBe(0);
  });

  it('does nothing with radius 0, off the grid or not counted', () => {
    const u = createIntEffectUniforms();
    setIntEffect(u, 0, {
      x: 10,
      y: 10,
      radius: 0,
      hostile: true,
      kind: TOXIN,
      owner: 1,
    });
    setIntEffect(u, 1, {
      x: -500,
      y: -500,
      radius: 5,
      hostile: true,
      kind: TOXIN,
      owner: 1,
    });
    setIntEffect(u, 2, {
      x: 4,
      y: 4,
      radius: 5,
      hostile: true,
      kind: TOXIN,
      owner: 1,
    });
    u.count = 2;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        expect(intEffectOver(u, x, y, 2, TOXIN)).toBe(0);
      }
    }
  });
});
