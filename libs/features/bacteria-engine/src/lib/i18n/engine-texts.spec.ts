import { ACHIEVEMENT_IDS } from '../state/achievement-ids';
import { achievementTexts } from '../state/achievements';
import { colonyColorText, COLONY_COLORS } from '../state/colony-colors';
import {
  getLevel,
  LEVELS,
  levelDescriptionText,
  levelNameText,
} from '../state/levels';
import { MEDAL_TIERS, medalText } from '../state/medallions';
import { MISSIONS } from '../state/training';
import { ENGINE_EN } from './engine-texts';
import { english, GameText } from './game-text';
import { lookUp } from './translation';

/** Every key of a text and of its nested texts has an English entry. */
function expectRendered(text: GameText): void {
  expect(lookUp(ENGINE_EN, text.key)).toBeDefined();
  for (const value of Object.values(text.params ?? {})) {
    if (typeof value === 'object') {
      expectRendered(value);
    }
  }
  expect(english(text)).not.toMatch(/\{\w+\}/);
}

describe('ENGINE_EN', () => {
  it('renders every achievement', () => {
    for (const id of ACHIEVEMENT_IDS) {
      const { name, condition } = achievementTexts(id);
      expectRendered(name);
      expectRendered(condition);
    }
  });

  it('renders every level of the ladder and of the training', () => {
    const missionLevels = MISSIONS.map(({ levelId }) => getLevel(levelId));
    for (const level of [...LEVELS, ...missionLevels]) {
      expectRendered(levelNameText(level));
      expectRendered(levelDescriptionText(level));
    }
  });

  it('renders every medallion and colony colour', () => {
    for (const tier of MEDAL_TIERS) {
      expectRendered(medalText(tier));
    }
    for (const { id } of COLONY_COLORS) {
      expectRendered(colonyColorText(id));
    }
  });
});
