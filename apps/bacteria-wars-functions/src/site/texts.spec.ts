import {
  COLONY_COLORS,
  isLadderLevel,
  LEVELS,
} from '@wolsok/feat-lazy-bac-game/engine';
import { COLOR_IDS, DE_TITLES, levelName } from './texts';

describe('the pages’ dictionary', () => {
  it('names every ladder level in German, and every colour', () => {
    const ladder = LEVELS.map(({ id }) => id).filter(isLadderLevel);
    expect(Object.keys(DE_TITLES).sort()).toEqual([...ladder].sort());
    expect([...COLOR_IDS].sort()).toEqual(
      COLONY_COLORS.map(({ id }) => id).sort()
    );
  });

  it('names a generated level by its kind, recipe and difficulty', () => {
    expect(levelName('de', 'quarantine', 'computer')).toBe('Quarantäne');
    expect(levelName('en', 'quarantine', 'computer')).toBe('Quarantine');
    expect(levelName('en', 'gen:cave:42:6', 'daily')).toBe(
      'Daily level · cave 6'
    );
  });
});
