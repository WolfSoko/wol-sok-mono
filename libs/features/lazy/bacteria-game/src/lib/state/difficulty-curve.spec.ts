import { BOT_DIFFICULTIES, BOT_PROFILES, BotProfile } from './bot-controller';
import { CHAPTERS } from './chapters';
import {
  computerProfile,
  ladderPosition,
  profileAt,
  SKILL,
  skillOf,
  TARGET_CURVE,
  targetWinRate,
} from './difficulty-curve';
import { generatedLevelId } from './level-generator/generate-level';
import { LEVELS } from './levels';

/** True when `a` plays no better than `b` on every value. */
function noStronger(a: BotProfile, b: BotProfile): boolean {
  return (
    a.reactionSec >= b.reactionSec &&
    a.attackRatio >= b.attackRatio &&
    a.aimNoise >= b.aimNoise &&
    a.boostRange <= b.boostRange &&
    a.weaponPatience >= b.weaponPatience
  );
}

describe('the difficulty curve', () => {
  it('has a target and a skill for every level of the ladder, and no other', () => {
    const ids = LEVELS.map(({ id }) => id).sort();

    expect(Object.keys(TARGET_CURVE).sort()).toEqual(ids);
    expect(Object.keys(SKILL).sort()).toEqual(ids);
  });

  it('falls from about 85 % on the first level to about 45 % on the finale', () => {
    expect(targetWinRate(LEVELS[0].id, 'normal')).toBeCloseTo(0.85);
    expect(targetWinRate(LEVELS[LEVELS.length - 1].id, 'normal')).toBeCloseTo(
      0.45
    );
  });

  it('gets harder within each chapter', () => {
    for (const chapter of CHAPTERS) {
      const targets = chapter.levelIds.map((id) => TARGET_CURVE[id]);
      expect([...targets].sort((a, b) => b - a)).toEqual(targets);
    }
  });

  it('puts easy above normal and hard below it', () => {
    for (const { id } of LEVELS) {
      expect(targetWinRate(id, 'easy')).toBeCloseTo(
        Math.min(0.98, targetWinRate(id, 'normal') + 0.1)
      );
      expect(targetWinRate(id, 'hard')).toBeCloseTo(
        targetWinRate(id, 'normal') - 0.15
      );
    }
  });

  it('keeps the skill inside the band', () => {
    for (const values of Object.values(SKILL)) {
      for (const skill of values) {
        expect(skill).toBeGreaterThanOrEqual(0);
        expect(skill).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the difficulties apart on every level', () => {
    for (const { id } of LEVELS) {
      const [easy, normal, hard] = BOT_DIFFICULTIES.map(({ id: difficulty }) =>
        computerProfile(id, difficulty)
      );
      expect(noStronger(easy, normal)).toBe(true);
      expect(noStronger(normal, hard)).toBe(true);
    }
  });

  it('lets each difficulty grow stronger along its band', () => {
    for (const { id: difficulty } of BOT_DIFFICULTIES) {
      expect(
        noStronger(profileAt(difficulty, 0), profileAt(difficulty, 1))
      ).toBe(true);
      expect(
        noStronger(profileAt(difficulty, 0.5), profileAt(difficulty, 0.4))
      ).toBe(false);
    }
  });

  it('brackets the fixed profiles of the difficulties with its bands', () => {
    for (const { id: difficulty } of BOT_DIFFICULTIES) {
      const fixed = BOT_PROFILES[difficulty];
      expect(noStronger(profileAt(difficulty, 0), fixed)).toBe(true);
      expect(noStronger(fixed, profileAt(difficulty, 1))).toBe(true);
    }
  });

  it('never lets the easy computer boost on the first level, nor the hard one shy away', () => {
    expect(computerProfile('petri-dish', 'easy').usesBoost).toBe(false);
    expect(computerProfile('petri-dish', 'hard').chargesNearest).toBe(true);
    expect(computerProfile('petri-dish', 'normal').chargesNearest).toBe(false);
  });

  it('places a generated level on the ladder by its heat', () => {
    const calm = generatedLevelId({ recipe: 'field', seed: 1, difficulty: 1 });
    const hot = generatedLevelId({ recipe: 'field', seed: 1, difficulty: 10 });

    expect(ladderPosition(calm)).toBe(0);
    expect(ladderPosition(hot)).toBe(1);
    expect(skillOf(calm, 'normal')).toBe(SKILL[LEVELS[0].id][1]);
    expect(skillOf(hot, 'normal')).toBe(SKILL[LEVELS[LEVELS.length - 1].id][1]);
    expect(ladderPosition('nowhere')).toBeNull();
  });
});
