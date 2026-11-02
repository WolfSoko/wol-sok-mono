import { geneLevel, GENES, isPlainLoadout, weaponOf } from './evolution';
import { geneCost } from './evolution-progress';
import {
  expectedDna,
  expectedLoadout,
  expectedXp,
  spend,
} from './expected-player';
import { LEVELS } from './levels';

describe('the typical player', () => {
  it('starts with nothing and gains XP with every level', () => {
    expect(expectedXp(0)).toBe(0);
    for (let index = 1; index < LEVELS.length; index++) {
      expect(expectedXp(index)).toBeGreaterThan(expectedXp(index - 1));
    }
  });

  it('holds somewhere between half and all of the evolution at the finale', () => {
    const dna = expectedDna(LEVELS.length - 1);

    expect(dna).toBeGreaterThan(50);
    expect(dna).toBeLessThan(220);
  });

  it('lies between two levels for a fractional index', () => {
    expect(expectedXp(4.5)).toBeGreaterThan(expectedXp(4));
    expect(expectedXp(4.5)).toBeLessThan(expectedXp(5));
  });

  it('carries nothing on the first level, a gene and a weapon soon after', () => {
    expect(isPlainLoadout(expectedLoadout(expectedDna(0)))).toBe(true);
    expect(expectedLoadout(expectedDna(1))).toEqual({
      genes: { mitosis: 1 },
      weapon: null,
    });
    expect(expectedLoadout(10).weapon).toBe('toxin-bomb');
    expect(expectedLoadout(expectedDna(LEVELS.length - 1)).weapon).toBe(
      'phage-strike'
    );
  });

  it('never spends more than it earned', () => {
    for (let dna = 0; dna <= 240; dna += 7) {
      const loadout = expectedLoadout(dna);
      const genes = GENES.reduce(
        (sum, { id }) => sum + geneCost(geneLevel(loadout, id)),
        0
      );
      const weapons =
        loadout.weapon === 'phage-strike'
          ? weaponOf('toxin-bomb').cost + weaponOf('phage-strike').cost
          : loadout.weapon === null
            ? 0
            : weaponOf(loadout.weapon).cost;
      expect(genes + weapons).toBeLessThanOrEqual(dna);
    }
  });

  it('stops at the first purchase it cannot pay for', () => {
    expect(
      spend(5, [
        { gene: 'mitosis' },
        { weapon: 'toxin-bomb' },
        { gene: 'toxins' },
      ])
    ).toEqual({ genes: { mitosis: 1 }, weapon: null });
  });

  it('skips a gene already bred to the top', () => {
    const purchases = Array.from({ length: 6 }, () => ({
      gene: 'mitosis' as const,
    }));

    expect(spend(100, purchases).genes).toEqual({ mitosis: 5 });
  });
});
