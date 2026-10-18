import { TestBed } from '@angular/core/testing';
import { PROGRESS_STORAGE_KEY, ProgressService } from './progress.service';
import { getLevel } from './state/levels';
import { MatchRecord } from './state/medallions';

const LIMITS = getLevel('hourglass').medal;

/** A gold win: in time and clean, but with a boost. */
const GOLD_WIN: MatchRecord = {
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
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  function create(): ProgressService {
    return TestBed.inject(ProgressService);
  }

  it('awards a medallion and remembers it across visits', () => {
    expect(create().recordMatch(GOLD_WIN)).toEqual({
      record: GOLD_WIN,
      medal: 'gold',
      previousBest: null,
      hint: 'Platinum needs a gold win without a boost.',
    });

    TestBed.resetTestingModule();
    expect(create().medal('hourglass', 'hard')).toBe('gold');
    expect(
      JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}')
    ).toEqual({ medals: { hourglass: { hard: 'gold' } } });
  });

  it('keeps the better medallion and names it in the next award', () => {
    const progress = create();
    progress.recordMatch(GOLD_WIN);
    const award = progress.recordMatch({
      ...GOLD_WIN,
      durationSec: LIMITS.silverSec + 1,
    });

    expect(award.medal).toBe('bronze');
    expect(award.previousBest).toBe('gold');
    expect(progress.medal('hourglass', 'hard')).toBe('gold');
  });

  it('keeps the levels and difficulties apart', () => {
    const progress = create();
    progress.recordMatch(GOLD_WIN);

    expect(progress.medal('hourglass', 'normal')).toBeNull();
    expect(progress.medal('corridors', 'hard')).toBeNull();
  });

  it('builds on medallions another tab stored meanwhile', () => {
    const progress = create();
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ medals: { corridors: { easy: 'silver' } } })
    );

    progress.recordMatch(GOLD_WIN);

    expect(progress.medal('corridors', 'easy')).toBe('silver');
    expect(progress.medal('hourglass', 'hard')).toBe('gold');
  });

  it('stores nothing for a match without a medallion', () => {
    create().recordMatch({ ...GOLD_WIN, won: false });

    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });

  it('starts empty from unreadable storage', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{not json');
    expect(create().medal('hourglass', 'hard')).toBeNull();
  });
});
