import { levelWon, lockedReason } from './campaign';
import { levelTitle, LEVELS } from './levels';
import { addMedal, EMPTY_PROGRESS } from './progress';

describe('campaign ladder', () => {
  const [first, second, third] = LEVELS;

  it('opens the first level from the start', () => {
    expect(lockedReason(EMPTY_PROGRESS, first.id)).toBeNull();
  });

  it('locks every other level until the one before it is won', () => {
    expect(lockedReason(EMPTY_PROGRESS, second.id)).toBe(
      `Win ${levelTitle(first)} to unlock`
    );
    expect(lockedReason(EMPTY_PROGRESS, LEVELS[LEVELS.length - 1].id)).toBe(
      `Win ${levelTitle(LEVELS[LEVELS.length - 2])} to unlock`
    );
  });

  it('opens the next level after a win at any difficulty', () => {
    const progress = addMedal(EMPTY_PROGRESS, first.id, 'easy', 'bronze');

    expect(levelWon(progress, first.id)).toBe(true);
    expect(lockedReason(progress, second.id)).toBeNull();
    expect(lockedReason(progress, third.id)).toBe(
      `Win ${levelTitle(second)} to unlock`
    );
  });

  it('opens a level whose predecessor was won, whatever came before', () => {
    const progress = addMedal(EMPTY_PROGRESS, second.id, 'hard', 'gold');

    expect(lockedReason(progress, second.id)).toBe(
      `Win ${levelTitle(first)} to unlock`
    );
    expect(lockedReason(progress, third.id)).toBeNull();
  });

  it('does not lock a level it does not know', () => {
    expect(lockedReason(EMPTY_PROGRESS, 'moon')).toBeNull();
    expect(levelWon(EMPTY_PROGRESS, 'moon')).toBe(false);
  });
});
