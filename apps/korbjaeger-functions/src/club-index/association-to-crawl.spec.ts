import { associationToCrawl, type CrawlSchedule } from './association-to-crawl';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const NOW = 100 * DAY;
const SCHEDULE: CrawlSchedule = { now: NOW, maxAgeMs: WEEK, retryAfterMs: DAY };
const BAYERN = { id: 2, name: 'Bayern' };
const BERLIN = { id: 3, name: 'Berlin' };
const HESSEN = { id: 6, name: 'Hessen' };
const NO_ATTEMPTS = new Map<number, number>();

function list(association: { id: number; name: string }, updatedAt: number) {
  return { association, clubs: [], updatedAt };
}

describe('associationToCrawl', () => {
  it('takes the first Association the index has no list of', () => {
    expect(
      associationToCrawl(
        [BAYERN, BERLIN, HESSEN],
        [list(BAYERN, NOW)],
        NO_ATTEMPTS,
        SCHEDULE
      )
    ).toEqual(BERLIN);
  });

  it('takes the oldest list once it is a week old', () => {
    const lists = [
      list(BAYERN, NOW - WEEK - 1),
      list(BERLIN, NOW - WEEK - 2 * DAY),
      list(HESSEN, NOW - DAY),
    ];

    expect(
      associationToCrawl([BAYERN, BERLIN, HESSEN], lists, NO_ATTEMPTS, SCHEDULE)
    ).toEqual(BERLIN);
  });

  it('takes none while every list is younger than a week', () => {
    const lists = [list(BAYERN, NOW - WEEK + 1), list(BERLIN, NOW)];

    expect(
      associationToCrawl([BAYERN, BERLIN], lists, NO_ATTEMPTS, SCHEDULE)
    ).toBeUndefined();
  });

  it('passes over an Association whose crawl left no list, for a day', () => {
    const attempts = new Map([[BERLIN.id, NOW - HOUR]]);

    expect(
      associationToCrawl([BERLIN, HESSEN], [], attempts, SCHEDULE)
    ).toEqual(HESSEN);
    expect(
      associationToCrawl([BERLIN], [], attempts, SCHEDULE)
    ).toBeUndefined();
    expect(
      associationToCrawl([BERLIN], [], attempts, {
        ...SCHEDULE,
        now: NOW + DAY,
      })
    ).toEqual(BERLIN);
  });

  it('passes over a stale list whose new crawl failed, for a day', () => {
    const lists = [list(BAYERN, NOW - 2 * WEEK), list(BERLIN, NOW - WEEK)];
    const attempts = new Map([[BAYERN.id, NOW - HOUR]]);

    expect(
      associationToCrawl([BAYERN, BERLIN], lists, attempts, SCHEDULE)
    ).toEqual(BERLIN);
  });

  it('ignores an attempt the list is newer than', () => {
    const lists = [list(BAYERN, NOW - WEEK)];
    const attempts = new Map([[BAYERN.id, NOW - WEEK - HOUR]]);

    expect(associationToCrawl([BAYERN], lists, attempts, SCHEDULE)).toEqual(
      BAYERN
    );
  });

  it('ignores lists of Associations the DBB no longer offers', () => {
    const lists = [list(HESSEN, 0), list(BAYERN, NOW)];

    expect(
      associationToCrawl([BAYERN], lists, NO_ATTEMPTS, SCHEDULE)
    ).toBeUndefined();
  });

  it('takes none without Associations', () => {
    expect(associationToCrawl([], [], NO_ATTEMPTS, SCHEDULE)).toBeUndefined();
  });
});
