import {
  addCouchWin,
  addMedal,
  addTotals,
  bestMedal,
  EMPTY_PROGRESS,
  medalTally,
  mergeProgress,
  NO_TOTALS,
  parseProgress,
  Progress,
  totalsOf,
  addDailyAttempt,
} from './progress';

describe('addMedal', () => {
  it('records a first medallion', () => {
    const progress = addMedal(EMPTY_PROGRESS, 'corridors', 'normal', 'silver');

    expect(bestMedal(progress, 'corridors', 'normal')).toBe('silver');
    expect(bestMedal(progress, 'corridors', 'hard')).toBeNull();
    expect(bestMedal(progress, 'hourglass', 'normal')).toBeNull();
  });

  it('keeps the better medallion, whichever came first', () => {
    let progress = addMedal(EMPTY_PROGRESS, 'corridors', 'normal', 'gold');
    progress = addMedal(progress, 'corridors', 'normal', 'bronze');
    expect(bestMedal(progress, 'corridors', 'normal')).toBe('gold');

    progress = addMedal(progress, 'corridors', 'normal', 'platinum');
    expect(bestMedal(progress, 'corridors', 'normal')).toBe('platinum');
  });

  it('is the progress given when the medallion is no better', () => {
    const progress = addMedal(EMPTY_PROGRESS, 'corridors', 'normal', 'gold');

    expect(addMedal(progress, 'corridors', 'normal', 'silver')).toBe(progress);
    expect(addMedal(progress, 'corridors', 'normal', 'gold')).toBe(progress);
  });

  it('keeps the other difficulties of a level', () => {
    let progress = addMedal(EMPTY_PROGRESS, 'corridors', 'normal', 'bronze');
    progress = addMedal(progress, 'corridors', 'hard', 'gold');

    expect(bestMedal(progress, 'corridors', 'normal')).toBe('bronze');
    expect(bestMedal(progress, 'corridors', 'hard')).toBe('gold');
  });
});

/** Progress holding only these medallions. */
function withMedals(medals: Progress['medals']): Progress {
  return { ...EMPTY_PROGRESS, medals };
}

describe('mergeProgress', () => {
  const here: Progress = {
    medals: { corridors: { normal: 'gold', hard: 'bronze' } },
    totals: { ...NO_TOTALS, matches: 7, wins: 5 },
    achievements: { 'first-blood': '2026-10-01', blitz: '2026-10-09' },
    couchWins: { orange: 4, blue: 2 },
    daily: { day: '2026-10-19', attempts: 2, streak: 4 },
    endlessBest: 6,
  };
  const elsewhere: Progress = {
    medals: {
      corridors: { normal: 'silver', hard: 'platinum' },
      villi: { easy: 'bronze' },
    },
    totals: { ...NO_TOTALS, matches: 9, wins: 4, couchMatches: 2 },
    achievements: { blitz: '2026-10-03', siege: '2026-10-04' },
    couchWins: { orange: 3, green: 1 },
    daily: { day: '2026-10-19', attempts: 3, streak: 4 },
    endlessBest: 4,
  };

  it('keeps the better medallion, the higher total and the earlier day', () => {
    expect(mergeProgress(here, elsewhere)).toEqual({
      medals: {
        corridors: { normal: 'gold', hard: 'platinum' },
        villi: { easy: 'bronze' },
      },
      totals: { ...NO_TOTALS, matches: 9, wins: 5, couchMatches: 2 },
      achievements: {
        'first-blood': '2026-10-01',
        blitz: '2026-10-03',
        siege: '2026-10-04',
      },
      couchWins: { orange: 4, blue: 2, green: 1 },
      // The daily record of the same day: the one with more attempts.
      daily: { day: '2026-10-19', attempts: 3, streak: 4 },
      endlessBest: 6,
    });
  });

  it('comes to the same, whichever way round it merges', () => {
    expect(mergeProgress(elsewhere, here)).toEqual(
      mergeProgress(here, elsewhere)
    );
  });

  it('is the progress given when the other adds nothing', () => {
    expect(mergeProgress(here, EMPTY_PROGRESS)).toBe(here);
    expect(mergeProgress(here, here)).toBe(here);
    expect(mergeProgress(EMPTY_PROGRESS, here)).toEqual(here);
  });
});

describe('addDailyAttempt', () => {
  it('counts an attempt at the daily level of a day, with the streak', () => {
    const progress = addDailyAttempt(
      addDailyAttempt(EMPTY_PROGRESS, '2026-10-20'),
      '2026-10-21'
    );

    expect(progress.daily).toEqual({
      day: '2026-10-21',
      attempts: 1,
      streak: 2,
    });
  });

  it('keeps the later day when merging', () => {
    const today = addDailyAttempt(EMPTY_PROGRESS, '2026-10-21');
    const yesterday = addDailyAttempt(
      addDailyAttempt(EMPTY_PROGRESS, '2026-10-20'),
      '2026-10-20'
    );

    expect(mergeProgress(yesterday, today).daily).toEqual(today.daily);
    expect(mergeProgress(today, yesterday).daily).toEqual(today.daily);
  });
});

describe('addCouchWin', () => {
  it('counts a win between two players for the winning colour', () => {
    const progress = addCouchWin(
      addCouchWin(EMPTY_PROGRESS, 'orange'),
      'orange'
    );

    expect(addCouchWin(progress, 'blue').couchWins).toEqual({
      orange: 2,
      blue: 1,
    });
  });
});

describe('addTotals', () => {
  it('adds a match to the lifetime totals', () => {
    const progress = addTotals(EMPTY_PROGRESS, { matches: 1, captured: 40 });

    expect(addTotals(progress, { matches: 1, wins: 1 }).totals).toEqual({
      ...NO_TOTALS,
      matches: 2,
      wins: 1,
      captured: 40,
    });
  });
});

describe('totalsOf', () => {
  it('counts a match against the computer', () => {
    expect(
      totalsOf({
        levelId: 'villi',
        difficulty: 'hard',
        won: true,
        durationSec: 60,
        boostsFired: 1,
        lost: 10,
        peakCount: 100,
        lowestSizeRatio: 1,
        captured: 70,
        enemyCrushed: 12,
        peakShare: 0.3,
        pellets: 9,
      })
    ).toEqual({
      matches: 1,
      wins: 1,
      captured: 70,
      enemyCrushed: 12,
      pellets: 9,
    });
  });
});

describe('parseProgress', () => {
  it('reads what it wrote', () => {
    const progress: Progress = {
      medals: { corridors: { easy: 'gold' } },
      totals: { ...NO_TOTALS, matches: 3, wins: 2 },
      achievements: { pacifist: '2026-10-19' },
      couchWins: { purple: 7 },
      daily: { day: '2026-10-20', attempts: 2, streak: 6 },
      endlessBest: 11,
    };
    expect(parseProgress(JSON.parse(JSON.stringify(progress)))).toEqual(
      progress
    );
  });

  it('reads progress stored before totals and achievements', () => {
    expect(parseProgress({ medals: { villi: { hard: 'silver' } } })).toEqual(
      withMedals({ villi: { hard: 'silver' } })
    );
  });

  it('drops what it cannot read and keeps the rest', () => {
    expect(
      parseProgress({
        medals: {
          corridors: { normal: 'gold', hard: 'tin', nightmare: 'gold' },
          hourglass: { easy: 3 },
          broken: 'yes',
        },
        totals: { matches: 4.7, wins: -2, captured: 'lots', couchMatches: 3 },
        achievements: {
          blitz: '2026-10-19',
          moonwalk: '2026-10-19',
          siege: 7,
          pacifist: 'oops',
          comeback: '',
        },
        couchWins: { red: 2.5, mauve: 4, blue: -1 },
        daily: { day: 'yesterday', attempts: 2, streak: 1 },
        endlessBest: -3,
      })
    ).toEqual({
      medals: { corridors: { normal: 'gold' } },
      totals: { ...NO_TOTALS, matches: 4, couchMatches: 3 },
      achievements: { blitz: '2026-10-19' },
      couchWins: { red: 2 },
      daily: null,
      endlessBest: 0,
    });
  });

  it('starts over from anything that is not progress', () => {
    expect(parseProgress(null)).toBe(EMPTY_PROGRESS);
    expect(parseProgress('gold')).toBe(EMPTY_PROGRESS);
    expect(parseProgress({ medals: 3 })).toEqual(EMPTY_PROGRESS);
  });
});

describe('medalTally', () => {
  it("counts the medallions of the game's levels per tier", () => {
    expect(
      medalTally({
        corridors: { easy: 'gold', hard: 'gold' },
        villi: { normal: 'bronze' },
        moon: { easy: 'platinum' },
      })
    ).toEqual({ bronze: 1, silver: 0, gold: 2, platinum: 0 });
  });
});
