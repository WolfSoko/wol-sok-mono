import { TestBed } from '@angular/core/testing';
import { PROGRESS_STORAGE_KEY, ProgressService } from './progress.service';
import { getLevel } from './state/levels';
import { MatchRecord } from './state/medallions';

const LIMITS = getLevel('hourglass').medal;

const WIN: MatchRecord = {
  levelId: 'hourglass',
  difficulty: 'hard',
  won: true,
  durationSec: LIMITS.goldSec,
  boostsFired: 1,
  lost: 0,
  peakCount: 1000,
  lowestSizeRatio: 1,
};

describe('ProgressService', () => {
  beforeEach(() => localStorage.clear());

  function create(): ProgressService {
    return TestBed.inject(ProgressService);
  }

  it('awards a medallion and remembers it across visits', () => {
    const award = create().recordMatch(WIN);
    expect(award).toEqual({
      record: WIN,
      medal: 'gold',
      isNewBest: true,
      hint: 'Platinum needs a gold win without a boost.',
    });

    TestBed.resetTestingModule();
    expect(create().medal('hourglass', 'hard')).toBe('gold');
    expect(
      JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}')
    ).toEqual({
      levels: {
        hourglass: {
          hard: { medal: 'gold', wins: 1, bestWinSec: LIMITS.goldSec },
        },
      },
    });
  });

  it('keeps the better medallion and says the worse one is no new best', () => {
    const progress = create();
    progress.recordMatch(WIN);
    const award = progress.recordMatch({
      ...WIN,
      durationSec: LIMITS.silverSec + 1,
    });

    expect(award.medal).toBe('bronze');
    expect(award.isNewBest).toBe(false);
    expect(progress.medal('hourglass', 'hard')).toBe('gold');
    expect(progress.lastAward()).toBe(award);
  });

  it('forgets the last award once the next match starts', () => {
    const progress = create();
    progress.recordMatch(WIN);
    progress.clearAward();
    expect(progress.lastAward()).toBeNull();
  });

  it('starts empty from unreadable storage', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{not json');
    expect(create().medal('hourglass', 'hard')).toBeNull();
  });
});
