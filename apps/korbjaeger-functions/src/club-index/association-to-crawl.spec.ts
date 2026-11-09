import { associationToCrawl } from './association-to-crawl';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const NOW = 100 * DAY;
const BAYERN = { id: 2, name: 'Bayern' };
const BERLIN = { id: 3, name: 'Berlin' };
const HESSEN = { id: 6, name: 'Hessen' };

function list(association: { id: number; name: string }, updatedAt: number) {
  return { association, clubs: [], updatedAt };
}

describe('associationToCrawl', () => {
  it('takes the first Association the index has no list of', () => {
    expect(
      associationToCrawl(
        [BAYERN, BERLIN, HESSEN],
        [list(BAYERN, NOW)],
        NOW,
        WEEK
      )
    ).toEqual(BERLIN);
  });

  it('takes the oldest list once it is a week old', () => {
    const stored = [
      list(BAYERN, NOW - WEEK - 1),
      list(BERLIN, NOW - WEEK - 2 * DAY),
      list(HESSEN, NOW - DAY),
    ];

    expect(
      associationToCrawl([BAYERN, BERLIN, HESSEN], stored, NOW, WEEK)
    ).toEqual(BERLIN);
  });

  it('takes none while every list is younger than a week', () => {
    const stored = [list(BAYERN, NOW - WEEK + 1), list(BERLIN, NOW)];

    expect(
      associationToCrawl([BAYERN, BERLIN], stored, NOW, WEEK)
    ).toBeUndefined();
  });

  it('ignores lists of Associations the DBB no longer offers', () => {
    const stored = [list(HESSEN, 0), list(BAYERN, NOW)];

    expect(associationToCrawl([BAYERN], stored, NOW, WEEK)).toBeUndefined();
  });

  it('takes none without Associations', () => {
    expect(associationToCrawl([], [], NOW, WEEK)).toBeUndefined();
  });
});
