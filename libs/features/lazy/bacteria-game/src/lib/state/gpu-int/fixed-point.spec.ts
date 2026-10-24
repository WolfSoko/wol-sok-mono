import {
  chanceThreshold,
  mulQ14,
  ONE_Q14,
  Q14_STATE_MAX,
  TARGET_MAX,
  toQ14,
  toTarget,
  toUnsignedQ14,
} from './fixed-point';

describe('fixed point', () => {
  it('turns shares into Q14 and keeps them in 0..1', () => {
    expect(toQ14(0.5)).toBe(8192);
    expect(toQ14(0.55)).toBe(9011);
    expect(toQ14(-1)).toBe(0);
    expect(toQ14(2)).toBe(ONE_Q14);
    expect(toQ14(Number.NaN)).toBe(0);
    expect(toQ14(Infinity)).toBe(ONE_Q14);
  });

  it('caps unsigned energies at what the state holds', () => {
    expect(toUnsignedQ14(1.75)).toBe(28672);
    expect(toUnsignedQ14(10)).toBe(Q14_STATE_MAX);
    expect(toUnsignedQ14(-0.2)).toBe(0);
    expect(toUnsignedQ14(Number.NaN)).toBe(0);
    expect(toUnsignedQ14(Infinity)).toBe(Q14_STATE_MAX);
  });

  it('turns chances into thresholds for a 32 bit draw', () => {
    expect(chanceThreshold(0)).toBe(0);
    expect(chanceThreshold(Number.NaN)).toBe(0);
    expect(chanceThreshold(0.5)).toBe(0x80000000);
    expect(chanceThreshold(0.9)).toBe(3865470566);
    expect(chanceThreshold(1)).toBe(0xffffffff);
  });

  it('keeps crosshairs in sixteenths of a cell, in range', () => {
    expect(toTarget(12.5)).toBe(200);
    expect(toTarget(-3)).toBe(0);
    expect(toTarget(1e6)).toBe(TARGET_MAX);
    expect(toTarget(Number.NaN)).toBe(0);
  });

  it('multiplies in Q14, rounding towards minus infinity like GLSL', () => {
    expect(mulQ14(ONE_Q14, 12345)).toBe(12345);
    expect(mulQ14(8192, 3)).toBe(1);
    expect(mulQ14(-8192, 3)).toBe(-2);
    expect(mulQ14(Q14_STATE_MAX, ONE_Q14)).toBe(Q14_STATE_MAX);
  });
});
