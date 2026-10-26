import {
  BOSS_LOOK,
  computerLook,
  matchLooks,
  NEUTRAL_LOOK,
  seatLooks,
} from './colony-looks';
import { generatedLevelId } from './level-generator/generate-level';
import { LEVELS } from './levels';
import { createPlayer } from './player.model';
import { BACTERIA_LOOKS, PREMIUM_SKINS, SKINS } from './skins';
import { BOSS_SEAT } from './win-conditions';

describe('computerLook', () => {
  it('wears the plain slime on the first level and the dearest skin on the last', () => {
    expect(computerLook(LEVELS[0].id)).toBe('slime');
    expect(computerLook(LEVELS[LEVELS.length - 1].id)).toBe(
      PREMIUM_SKINS[PREMIUM_SKINS.length - 1].id
    );
  });

  it('climbs the gallery in the order of the prices along the ladder', () => {
    const order = ['slime', ...PREMIUM_SKINS.map(({ id }) => id)];
    const worn = LEVELS.map(({ id }) => order.indexOf(computerLook(id)));

    expect(worn.every((index) => index >= 0)).toBe(true);
    for (let level = 1; level < worn.length; level++) {
      expect(worn[level]).toBeGreaterThanOrEqual(worn[level - 1]);
    }
    // Every skin to buy is shown off on some level, the pixels never.
    expect(new Set(worn).size).toBe(order.length);
  });

  it('dresses a generated level by its heat', () => {
    const calm = generatedLevelId({ recipe: 'cave', seed: 7, difficulty: 1 });
    const frantic = generatedLevelId({
      recipe: 'cave',
      seed: 7,
      difficulty: 10,
    });

    expect(computerLook(calm)).toBe('slime');
    expect(computerLook(frantic)).toBe(
      PREMIUM_SKINS[PREMIUM_SKINS.length - 1].id
    );
  });

  it('stays plain on a level that is not on the ladder', () => {
    expect(computerLook('no-such-level')).toBe('slime');
  });
});

describe('matchLooks', () => {
  const bossLevel = LEVELS.find(({ boss }) => boss !== undefined)?.id ?? '';
  const plainLevel = LEVELS.find(({ boss }) => boss === undefined)?.id ?? '';

  it('arms the boss on its level, but not in a ghost race', () => {
    expect(matchLooks(bossLevel, 'chrome').boss).toBe(true);
    expect(matchLooks(bossLevel, 'chrome', true).boss).toBe(false);
    expect(matchLooks(plainLevel, 'chrome').boss).toBe(false);
    expect(matchLooks('no-such-level', 'chrome').boss).toBe(false);
  });

  it('keeps the skin and the level’s look for the computer', () => {
    expect(matchLooks(plainLevel, 'neon')).toEqual({
      skin: 'neon',
      computer: computerLook(plainLevel),
      boss: false,
    });
  });
});

describe('seatLooks', () => {
  const human = createPlayer({ id: 0, isBot: false });
  const computer = createPlayer({ id: BOSS_SEAT, isBot: true });

  it('dresses the humans in the skin and the computer in its level’s look', () => {
    expect(
      seatLooks([human, computer], {
        skin: 'ink',
        computer: 'lava',
        boss: false,
      })
    ).toEqual(['ink', 'lava']);
    expect(
      seatLooks([human, createPlayer({ id: 1, isBot: false })], {
        skin: 'ink',
        computer: 'lava',
        boss: false,
      })
    ).toEqual(['ink', 'ink']);
  });

  it('dresses the boss in its own look, in its seat only', () => {
    const standIn = createPlayer({ id: 0, isBot: true });
    const looks = { skin: 'ink', computer: 'lava', boss: true } as const;

    expect(seatLooks([human, computer], looks)).toEqual(['ink', BOSS_LOOK]);
    expect(seatLooks([standIn, computer], looks)).toEqual(['lava', BOSS_LOOK]);
  });
});

describe('the boss look', () => {
  it('is no skin: never shown, bought or picked', () => {
    expect(SKINS.some(({ id }) => id === (BOSS_LOOK as string))).toBe(false);
    expect(BACTERIA_LOOKS).not.toContain(BOSS_LOOK);
  });

  it('leaves the neutral colonies plain', () => {
    expect(NEUTRAL_LOOK).toBe('slime');
  });
});
