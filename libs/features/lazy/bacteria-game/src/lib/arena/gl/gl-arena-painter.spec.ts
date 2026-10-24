import { gameBalance } from '../../state/game-balance';
import { ColonyTint, TINT_MODES, WHOLE_COLONY } from '../weapon-effects';
import { encodeCells, packTints, passMargins } from './gl-arena-painter';
import { MAX_TINTS } from './shaders';

describe('packTints', () => {
  const ORANGE = [255, 140, 0, 255];
  const BLUE = [40, 120, 255, 255];

  function tint(
    mode: ColonyTint['mode'],
    enemies: boolean,
    radius = 18
  ): ColonyTint {
    return {
      mode,
      x: 10,
      y: 20,
      radius,
      strength: 0.5,
      ownerColor: ORANGE,
      enemies,
    };
  }

  it('packs the tints that shade a colony for the colony shader', () => {
    const circles = new Float32Array(MAX_TINTS * 4);
    const modes = new Float32Array(4);
    const tints = [tint('toxin', true), tint('shield', false, WHOLE_COLONY)];

    // The enemy sickens in the cloud.
    expect(packTints(tints, BLUE, circles, modes)).toBe(1);
    expect(Array.from(circles.slice(0, 4))).toEqual([10, 20, 18, 0.5]);
    expect(modes[0]).toBe(TINT_MODES.indexOf('toxin'));

    // The owner wears its shield.
    expect(packTints(tints, ORANGE, circles, modes)).toBe(1);
    expect(circles[2]).toBe(WHOLE_COLONY);
    expect(modes[0]).toBe(TINT_MODES.indexOf('shield'));
  });

  it('packs no more tints than the shader takes', () => {
    const circles = new Float32Array(MAX_TINTS * 4);
    const modes = new Float32Array(4);
    const tints = Array.from({ length: MAX_TINTS + 3 }, () =>
      tint('cryo', true)
    );

    expect(packTints(tints, BLUE, circles, modes)).toBe(MAX_TINTS);
  });
});

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

describe('passMargins', () => {
  // The colony pass reads the vertical blur one cell further out than its
  // box, the vertical blur the horizontal one two rows, the horizontal blur
  // the cells two columns: each pass has to cover what the next one reads,
  // or the next one picks up the other colony's stale density.
  it.each([0, 3, 5, 10])(
    'lets every pass cover what the next one reads, at a reach of %i',
    (reach) => {
      const margin = passMargins(reach);

      expect(margin.verticalBlur).toBeGreaterThanOrEqual(margin.colony + 1);
      expect(margin.horizontalBlur).toBeGreaterThanOrEqual(
        margin.verticalBlur + 2
      );
      expect(margin.cells).toBeGreaterThanOrEqual(margin.horizontalBlur + 2);
    }
  );

  it('moves the whole chain out by the reach', () => {
    const near = passMargins(0);
    const far = passMargins(5);

    expect(far.colony).toBe(near.colony + 5);
    expect(far.cells).toBe(near.cells + 5);
  });
});
