import { ONE_Q14 } from './fixed-point';
import { isqrt, unitQ14 } from './int-math';

/** The shader's `isqrt`, bit by bit - what the float root has to equal. */
function shaderIsqrt(value: number): number {
  let n = value >>> 0;
  let result = 0;
  let bit = 1 << 30;
  while (bit > n) {
    bit >>>= 2;
  }
  while (bit !== 0) {
    if (n >= result + bit) {
      n -= result + bit;
      result = (result >>> 1) + bit;
    } else {
      result >>>= 1;
    }
    bit >>>= 2;
  }
  return result;
}

/** The shader's `unitQ14`, scaling by its loops of halvings and doublings. */
function shaderUnitQ14(vx: number, vy: number): number[] {
  if (vx === 0 && vy === 0) {
    return [0, 0];
  }
  let ax = Math.abs(vx);
  let ay = Math.abs(vy);
  while (Math.max(ax, ay) >= 32768) {
    ax >>>= 1;
    ay >>>= 1;
  }
  while (Math.max(ax, ay) < 16384) {
    ax <<= 1;
    ay <<= 1;
  }
  const length = shaderIsqrt(ax * ax + ay * ay);
  const half = length >>> 1;
  // As ints, which hold no -0.
  return [
    (Math.sign(vx) * Math.floor((ax * ONE_Q14 + half) / length)) | 0,
    (Math.sign(vy) * Math.floor((ay * ONE_Q14 + half) / length)) | 0,
  ];
}

describe('integer maths', () => {
  it('takes exact integer square roots around every square', () => {
    expect(isqrt(0)).toBe(0);
    for (let k = 2; k < 65536; k += 7) {
      const square = k * k;
      expect(isqrt(square - 1)).toBe(k - 1);
      expect(isqrt(square)).toBe(k);
      expect(isqrt(square + 1)).toBe(k);
    }
    expect(isqrt(0xffffffff)).toBe(65535);
  });

  it('takes the root bit by bit, as the shader does, over every uint', () => {
    for (let n = 0; n < 2 ** 32; n += 999_983) {
      expect(isqrt(n)).toBe(shaderIsqrt(n));
    }
    for (const n of [1, 2, 3, 2 ** 31 - 1, 2 ** 31, 2 ** 32 - 2, 2 ** 32 - 1]) {
      expect(isqrt(n)).toBe(shaderIsqrt(n));
    }
  });

  it('scales a direction as the shader does, short or long', () => {
    const out = new Int32Array(2);
    const lengths = [
      1,
      3,
      255,
      16383,
      16384,
      32767,
      32768,
      999_999,
      2 ** 30 - 1,
    ];
    for (const length of lengths) {
      for (let a = 0; a < 360; a += 7) {
        const x = Math.round(Math.cos((a * Math.PI) / 180) * length);
        const y = Math.round(Math.sin((a * Math.PI) / 180) * length);
        expect(Array.from(unitQ14(x, y, out))).toEqual(shaderUnitQ14(x, y));
      }
    }
  });

  it('scales directions to Q14 unit vectors', () => {
    const out = new Int32Array(2);
    expect(Array.from(unitQ14(0, 0, out))).toEqual([0, 0]);
    expect(Array.from(unitQ14(5, 0, out))).toEqual([ONE_Q14, 0]);
    expect(Array.from(unitQ14(0, -900_000, out))).toEqual([0, -ONE_Q14]);
    expect(Array.from(unitQ14(3, 4, out))).toEqual([9830, 13107]);
    expect(Array.from(unitQ14(-1, 1, out))).toEqual([-11585, 11585]);
  });

  it('refuses what the shader could not take', () => {
    const out = new Int32Array(2);
    expect(() => unitQ14(0.5, 0.5, out)).toThrow(RangeError);
    expect(() => unitQ14(Infinity, 0, out)).toThrow(RangeError);
    expect(() => unitQ14(2 ** 30, 0, out)).toThrow(RangeError);
  });

  it('keeps every direction within a unit of length 1', () => {
    const out = new Int32Array(2);
    for (let a = 0; a < 360; a += 3) {
      const x = Math.round(Math.cos((a * Math.PI) / 180) * 1000);
      const y = Math.round(Math.sin((a * Math.PI) / 180) * 1000);
      unitQ14(x, y, out);
      const length = Math.hypot(out[0], out[1]);
      expect(Math.abs(length - ONE_Q14)).toBeLessThan(2);
    }
  });
});
