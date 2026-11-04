import { ActiveEffect, WEAPON_EFFECTS, WeaponId, WEAPONS } from './evolution';
import { TICK_SEC } from './fixed-tick';
import {
  actsOn,
  covers,
  toughnessOf,
  WEAPON_CODE,
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
      expect.objectContaining({ weapon: 'phage-strike' }),
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
    expect(effects.begin()).toHaveLength(1);
  });

  it('runs down a copy, leaving the effect it was handed as it was', () => {
    const effects = new WeaponEffects();
    const bomb = effect('toxin-bomb', 0, 1);
    effects.add(bomb);

    const listed = effects.begin();
    effects.end(0.25);

    expect(bomb.remainingSec).toBe(1);
    expect(effects.active).toBe(listed);
    expect(effects.active[0].remainingSec).toBe(0.75);
  });

  it('holds nothing - and hands out no list - in a plain match', () => {
    const effects = new WeaponEffects();

    expect(effects.begin()).toHaveLength(0);
    effects.add(effect('agar-bloom'));
    effects.clear();
    expect(effects.active).toEqual([]);
  });
});

describe('the weapons', () => {
  it('are known to the shaders by their place in the list', () => {
    expect(WEAPONS.map(({ id }) => WEAPON_CODE[id])).toEqual([0, 1, 2, 3, 4]);
  });

  it('say whom they hit and how far they reach', () => {
    expect(
      WEAPONS.map(({ id, hostile, reach }) => [id, hostile, reach])
    ).toEqual([
      ['toxin-bomb', true, 'circle'],
      ['cryo-pulse', true, 'circle'],
      ['phage-strike', true, 'circle'],
      ['agar-bloom', false, 'circle'],
      ['biofilm-shield', false, 'colony'],
    ]);
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
    const bomb = effect('toxin-bomb', 0);
    const bloom = effect('agar-bloom', 0);
    const strike = effect('phage-strike', 1, 0);

    expect(actsOn(bomb, 0)).toBe(false);
    expect(actsOn(bomb, 1)).toBe(true);
    // A neutral colony is everybody's enemy.
    expect(actsOn(bomb, 2)).toBe(true);
    expect(actsOn(bloom, 0)).toBe(true);
    expect(actsOn(bloom, 1)).toBe(false);
    expect(actsOn(strike, 0)).toBe(true);
    expect(actsOn(strike, 1)).toBe(false);
  });

  it('shield their owner, on top of its membrane', () => {
    const shield = [effect('biofilm-shield', 1)];
    const membrane = { ...PLAIN_TRAITS, toughnessFactor: 0.8 };

    expect(toughnessOf(membrane, [], 1)).toBe(0.8);
    expect(toughnessOf(membrane, shield, 1)).toBeCloseTo(
      0.8 * WEAPON_EFFECTS.shieldToughnessFactor
    );
    expect(toughnessOf(PLAIN_TRAITS, shield, 0)).toBe(1);
  });
});
