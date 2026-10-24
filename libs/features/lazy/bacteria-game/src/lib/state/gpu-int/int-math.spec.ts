import { ONE_Q14 } from './fixed-point';
import { isqrt, unitQ14 } from './int-math';

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

  it('agrees with the float square root where it is exact', () => {
    for (let n = 0; n < 2 ** 32; n += 999_983) {
      expect(isqrt(n)).toBe(Math.floor(Math.sqrt(n)));
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
