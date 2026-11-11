import {
  associationToCrawl,
  overdueListless,
  withoutList,
  type ClubIndexSchedule,
} from './association-to-crawl';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const NOW = 100 * DAY;
const SCHEDULE: ClubIndexSchedule = {
  maxAgeMs: WEEK,
  retryAfterMs: DAY,
  namesForMs: 20 * 60_000,
  warnListlessAfterMs: WEEK,
};
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
        SCHEDULE,
        NOW
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
      associationToCrawl(
        [BAYERN, BERLIN, HESSEN],
        lists,
        NO_ATTEMPTS,
        SCHEDULE,
        NOW
      )
    ).toEqual(BERLIN);
  });

  it('takes none while every list is younger than a week', () => {
    const lists = [list(BAYERN, NOW - WEEK + 1), list(BERLIN, NOW)];

    expect(
      associationToCrawl([BAYERN, BERLIN], lists, NO_ATTEMPTS, SCHEDULE, NOW)
    ).toBeUndefined();
  });

  it('passes over an Association whose crawl left no list, for a day', () => {
    const attempts = new Map([[BERLIN.id, NOW - HOUR]]);

    expect(
      associationToCrawl([BERLIN, HESSEN], [], attempts, SCHEDULE, NOW)
    ).toEqual(HESSEN);
    expect(
      associationToCrawl([BERLIN], [], attempts, SCHEDULE, NOW)
    ).toBeUndefined();
    expect(
      associationToCrawl([BERLIN], [], attempts, SCHEDULE, NOW + DAY)
    ).toEqual(BERLIN);
  });

  it('passes over a stale list whose new crawl failed, for a day', () => {
    const lists = [list(BAYERN, NOW - 2 * WEEK), list(BERLIN, NOW - WEEK)];
    const attempts = new Map([[BAYERN.id, NOW - HOUR]]);

    expect(
      associationToCrawl([BAYERN, BERLIN], lists, attempts, SCHEDULE, NOW)
    ).toEqual(BERLIN);
  });

  it('ignores an attempt the list is newer than', () => {
    const lists = [list(BAYERN, NOW - WEEK)];
    const attempts = new Map([[BAYERN.id, NOW - WEEK - HOUR]]);

    expect(
      associationToCrawl([BAYERN], lists, attempts, SCHEDULE, NOW)
    ).toEqual(BAYERN);
  });

  it('ignores lists of Associations the DBB no longer offers', () => {
    const lists = [list(HESSEN, 0), list(BAYERN, NOW)];

    expect(
      associationToCrawl([BAYERN], lists, NO_ATTEMPTS, SCHEDULE, NOW)
    ).toBeUndefined();
  });

  it("takes a list a Team stood in for a Club's name in again after a day", () => {
    const standIn = {
      association: BAYERN,
      clubs: [{ id: 1, name: 'TSV 2', nameFromTeam: true as const }],
      updatedAt: NOW - DAY,
    };

    expect(
      associationToCrawl([BAYERN], [standIn], NO_ATTEMPTS, SCHEDULE, NOW)
    ).toEqual(BAYERN);
    expect(
      associationToCrawl(
        [BAYERN],
        [{ ...standIn, updatedAt: NOW - 1 }],
        NO_ATTEMPTS,
        SCHEDULE,
        NOW
      )
    ).toBeUndefined();
  });

  it('takes none without Associations', () => {
    expect(
      associationToCrawl([], [], NO_ATTEMPTS, SCHEDULE, NOW)
    ).toBeUndefined();
  });
});

describe('withoutList', () => {
  it('takes the Associations the index holds no list of, in their order', () => {
    expect(withoutList([BAYERN, BERLIN, HESSEN], [list(BERLIN, NOW)])).toEqual([
      BAYERN,
      HESSEN,
    ]);
  });
});

describe('overdueListless', () => {
  it('names an Association without a list for longer than the warning time', () => {
    expect(
      overdueListless(
        [BERLIN, HESSEN],
        new Map([
          [3, NOW - WEEK - 1],
          [6, NOW - WEEK],
        ]),
        SCHEDULE,
        NOW
      )
    ).toEqual([{ association: 3, listlessSince: NOW - WEEK - 1 }]);
  });

  it('names none without a list that no attempt has dated yet', () => {
    expect(overdueListless([BAYERN], new Map(), SCHEDULE, NOW)).toEqual([]);
  });

  it('names only Associations without a list it is given', () => {
    expect(
      overdueListless([BAYERN], new Map([[40, NOW - 2 * WEEK]]), SCHEDULE, NOW)
    ).toEqual([]);
  });
});
