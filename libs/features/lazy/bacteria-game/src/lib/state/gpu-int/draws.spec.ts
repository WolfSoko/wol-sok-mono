import { drawAt, frameSeed, pcg3d, SALT, stepSalt } from './draws';

describe('draws', () => {
  // Pinned values: the shaders (gl/int-common.ts) produce the same bits on
  // SwiftShader, llvmpipe and Firefox. A change here changes every
  // deterministic match and needs a BALANCE_VERSION bump.
  it('hashes like the GLSL pcg3d', () => {
    expect(pcg3d(0, 0, 0)).toBe(PINNED.zero);
    expect(pcg3d(1, 2, 3)).toBe(PINNED.oneTwoThree);
    expect(pcg3d(0xffffffff, 0xffffffff, 0xffffffff)).toBe(PINNED.max);
  });

  it('mixes the match seed into the frame seed', () => {
    expect(frameSeed(42, 7)).toBe(PINNED.frame);
    expect(frameSeed(42, 7)).not.toBe(frameSeed(43, 7));
    expect(frameSeed(42, 7)).not.toBe(frameSeed(42, 8));
  });

  it('draws per cell, frame and purpose', () => {
    const seed = frameSeed(42, 7);
    expect(drawAt(10, 20, seed, SALT.moveOctant)).toBe(PINNED.draw);
    expect(drawAt(10, 20, seed, SALT.moveOctant)).not.toBe(
      drawAt(10, 20, seed, SALT.moveAxisFirst)
    );
    expect(drawAt(10, 20, seed, SALT.moveOctant)).not.toBe(
      drawAt(11, 20, seed, SALT.moveOctant)
    );
  });

  it('keeps every salt apart', () => {
    const salts = Object.values(SALT);
    expect(new Set(salts).size).toBe(salts.length);
  });

  it('spreads the movement steps of a frame', () => {
    expect(stepSalt(SALT.moveOctant, 0)).toBe(3);
    expect(stepSalt(SALT.moveOctant, 2)).toBe(197);
  });

  it('draws evenly', () => {
    const seed = frameSeed(1, 1);
    const buckets = new Array<number>(16).fill(0);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        buckets[drawAt(x, y, seed, SALT.consume) >>> 28]++;
      }
    }
    for (const count of buckets) {
      expect(Math.abs(count - 1024)).toBeLessThan(160);
    }
  });
});

const PINNED = {
  zero: 206706049,
  oneTwoThree: 3942831963,
  max: 1358707617,
  frame: 2671173581,
  draw: 1437988002,
};
