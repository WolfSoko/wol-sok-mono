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

/** A rendered text still holding a key or a placeholder fell through. */
function expectRendered(text: GameText): void {
  const rendered = english(text);
  expect(rendered).not.toMatch(/^[a-z]+(\.[\w-]+)+$/i);
  expect(rendered).not.toMatch(/\{\w+\}/);
}

describe('ENGINE_EN', () => {
  it('holds exactly the areas the engine renders', () => {
    expect(Object.keys(ENGINE_EN).sort()).toEqual([
      'achievements',
      'game',
      'levels',
      'training',
    ]);
  });

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
