import { furthestOpenLevel, ladderLocks, levelWon } from './campaign';
import { levelTitle, LEVELS } from './levels';
import { addMedal, EMPTY_PROGRESS } from './progress';

describe('campaign ladder', () => {
  const [first, second, third] = LEVELS;

  it('opens only the first level from the start', () => {
    const locks = ladderLocks(EMPTY_PROGRESS);

    expect(first.id in locks).toBe(false);
    expect(Object.keys(locks)).toEqual(LEVELS.slice(1).map(({ id }) => id));
    expect(locks[second.id]).toBe(`Win ${levelTitle(first)} to unlock`);
  });

  it('opens the next level after a win at any difficulty', () => {
    const progress = addMedal(EMPTY_PROGRESS, first.id, 'easy', 'bronze');
    const locks = ladderLocks(progress);

    expect(levelWon(progress, first.id)).toBe(true);
    expect(second.id in locks).toBe(false);
    expect(locks[third.id]).toBe(`Win ${levelTitle(second)} to unlock`);
  });

  it('keeps a level open that was won before, and the one after it', () => {
    const locks = ladderLocks(
      addMedal(EMPTY_PROGRESS, second.id, 'hard', 'gold')
    );

    expect(second.id in locks).toBe(false);
    expect(third.id in locks).toBe(false);
    expect(LEVELS[3].id in locks).toBe(true);
  });

  it('finds the furthest open level', () => {
    expect(furthestOpenLevel(ladderLocks(EMPTY_PROGRESS))).toBe(first.id);
    expect(
      furthestOpenLevel(
        ladderLocks(addMedal(EMPTY_PROGRESS, second.id, 'easy', 'bronze'))
      )
    ).toBe(third.id);
    expect(furthestOpenLevel({})).toBe(LEVELS[LEVELS.length - 1].id);
  });

  it('knows nothing won of a level it does not know', () => {
    expect(levelWon(EMPTY_PROGRESS, 'moon')).toBe(false);
  });
});
