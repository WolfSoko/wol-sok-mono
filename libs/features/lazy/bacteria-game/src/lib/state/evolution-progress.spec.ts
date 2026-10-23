import { dnaEarned, GENES, MAX_GENE_LEVEL, WEAPONS } from './evolution';
import {
  adoptEvolution,
  availableDna,
  canBuyAnything,
  canBuyGene,
  canBuyWeapon,
  EMPTY_EVOLUTION,
  EvolutionProgress,
  geneCost,
  loadoutOf,
  mergeEvolution,
  nextGeneCost,
  parseEvolution,
  resetEvolution,
  sameEvolution,
  spentDna,
  WEAPON_COSTS,
  withEquipped,
  withGeneLevel,
  withWeapon,
} from './evolution-progress';
import { RANKS } from './ranks';

function evolution(
  partial: Partial<EvolutionProgress> = {}
): EvolutionProgress {
  return { ...EMPTY_EVOLUTION, ...partial };
}

describe('evolution progress', () => {
  describe('the cost curve', () => {
    it('makes the first gene level affordable after the first match won', () => {
      // A win on easy is 100 XP, the bronze 20 and First Blood 50.
      const earned = dnaEarned(170);
      expect(canBuyGene(earned, EMPTY_EVOLUTION, 'mitosis')).toBe(true);
      expect(nextGeneCost(EMPTY_EVOLUTION, 'mitosis')).toBe(2);
    });

    it('costs about what the climb to the top rank earns, for everything', () => {
      const all = evolution({
        genes: Object.fromEntries(GENES.map(({ id }) => [id, MAX_GENE_LEVEL])),
        weapons: WEAPONS.map(({ id }) => id),
      });
      const top = RANKS[RANKS.length - 1].xp;

      expect(spentDna(all)).toBe(5 * geneCost(5) + 70);
      expect(spentDna(all)).toBe(220);
      expect(dnaEarned(top)).toBeGreaterThanOrEqual(spentDna(all));
      expect(dnaEarned(RANKS[RANKS.length - 2].xp)).toBeLessThan(spentDna(all));
    });

    it('charges 2n for gene level n, and nothing past the top', () => {
      expect([1, 2, 3, 4, 5].map((level) => geneCost(level))).toEqual([
        2, 6, 12, 20, 30,
      ]);
      expect(
        nextGeneCost(evolution({ genes: { toxins: 5 } }), 'toxins')
      ).toBeNull();
      expect(Object.values(WEAPON_COSTS)).toEqual([6, 10, 14, 18, 22]);
    });
  });

  describe('the DNA left', () => {
    it('is the DNA earned less the cost of what is held', () => {
      const held = evolution({
        genes: { mitosis: 2 },
        weapons: ['toxin-bomb'],
      });
      expect(availableDna(20, held)).toBe(20 - 6 - 6);
    });

    it('never drops below 0 after a merge spent more, and blocks buying', () => {
      const overspent = evolution({ genes: { mitosis: 5, toxins: 5 } });

      expect(availableDna(10, overspent)).toBe(0);
      expect(canBuyAnything(10, overspent)).toBe(false);
      // Nothing is taken back.
      expect(loadoutOf(overspent).genes).toEqual({ mitosis: 5, toxins: 5 });
    });

    it('tells whether anything can be bought', () => {
      expect(canBuyAnything(1, EMPTY_EVOLUTION)).toBe(false);
      expect(canBuyAnything(2, EMPTY_EVOLUTION)).toBe(true);
      expect(canBuyWeapon(6, EMPTY_EVOLUTION, 'toxin-bomb')).toBe(true);
      expect(canBuyWeapon(6, EMPTY_EVOLUTION, 'cryo-pulse')).toBe(false);
      expect(
        canBuyWeapon(100, evolution({ weapons: ['toxin-bomb'] }), 'toxin-bomb')
      ).toBe(false);
    });
  });

  describe('purchases', () => {
    it('breeds a gene to a level, which applied twice changes nothing', () => {
      const once = withGeneLevel(EMPTY_EVOLUTION, 'flagella', 1);
      expect(withGeneLevel(once, 'flagella', 1)).toBe(once);
      expect(withGeneLevel(once, 'flagella', 9).genes.flagella).toBe(5);
      expect(
        withGeneLevel(evolution({ genes: { flagella: 3 } }), 'flagella', 2)
          .genes.flagella
      ).toBe(3);
    });

    it('carries the first weapon bought, and not the later ones', () => {
      const first = withWeapon(EMPTY_EVOLUTION, 'cryo-pulse');
      const second = withWeapon(first, 'toxin-bomb');

      expect(first.equipped).toBe('cryo-pulse');
      expect(second.equipped).toBe('cryo-pulse');
      expect(second.weapons).toEqual(['toxin-bomb', 'cryo-pulse']);
    });

    it('equips only a weapon held, or none', () => {
      const held = evolution({ weapons: ['toxin-bomb'], equipped: null });

      expect(withEquipped(held, 'toxin-bomb').equipped).toBe('toxin-bomb');
      expect(withEquipped(held, 'phage-strike')).toBe(held);
      expect(
        withEquipped({ ...held, equipped: 'toxin-bomb' }, null).equipped
      ).toBeNull();
    });

    it('resets everything above every epoch it knows', () => {
      const held = evolution({
        genes: { mitosis: 3 },
        weapons: ['toxin-bomb'],
        equipped: 'toxin-bomb',
        epoch: 1,
      });
      expect(resetEvolution(held, evolution({ epoch: 4 }))).toEqual({
        ...EMPTY_EVOLUTION,
        epoch: 5,
      });
      expect(resetEvolution(held).epoch).toBe(2);
    });
  });

  describe('merging', () => {
    it('keeps the higher level per gene and the weapons of both', () => {
      const merged = mergeEvolution(
        evolution({
          genes: { mitosis: 3, toxins: 1 },
          weapons: ['agar-bloom'],
        }),
        evolution({
          genes: { mitosis: 1, membrane: 2 },
          weapons: ['toxin-bomb'],
        })
      );

      expect(merged.genes).toEqual({ mitosis: 3, toxins: 1, membrane: 2 });
      expect(merged.weapons).toEqual(['toxin-bomb', 'agar-bloom']);
    });

    it('lets a higher epoch win outright - a reset is not undone', () => {
      const reset = evolution({ epoch: 2 });
      const old = evolution({ genes: { mitosis: 5 }, epoch: 1 });

      expect(mergeEvolution(old, reset)).toBe(reset);
      expect(mergeEvolution(reset, old)).toBe(reset);
    });

    it("takes the other's weapon carried, as long as it is held", () => {
      const held = evolution({
        weapons: ['toxin-bomb', 'cryo-pulse'],
        equipped: 'toxin-bomb',
      });

      expect(
        mergeEvolution(held, evolution({ equipped: null })).equipped
      ).toBeNull();
      expect(
        mergeEvolution(
          held,
          evolution({ weapons: ['cryo-pulse'], equipped: 'cryo-pulse' })
        ).equipped
      ).toBe('cryo-pulse');
    });

    it("adopts a guest's purchases into the account's epoch", () => {
      const account = evolution({ genes: { toxins: 2 }, epoch: 1 });
      const guest = evolution({
        genes: { mitosis: 1 },
        weapons: ['toxin-bomb'],
        equipped: 'toxin-bomb',
        epoch: 7,
      });

      expect(adoptEvolution(account, guest)).toEqual({
        genes: { toxins: 2, mitosis: 1 },
        weapons: ['toxin-bomb'],
        equipped: 'toxin-bomb',
        epoch: 1,
      });
    });
  });

  describe('parsing', () => {
    it('reads what it stored', () => {
      const stored = evolution({
        genes: { metabolism: 4 },
        weapons: ['phage-strike'],
        equipped: 'phage-strike',
        epoch: 3,
      });
      expect(parseEvolution(JSON.parse(JSON.stringify(stored)))).toEqual(
        stored
      );
    });

    it('keeps what it can read and drops the rest', () => {
      expect(parseEvolution(null)).toEqual(EMPTY_EVOLUTION);
      expect(parseEvolution('junk')).toEqual(EMPTY_EVOLUTION);
      expect(
        parseEvolution({
          genes: { mitosis: 9, toxins: -1, nonsense: 3, flagella: 1.5 },
          weapons: ['toxin-bomb', 'laser', 'toxin-bomb', 4],
          equipped: 'cryo-pulse',
          epoch: 'two',
        })
      ).toEqual({
        genes: { mitosis: 5 },
        weapons: ['toxin-bomb'],
        equipped: null,
        epoch: 0,
      });
    });
  });

  it('turns into the loadout of a match', () => {
    expect(
      loadoutOf(
        evolution({
          genes: { mitosis: 2 },
          weapons: ['toxin-bomb'],
          equipped: 'toxin-bomb',
        })
      )
    ).toEqual({ genes: { mitosis: 2 }, weapon: 'toxin-bomb' });
  });

  it('tells two equal evolutions', () => {
    expect(
      sameEvolution(
        evolution({ genes: { mitosis: 1 } }),
        evolution({ genes: { mitosis: 1 } })
      )
    ).toBe(true);
    expect(
      sameEvolution(evolution(), evolution({ weapons: ['toxin-bomb'] }))
    ).toBe(false);
  });
});
