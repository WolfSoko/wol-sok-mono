import { WEAPON_EFFECTS } from '../evolution';
import { ZONE_EFFECTS } from '../zones';
import { chanceThreshold } from './fixed-point';
import {
  createIntFrameUniforms,
  DIVIDE_VARIANTS,
  divideVariant,
  fillIntFrameUniforms,
} from './int-frame-uniforms';

// The conversion takes its inputs as 32 bit floats, as the GPU path holds them.
const f32 = Math.fround;

describe('int frame uniforms', () => {
  const floats = {
    targets: [12.5, 40, -7, 0.25, NaN, NaN, NaN, NaN],
    aggression: [0.5, 1, 0.3, 0],
    divideChance: [0.01, 0.2, 0, 0],
    divideBudget: [1, 0.3, 1, 0],
  };

  it('converts crosshairs, off the grid too, and aggression', () => {
    const u = fillIntFrameUniforms(createIntFrameUniforms(), floats);
    expect(Array.from(u.targets)).toEqual([200, 640, -112, 4, 0, 0, 0, 0]);
    expect(Array.from(u.aggression)).toEqual([8192, 16384, 4915, 0]);
  });

  it('folds the ground and the effects into one threshold each', () => {
    const u = fillIntFrameUniforms(createIntFrameUniforms(), floats);
    const at = (slot: number, variant: number) =>
      u.divideChance[slot * DIVIDE_VARIANTS + variant];
    expect(at(0, divideVariant(false, false, false))).toBe(
      chanceThreshold(f32(0.01))
    );
    expect(at(0, divideVariant(true, false, false))).toBe(
      chanceThreshold(f32(0.01) * ZONE_EFFECTS.agarDivideFactor)
    );
    expect(at(0, divideVariant(true, true, true))).toBe(
      chanceThreshold(
        f32(0.01) *
          ZONE_EFFECTS.agarDivideFactor *
          WEAPON_EFFECTS.agarBloomDivideFactor *
          WEAPON_EFFECTS.cryoDivideFactor
      )
    );
  });

  it('caps every threshold at the colony budget', () => {
    const u = fillIntFrameUniforms(createIntFrameUniforms(), floats);
    const bloom = divideVariant(true, true, false);
    // 0.2 * 2 * 3 is over the budget of 0.3.
    expect(u.divideChance[1 * DIVIDE_VARIANTS + bloom]).toBe(
      chanceThreshold(f32(0.3))
    );
    expect(u.divideChance[3 * DIVIDE_VARIANTS]).toBe(0);
  });

  it('numbers the variants by bit', () => {
    expect(divideVariant(false, false, false)).toBe(0);
    expect(divideVariant(true, false, false)).toBe(1);
    expect(divideVariant(false, true, false)).toBe(2);
    expect(divideVariant(false, false, true)).toBe(4);
    expect(divideVariant(true, true, true)).toBe(DIVIDE_VARIANTS - 1);
  });
});
