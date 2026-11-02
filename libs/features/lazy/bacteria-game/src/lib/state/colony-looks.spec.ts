import { computerLook, NEUTRAL_LOOK, seatLooks } from './colony-looks';
import { generatedLevelId } from './level-generator/generate-level';
import { getLevel, LEVELS } from './levels';
import { MatchEngine } from './match-engine';
import { planMatch } from './match-setup';
import { createPlayer } from './player.model';
import { BOSS_LOOK, PREMIUM_SKINS, SKINS } from './skins';
import { recordedReplay } from '../../testing/recorded-replay';

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

describe('seatLooks', () => {
  const human = createPlayer({ id: 0 });
  const computer = createPlayer({ id: 1, isBot: true, computer: true });
  const boss = createPlayer({ id: 1, isBot: true, computer: true, boss: true });
  const recording = createPlayer({ id: 1, isBot: true });

  it('dresses the humans in the skin, the computer in its level’s look', () => {
    expect(seatLooks([human, computer], 'ink', 'lava')).toEqual([
      'ink',
      'lava',
    ]);
    expect(seatLooks([human, createPlayer({ id: 1 })], 'ink', 'lava')).toEqual([
      'ink',
      'ink',
    ]);
  });

  it('dresses a seat a recording drives for a human in the skin', () => {
    expect(seatLooks([human, recording], 'ink', 'lava')).toEqual([
      'ink',
      'ink',
    ]);
  });

  it('dresses the boss in its own look', () => {
    expect(seatLooks([human, boss], 'ink', 'lava')).toEqual(['ink', BOSS_LOOK]);
  });

  it('leaves the neutral colonies plain', () => {
    expect(NEUTRAL_LOOK).toBe('slime');
  });
});

describe('the seats a match plans', () => {
  const bossLevel = LEVELS.find(({ boss }) => boss !== undefined)?.id ?? '';
  const plainLevel = LEVELS.find(({ boss }) => boss === undefined)?.id ?? '';
  const plan = (levelId: string, mode: 'vs-computer' | 'two-players') => ({
    levelId,
    mode,
    difficulty: 'normal' as const,
    colors: ['orange', 'blue'] as [string, string],
    headStart: 0 as const,
    width: 120,
    height: 80,
    seed: 1,
  });
  const seats = (planned: ReturnType<typeof planMatch>) =>
    new MatchEngine(planned.spawns, planned.options).players.map(
      ({ computer, boss }) => ({ computer, boss })
    );

  it('marks the computer’s seat, and the boss on its level', () => {
    expect(seats(planMatch(plan(plainLevel, 'vs-computer')))).toEqual([
      { computer: false, boss: false },
      { computer: true, boss: false },
    ]);
    expect(seats(planMatch(plan(bossLevel, 'vs-computer')))).toEqual([
      { computer: false, boss: false },
      { computer: true, boss: true },
    ]);
  });

  it('marks no computer between two players - the boss, whoever steers it', () => {
    expect(seats(planMatch(plan(bossLevel, 'two-players')))).toEqual([
      { computer: false, boss: false },
      { computer: false, boss: true },
    ]);
  });

  it('marks neither against a ghost, which is no boss', () => {
    const ghost = recordedReplay(bossLevel, 10);
    expect(seats(planMatch(plan(bossLevel, 'vs-computer'), ghost))).toEqual([
      { computer: false, boss: false },
      { computer: false, boss: false },
    ]);
    expect(getLevel(bossLevel).boss).toBeDefined();
  });
});

describe('the boss look', () => {
  it('is no skin: never shown, bought or picked', () => {
    expect(SKINS.some(({ id }) => id === (BOSS_LOOK as string))).toBe(false);
  });
});
