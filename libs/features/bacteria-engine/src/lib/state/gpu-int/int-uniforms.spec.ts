import { gameBalance } from '../game-balance';
import { Q14_STATE_MAX } from './fixed-point';
import { intMatchUniforms } from './int-uniforms';

describe('intMatchUniforms', () => {
  it('converts the balance into integers the shaders can take', () => {
    const u = intMatchUniforms(gameBalance);
    for (const value of Object.values(u)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
    expect(u.maxEnergy).toBe(16384);
    expect(u.superMaxEnergy).toBeLessThanOrEqual(Q14_STATE_MAX);
    expect(u.consumeChance).toBe(0x80000000);
  });

  it('gives the same integers for the same balance', () => {
    expect(intMatchUniforms({ ...gameBalance })).toEqual(
      intMatchUniforms(gameBalance)
    );
  });
});
