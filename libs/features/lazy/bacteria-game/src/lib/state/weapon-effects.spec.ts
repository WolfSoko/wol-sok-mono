import { ActiveEffect, WEAPON_EFFECTS, WeaponId } from './evolution';
import { TICK_SEC } from './fixed-tick';
import {
  covers,
  effectsOn,
  toughnessOf,
  WeaponEffects,
} from './weapon-effects';
import { PLAIN_TRAITS } from './game-balance';

function effect(
  weapon: WeaponId,
  owner = 0,
  durationSec = 1,
  changes: Partial<ActiveEffect> = {}
): ActiveEffect {
  return {
    weapon,
    owner,
    x: 50,
    y: 40,
    radius: 10,
    remainingSec: durationSec,
    durationSec,
    ...changes,
  };
}

describe('WeaponEffects', () => {
  it('acts for as many steps as the effect lasts, then is gone', () => {
    const effects = new WeaponEffects();
    effects.add(effect('toxin-bomb', 0, 0.5));

    let steps = 0;
    while (effects.begin().length > 0 && steps < 100) {
      steps++;
      effects.end(TICK_SEC);
    }

    expect(steps).toBe(30);
    expect(effects.active).toEqual([]);
  });

  it('lets a strike act in one step, and shows it until the next one', () => {
    const effects = new WeaponEffects();
    effects.add(effect('phage-strike', 1, 0));

    const first = effects.begin();
    effects.end(TICK_SEC);

    expect(first).toEqual([
      expect.objectContaining({ weapon: 'phage-strike', fresh: true }),
    ]);
    expect(effects.active).toEqual([
      expect.objectContaining({ weapon: 'phage-strike', remainingSec: 0 }),
    ]);
    expect(effects.begin()).toEqual([]);
    expect(effects.active).toEqual([]);
  });

  it('counts the time left down, step by step', () => {
    const effects = new WeaponEffects();
    effects.add(effect('cryo-pulse', 0, 1));

    effects.begin();
    effects.end(0.25);

    expect(effects.active[0].remainingSec).toBe(0.75);
    expect(effects.begin()[0].fresh).toBe(false);
  });

  it('holds nothing - and hands out no list - in a plain match', () => {
    const effects = new WeaponEffects();

    expect(effects.begin()).toHaveLength(0);
    effects.add(effect('agar-bloom'));
    effects.clear();
    expect(effects.active).toEqual([]);
  });
});

describe('weapon circles', () => {
  it('cover the cells within their radius', () => {
    const bomb = effect('toxin-bomb');

    expect(covers(bomb, 50, 40)).toBe(true);
    expect(covers(bomb, 60, 40)).toBe(true);
    expect(covers(bomb, 58, 48)).toBe(false);
    expect(covers(bomb, 61, 40)).toBe(false);
  });

  it('hit the enemies with the hostile weapons, the owner with the others', () => {
    const live = [
      { ...effect('toxin-bomb', 0), fresh: false },
      { ...effect('agar-bloom', 0), fresh: false },
      { ...effect('phage-strike', 1, 0), fresh: false },
    ];

    expect(effectsOn(live, 'toxin-bomb', 0)).toEqual([]);
    expect(effectsOn(live, 'toxin-bomb', 1)).toHaveLength(1);
    // A neutral colony is everybody's enemy.
    expect(effectsOn(live, 'toxin-bomb', 2)).toHaveLength(1);
    expect(effectsOn(live, 'agar-bloom', 0)).toHaveLength(1);
    expect(effectsOn(live, 'agar-bloom', 1)).toEqual([]);
    // A strike past its first step strikes no more.
    expect(effectsOn(live, 'phage-strike', 0)).toEqual([]);
  });

  it('shield their owner, on top of its membrane', () => {
    const shield = [{ ...effect('biofilm-shield', 1), fresh: true }];
    const membrane = { ...PLAIN_TRAITS, toughnessFactor: 0.8 };

    expect(toughnessOf(membrane, [], 1)).toBe(0.8);
    expect(toughnessOf(membrane, shield, 1)).toBeCloseTo(
      0.8 * WEAPON_EFFECTS.shieldToughnessFactor
    );
    expect(toughnessOf(PLAIN_TRAITS, shield, 0)).toBe(1);
  });
});
