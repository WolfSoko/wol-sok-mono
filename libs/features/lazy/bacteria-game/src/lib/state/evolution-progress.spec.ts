import {
  dnaEarned,
  GENES,
  MAX_GENE_LEVEL,
  parseGeneLevels,
  WEAPONS,
} from './evolution';
import {
  adoptEvolution,
  availableDna,
  canBuyAnySkin,
  canBuyAnything,
  canBuyGene,
  canBuySkin,
  canBuyWeapon,
  EMPTY_EVOLUTION,
  EvolutionProgress,
  geneCost,
  geneLevelCost,
  loadoutOf,
  mergeEvolution,
  nextGeneCost,
  ownsSkin,
  parseEvolution,
  refundableDna,
  resetEvolution,
  sameEvolution,
  spentDna,
  withEquipped,
  withGeneLevel,
  withSkin,
  withWeapon,
} from './evolution-progress';
import { RANKS } from './ranks';
import {
  BACTERIA_LOOKS,
  isPremiumSkin,
  PREMIUM_SKINS,
  SKINS,
  skinCost,
} from './skins';

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
      expect(spentDna(all)).toBe(225);
      expect(dnaEarned(top)).toBeGreaterThanOrEqual(spentDna(all));
      expect(dnaEarned(RANKS[RANKS.length - 2].xp)).toBeLessThan(spentDna(all));
    });

    it('charges each gene level exponentially more, and nothing past the top', () => {
      expect([1, 2, 3, 4, 5].map((level) => geneLevelCost(level))).toEqual([
        2, 3, 5, 8, 13,
      ]);
      expect([1, 2, 3, 4, 5].map((level) => geneCost(level))).toEqual([
        2, 5, 10, 18, 31,
      ]);
      expect(
        nextGeneCost(evolution({ genes: { toxins: 5 } }), 'toxins')
      ).toBeNull();
      expect(WEAPONS.map(({ cost }) => cost)).toEqual([6, 10, 14, 18, 22]);
    });
  });

  describe('the DNA left', () => {
    it('is the DNA earned less the cost of what is held', () => {
      const held = evolution({
        genes: { mitosis: 2 },
        weapons: ['toxin-bomb'],
      });
      expect(availableDna(20, held)).toBe(20 - 5 - 6);
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
      expect(first.equipCount).toBe(1);
      expect(second.equipped).toBe('cryo-pulse');
      expect(second.equipCount).toBe(1);
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

    describe('the weapon carried', () => {
      const weapons = ['toxin-bomb', 'cryo-pulse'] as const;
      const both = (
        a: EvolutionProgress,
        b: EvolutionProgress
      ): [EvolutionProgress, EvolutionProgress] => [
        mergeEvolution(a, b),
        mergeEvolution(b, a),
      ];

      it('is the one picked last, whichever way round the two come', () => {
        const before = evolution({
          weapons: [...weapons],
          equipped: 'toxin-bomb',
          equipCount: 1,
        });
        const picked = withEquipped(before, 'cryo-pulse');

        for (const merged of both(before, picked)) {
          expect(merged.equipped).toBe('cryo-pulse');
          expect(merged.equipCount).toBe(2);
        }
      });

      it('survives a stale value that carries nothing yet', () => {
        // Bought before the storage first answered: the stored value is
        // still from before, without any weapon.
        const bought = withWeapon(EMPTY_EVOLUTION, 'toxin-bomb');
        const stale = evolution({ genes: { mitosis: 1 } });

        for (const merged of both(bought, stale)) {
          expect(merged.equipped).toBe('toxin-bomb');
          expect(merged.genes).toEqual({ mitosis: 1 });
        }
      });

      it('is put down when another device put it down last', () => {
        const carried = evolution({
          weapons: [...weapons],
          equipped: 'toxin-bomb',
          equipCount: 3,
        });
        const elsewhere = withEquipped(carried, null);

        for (const merged of both(carried, elsewhere)) {
          expect(merged.equipped).toBeNull();
        }
      });

      it('is the same on both devices after picks made at once', () => {
        const start = evolution({ weapons: [...weapons], equipCount: 2 });
        const here = withEquipped(start, 'toxin-bomb');
        const there = withEquipped(start, 'cryo-pulse');

        const [one, other] = both(here, there);
        expect(one).toEqual(other);
        expect(one.equipped).toBe('cryo-pulse');
        expect(both(here, withEquipped(here, null))[0].equipped).toBeNull();
      });

      it('reads a value stored before picks were counted as none counted', () => {
        const old = parseEvolution({
          weapons: [...weapons],
          equipped: 'cryo-pulse',
        });

        expect(old.equipCount).toBe(0);
        expect(
          mergeEvolution(old, withEquipped(old, 'toxin-bomb')).equipped
        ).toBe('toxin-bomb');
      });
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
        equipCount: 1,
        epoch: 1,
        skins: [],
      });
    });

    it('keeps the weapon an account carries when it adopts a guest', () => {
      const account = evolution({
        weapons: ['cryo-pulse'],
        equipped: 'cryo-pulse',
        equipCount: 2,
      });
      const guest = evolution({
        weapons: ['toxin-bomb'],
        equipped: 'toxin-bomb',
        equipCount: 9,
      });

      expect(adoptEvolution(account, guest)).toMatchObject({
        weapons: ['toxin-bomb', 'cryo-pulse'],
        equipped: 'cryo-pulse',
        equipCount: 2,
      });
    });
  });

  describe('parsing', () => {
    it('reads what it stored', () => {
      const stored = evolution({
        genes: { metabolism: 4 },
        weapons: ['phage-strike'],
        equipped: 'phage-strike',
        equipCount: 4,
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
          equipCount: -2,
          epoch: 'two',
        })
      ).toEqual({
        genes: { mitosis: 5 },
        weapons: ['toxin-bomb'],
        equipped: null,
        equipCount: 0,
        epoch: 0,
        skins: [],
      });
    });

    it('reads the skins bought, free and unknown ones dropped', () => {
      expect(
        parseEvolution({ skins: ['chrome', 'slime', 'fur', 'marbles', 7] })
          .skins
      ).toEqual(['marbles', 'chrome']);
    });
  });

  describe('skins', () => {
    it('prices the eleven to buy at 140 strands together, the slime and the pixels free', () => {
      expect(PREMIUM_SKINS.reduce((sum, { cost }) => sum + cost, 0)).toBe(140);
      expect(
        SKINS.filter(({ cost }) => cost === 0).map(({ id }) => id)
      ).toEqual(['slime', 'pixels']);
      expect(BACTERIA_LOOKS.slice(0, 2)).toEqual(['slime', 'pixels']);
      expect(skinCost('slime')).toBe(0);
      expect(skinCost('cells')).toBe(3);
      expect(skinCost('chrome')).toBe(30);
      expect(isPremiumSkin('chrome')).toBe(true);
      expect(isPremiumSkin('cells')).toBe(true);
      expect(isPremiumSkin('pixels')).toBe(false);
      expect(isPremiumSkin('fur')).toBe(false);
    });

    it('buys a skin once, never a free one, with the DNA left', () => {
      const bought = withSkin(EMPTY_EVOLUTION, 'lava');
      expect(bought.skins).toEqual(['lava']);
      expect(withSkin(bought, 'lava')).toBe(bought);
      expect(withSkin(bought, 'slime')).toBe(bought);
      expect(withSkin(bought, 'marbles').skins).toEqual(['marbles', 'lava']);
      expect(ownsSkin(bought, 'lava')).toBe(true);
      expect(ownsSkin(bought, 'slime')).toBe(true);
      expect(ownsSkin(bought, 'chrome')).toBe(false);

      expect(spentDna(bought)).toBe(16);
      expect(refundableDna(bought)).toBe(0);
      expect(canBuySkin(16 + 29, bought, 'chrome')).toBe(false);
      expect(canBuySkin(16 + 30, bought, 'chrome')).toBe(true);
      expect(canBuySkin(100, bought, 'lava')).toBe(false);
      expect(canBuyAnySkin(16 + 2, bought)).toBe(false);
      expect(canBuyAnySkin(16 + 3, bought)).toBe(true);
      // A skin is not what the Evolution tile badges.
      expect(canBuyAnything(16 + 1, bought)).toBe(false);
    });

    it('keeps the skins through a reset, and across epochs in a merge', () => {
      const held = withSkin(
        evolution({ genes: { mitosis: 2 }, weapons: ['toxin-bomb'] }),
        'galaxy'
      );
      const reset = resetEvolution(held);
      expect(reset.skins).toEqual(['galaxy']);
      expect(reset.genes).toEqual({});
      expect(spentDna(reset)).toBe(20);

      const elsewhere = withSkin(evolution({ epoch: 0 }), 'plasma');
      expect(mergeEvolution(reset, elsewhere).skins).toEqual([
        'galaxy',
        'plasma',
      ]);
      expect(mergeEvolution(elsewhere, reset).skins).toEqual([
        'galaxy',
        'plasma',
      ]);
      expect(mergeEvolution(reset, elsewhere).epoch).toBe(1);
      const same = mergeEvolution(held, withSkin(held, 'plasma'));
      expect(same.skins).toEqual(['galaxy', 'plasma']);
      expect(sameEvolution(held, withSkin(held, 'plasma'))).toBe(false);
      expect(adoptEvolution(reset, elsewhere).skins).toEqual([
        'galaxy',
        'plasma',
      ]);
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
    expect(sameEvolution(evolution(), evolution({ equipCount: 1 }))).toBe(
      false
    );
  });
});

describe('parseGeneLevels', () => {
  const damaged = {
    mitosis: 2,
    toxins: 9,
    membrane: 1.5,
    nose: 3,
    flagella: 0,
  };

  it('keeps what it can read of a stored value, capped at the top', () => {
    expect(parseGeneLevels(damaged)).toEqual({
      mitosis: 2,
      toxins: MAX_GENE_LEVEL,
    });
    expect(parseGeneLevels('mitosis')).toEqual({});
  });

  it('takes a recorded one only exactly as written', () => {
    expect(
      parseGeneLevels({ mitosis: 2, toxins: 5 }, { strict: true })
    ).toEqual({ mitosis: 2, toxins: 5 });
    expect(parseGeneLevels(damaged, { strict: true })).toBeNull();
    expect(parseGeneLevels({ toxins: 6 }, { strict: true })).toBeNull();
    expect(parseGeneLevels(null, { strict: true })).toBeNull();
  });
});
