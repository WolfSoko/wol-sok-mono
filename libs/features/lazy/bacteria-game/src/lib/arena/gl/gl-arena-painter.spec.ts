import { gameBalance } from '../../state/game-balance';
import { encodeCells } from './gl-arena-painter';

describe('encodeCells', () => {
  const width = 8;
  const height = 4;

  it('packs density and overcharge per cell and reports the covered box', () => {
    const out = new Uint8Array(width * height * 2);

    const bounds = encodeCells(
      out,
      width,
      [
        { x: 1, y: 1, energy: gameBalance.maxEnergy },
        { x: 5, y: 2, energy: gameBalance.superChargedMaxEnergy },
        { x: 3, y: 3, energy: 0 },
      ],
      gameBalance
    );

    expect(bounds).toEqual({ minX: 1, minY: 1, maxX: 5, maxY: 3 });
    // Full strength, not overcharged.
    expect([out[(1 * width + 1) * 2], out[(1 * width + 1) * 2 + 1]]).toEqual([
      255, 0,
    ]);
    // Supercharged: full strength and full heat.
    expect([out[(2 * width + 5) * 2], out[(2 * width + 5) * 2 + 1]]).toEqual([
      255, 255,
    ]);
    // Out of energy - still a bacterium, at the lowest density.
    expect(out[(3 * width + 3) * 2]).toBe(Math.round(255 * 0.55));
    // Empty cells stay 0.
    expect(out[0]).toBe(0);
  });

  it('clears the last frame and reports nothing for an empty colony', () => {
    const out = new Uint8Array(width * height * 2).fill(9);

    expect(encodeCells(out, width, [], gameBalance)).toBeNull();
    expect(out.every((byte) => byte === 0)).toBe(true);
  });
});
