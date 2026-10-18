import { addMedal, bestMedal, EMPTY_PROGRESS, parseProgress } from './progress';

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
