import {
  addMedal,
  bestMedal,
  EMPTY_PROGRESS,
  mergeProgress,
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

  it('keeps the other difficulties of a level', () => {
    let progress = addMedal(EMPTY_PROGRESS, 'corridors', 'normal', 'bronze');
    progress = addMedal(progress, 'corridors', 'hard', 'gold');

    expect(bestMedal(progress, 'corridors', 'normal')).toBe('bronze');
    expect(bestMedal(progress, 'corridors', 'hard')).toBe('gold');
  });
});

describe('mergeProgress', () => {
  const here: Progress = {
    medals: { corridors: { normal: 'gold', hard: 'bronze' } },
  };
  const elsewhere: Progress = {
    medals: {
      corridors: { normal: 'silver', hard: 'platinum' },
      villi: { easy: 'bronze' },
    },
  };

  it('keeps the better medallion of either, per level and difficulty', () => {
    expect(mergeProgress(here, elsewhere)).toEqual({
      medals: {
        corridors: { normal: 'gold', hard: 'platinum' },
        villi: { easy: 'bronze' },
      },
    });
  });

  it('comes to the same, whichever way round it merges', () => {
    expect(mergeProgress(elsewhere, here)).toEqual(
      mergeProgress(here, elsewhere)
    );
  });

  it('changes nothing when merging empty progress', () => {
    expect(mergeProgress(here, EMPTY_PROGRESS)).toEqual(here);
    expect(mergeProgress(EMPTY_PROGRESS, here)).toEqual(here);
  });
});

describe('parseProgress', () => {
  it('reads what addMedal wrote', () => {
    const progress = addMedal(EMPTY_PROGRESS, 'corridors', 'easy', 'gold');
    expect(parseProgress(JSON.parse(JSON.stringify(progress)))).toEqual(
      progress
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
      })
    ).toEqual({ medals: { corridors: { normal: 'gold' } } });
  });

  it('starts over from anything that is not progress', () => {
    expect(parseProgress(null)).toBe(EMPTY_PROGRESS);
    expect(parseProgress('gold')).toBe(EMPTY_PROGRESS);
    expect(parseProgress({ medals: 3 })).toBe(EMPTY_PROGRESS);
  });
});
