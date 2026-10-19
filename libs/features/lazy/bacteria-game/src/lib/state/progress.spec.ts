import {
  addMedal,
  addTotals,
  bestMedal,
  EMPTY_PROGRESS,
  medalTally,
  mergeProgress,
  NO_TOTALS,
  parseProgress,
  Progress,
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
  };
  const elsewhere: Progress = {
    medals: {
      corridors: { normal: 'silver', hard: 'platinum' },
      villi: { easy: 'bronze' },
    },
    totals: { ...NO_TOTALS, matches: 9, wins: 4, couchMatches: 2 },
    achievements: { blitz: '2026-10-03', siege: '2026-10-04' },
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

describe('parseProgress', () => {
  it('reads what it wrote', () => {
    const progress: Progress = {
      medals: { corridors: { easy: 'gold' } },
      totals: { ...NO_TOTALS, matches: 3, wins: 2 },
      achievements: { pacifist: '2026-10-19' },
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
        achievements: { blitz: '2026-10-19', moonwalk: '2026-10-19', siege: 7 },
      })
    ).toEqual({
      medals: { corridors: { normal: 'gold' } },
      totals: { ...NO_TOTALS, matches: 4, couchMatches: 3 },
      achievements: { blitz: '2026-10-19' },
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
