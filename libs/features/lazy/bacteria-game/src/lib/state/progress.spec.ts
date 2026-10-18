import { MatchRecord } from './medallions';
import {
  applyMatch,
  EMPTY_PROGRESS,
  levelRecord,
  parseProgress,
} from './progress';

const WIN: MatchRecord = {
  levelId: 'corridors',
  difficulty: 'normal',
  won: true,
  durationSec: 50,
  boostsFired: 1,
  lost: 100,
  peakCount: 800,
  lowestSizeRatio: 0.7,
};

describe('applyMatch', () => {
  it('records a first win', () => {
    const progress = applyMatch(EMPTY_PROGRESS, WIN, 'silver');
    expect(levelRecord(progress, 'corridors', 'normal')).toEqual({
      medal: 'silver',
      wins: 1,
      bestWinSec: 50,
    });
    expect(levelRecord(progress, 'corridors', 'hard')).toBeNull();
  });

  it('keeps the best medallion and the best time apart', () => {
    let progress = applyMatch(EMPTY_PROGRESS, WIN, 'gold');
    progress = applyMatch(progress, { ...WIN, durationSec: 44 }, 'bronze');
    expect(levelRecord(progress, 'corridors', 'normal')).toEqual({
      medal: 'gold',
      wins: 2,
      bestWinSec: 44,
    });
  });

  it('leaves the progress as it was after a loss', () => {
    expect(applyMatch(EMPTY_PROGRESS, { ...WIN, won: false }, null)).toBe(
      EMPTY_PROGRESS
    );
  });

  it('keeps the other difficulties of a level', () => {
    let progress = applyMatch(EMPTY_PROGRESS, WIN, 'bronze');
    progress = applyMatch(progress, { ...WIN, difficulty: 'hard' }, 'gold');
    expect(levelRecord(progress, 'corridors', 'normal')?.medal).toBe('bronze');
    expect(levelRecord(progress, 'corridors', 'hard')?.medal).toBe('gold');
  });
});

describe('parseProgress', () => {
  it('reads what applyMatch wrote', () => {
    const progress = applyMatch(EMPTY_PROGRESS, WIN, 'gold');
    expect(parseProgress(JSON.parse(JSON.stringify(progress)))).toEqual(
      progress
    );
  });

  it('drops what it cannot read and keeps the rest', () => {
    expect(
      parseProgress({
        levels: {
          corridors: {
            normal: { medal: 'gold', wins: 3, bestWinSec: 41 },
            hard: { medal: 'gold' },
            easy: { medal: 'gold', wins: 1.5, bestWinSec: 40 },
            nightmare: { medal: 'gold', wins: 1, bestWinSec: 1 },
          },
          hourglass: {
            easy: { medal: 'tin', wins: 1, bestWinSec: 70 },
            normal: { medal: 'gold', wins: 0, bestWinSec: 30 },
            hard: { medal: 'gold', wins: 2, bestWinSec: -1 },
          },
          broken: 'yes',
        },
      })
    ).toEqual({
      levels: {
        corridors: { normal: { medal: 'gold', wins: 3, bestWinSec: 41 } },
        hourglass: { easy: { medal: null, wins: 1, bestWinSec: 70 } },
      },
    });
  });

  it('starts over from anything that is not progress', () => {
    expect(parseProgress(null)).toBe(EMPTY_PROGRESS);
    expect(parseProgress('gold')).toBe(EMPTY_PROGRESS);
    expect(parseProgress({ levels: 3 })).toBe(EMPTY_PROGRESS);
  });
});
