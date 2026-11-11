import {
  BasketballDataError,
  type AssociationClubs,
  type ClubCrawlSource,
  type LeaguePage,
  type Team,
} from '@wolsok/feat-shared-basketball-data';
import {
  LAST_ERROR_LENGTH,
  NO_ERROR_RECORDED,
  runClubIndex,
  type ClubIndexRun,
  type ClubIndexStore,
  type ListlessWarning,
} from './run-club-index';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const NOW = 10 * WEEK;
const BAYERN = { id: 2, name: 'Bayern' };
const BERLIN = { id: 3, name: 'Berlin' };

const BERLIN_PAGE: LeaguePage = {
  startIndex: 0,
  more: false,
  leagues: [
    {
      id: 51,
      name: 'Oberliga U14',
      association: BERLIN,
      ageGroup: 'U14',
      gender: 'male',
      division: 'Oberliga',
    },
  ],
};

const BERLIN_TEAMS = async (): Promise<readonly Team[]> => [
  { id: 1, name: 'ALBA Berlin 2', clubId: 700 },
  { id: 2, name: 'TuS Lichterfelde', clubId: 800 },
];

function fakeData(
  teams: () => Promise<readonly Team[]> = BERLIN_TEAMS,
  offered = [
    { ...BAYERN, hits: 392 },
    { ...BERLIN, hits: 101 },
    { id: 99, name: 'Ohne Ligen', hits: 0 },
  ]
): ClubCrawlSource {
  const unused = () => Promise.reject(new Error('not read'));
  return {
    leagueSearch: async (filter) => ({
      facets: {
        associations: offered,
        ageGroups: [],
        ageGroupGenders: [],
      },
      firstPage:
        filter.associationIds.length === 0
          ? { startIndex: 0, leagues: [], more: true }
          : BERLIN_PAGE,
    }),
    leaguePage: unused,
    leagueTeams: teams,
    club: async (verein) => ({ id: verein, name: `Verein ${verein}` }),
  };
}

function fakeStore(
  lists: AssociationClubs[],
  attempts = new Map<number, number>(),
  noted: readonly number[] = [],
  unmarked: readonly number[] = [],
  listless: { since?: Map<number, number>; errors?: Map<number, string> } = {}
): ClubIndexStore & { log: string[]; saved: AssociationClubs[] } {
  const log: string[] = [];
  const saved: AssociationClubs[] = [];
  const ids = new Set([
    ...lists.map(({ association }) => association.id),
    ...attempts.keys(),
    ...noted,
  ]);
  const offered = new Set(
    [...lists.map(({ association }) => association.id), ...noted].filter(
      (id) => !unmarked.includes(id)
    )
  );
  return {
    log,
    saved,
    read: async () => ({
      lists,
      attempts,
      ids,
      offered,
      listlessSince: listless.since ?? new Map(),
      lastErrors: listless.errors ?? new Map(),
    }),
    noteOffered: async (associations) => {
      log.push(`note ${associations.join(',')}`);
    },
    markAttempt: async (id, at, listlessSince) => {
      log.push(
        `attempt ${id} ${at}` +
          (listlessSince === undefined ? '' : ` listless ${listlessSince}`)
      );
    },
    markFailure: async (id, error) => {
      log.push(`failure ${id} ${error}`);
    },
    save: async (list) => {
      log.push(`save ${list.association.id}`);
      saved.push(list);
    },
    remove: async (id) => {
      log.push(`remove ${id}`);
    },
  };
}

function runWith(
  store: ClubIndexStore,
  data = fakeData(),
  more: Partial<ClubIndexRun> = {}
): ClubIndexRun {
  return {
    data,
    store,
    now: () => NOW,
    pause: async () => undefined,
    schedule: {
      maxAgeMs: WEEK,
      retryAfterMs: DAY,
      namesForMs: 20 * 60_000,
      warnListlessAfterMs: WEEK,
    },
    warn: () => undefined,
    ...more,
  };
}

describe('runClubIndex', () => {
  it('crawls the Association without a list and saves its Clubs, own names known from any list kept', async () => {
    const store = fakeStore([
      {
        association: BAYERN,
        clubs: [{ id: 700, name: 'ALBA Berlin' }],
        updatedAt: NOW,
      },
    ]);

    const result = await runClubIndex(runWith(store));

    expect(result).toEqual({
      removed: 0,
      noted: 1,
      withoutList: 1,
      crawled: { association: 3, clubs: 2, namedByTeam: 0 },
    });
    expect(store.log).toEqual([
      'note 3',
      `attempt 3 ${NOW} listless ${NOW}`,
      'save 3',
    ]);
    expect(store.saved).toEqual([
      {
        association: BERLIN,
        clubs: [
          { id: 700, name: 'ALBA Berlin' },
          { id: 800, name: 'Verein 800' },
        ],
        updatedAt: NOW,
      },
    ]);
  });

  it('reads again a name a Team stood in for', async () => {
    const store = fakeStore([
      {
        association: BAYERN,
        clubs: [{ id: 700, name: 'ALBA Berlin 2', nameFromTeam: true }],
        updatedAt: NOW,
      },
    ]);

    await runClubIndex(runWith(store));

    expect(store.saved[0].clubs[0]).toEqual({ id: 700, name: 'Verein 700' });
  });

  it("lets Teams' names stand in once the time for names is up", async () => {
    const store = fakeStore([]);
    let clock = NOW;

    const result = await runClubIndex(
      runWith(store, fakeData(), {
        now: () => clock,
        pause: async () => {
          clock += 30 * 60_000;
        },
      })
    );

    expect(result.crawled).toMatchObject({ clubs: 2, namedByTeam: 2 });
  });

  it('does nothing while every offered Association has a fresh list', async () => {
    const store = fakeStore([
      { association: BAYERN, clubs: [], updatedAt: NOW - 1 },
      { association: BERLIN, clubs: [], updatedAt: NOW - 1 },
    ]);

    const result = await runClubIndex(runWith(store));

    expect(result).toEqual({ removed: 0, noted: 0, withoutList: 0 });
    expect(store.log).toEqual([]);
  });

  it('notes the attempt but saves nothing when the crawl fails', async () => {
    const store = fakeStore([
      { association: BAYERN, clubs: [], updatedAt: NOW },
    ]);

    await expect(
      runClubIndex(
        runWith(
          store,
          fakeData(() =>
            Promise.reject(new BasketballDataError('unavailable', 'DBB down'))
          )
        )
      )
    ).rejects.toMatchObject({ kind: 'unavailable' });
    expect(store.log).toEqual([
      'note 3',
      `attempt 3 ${NOW} listless ${NOW}`,
      'failure 3 unavailable: DBB down',
    ]);
  });

  it('deletes the lists of Associations the DBB no longer offers', async () => {
    const store = fakeStore([
      { association: { id: 40, name: 'Aufgelöst' }, clubs: [], updatedAt: NOW },
      { association: BAYERN, clubs: [], updatedAt: NOW },
      { association: BERLIN, clubs: [], updatedAt: NOW },
    ]);

    expect(await runClubIndex(runWith(store))).toEqual({
      removed: 1,
      noted: 0,
      withoutList: 0,
    });
    expect(store.log).toEqual(['remove 40']);
  });

  it('deletes the attempts and notes of Associations the DBB no longer offers, so none keeps the index incomplete', async () => {
    const store = fakeStore(
      [
        { association: BAYERN, clubs: [], updatedAt: NOW },
        { association: BERLIN, clubs: [], updatedAt: NOW },
      ],
      new Map([[41, NOW - DAY]]),
      [42]
    );

    expect(await runClubIndex(runWith(store))).toEqual({
      removed: 2,
      noted: 0,
      withoutList: 0,
    });
    expect(store.log).toEqual(['remove 41', 'remove 42']);
  });

  it('notes every offered Association without a document, before its first crawl', async () => {
    const store = fakeStore([]);

    const result = await runClubIndex(runWith(store));

    expect(result).toMatchObject({ noted: 2, crawled: { association: 2 } });
    expect(store.log[0]).toBe('note 2,3');
  });

  it('marks the lists stored before it noted Verbände, so the server waits for them', async () => {
    const store = fakeStore(
      [
        { association: BAYERN, clubs: [], updatedAt: NOW },
        { association: BERLIN, clubs: [], updatedAt: NOW },
      ],
      new Map(),
      [],
      [2, 3]
    );

    expect(await runClubIndex(runWith(store))).toEqual({
      removed: 0,
      noted: 2,
      withoutList: 0,
    });
    expect(store.log).toEqual(['note 2,3']);
  });

  it('notes no Association again that it noted before', async () => {
    const store = fakeStore(
      [{ association: BAYERN, clubs: [], updatedAt: NOW }],
      new Map(),
      [3]
    );

    const result = await runClubIndex(runWith(store));

    expect(result).toMatchObject({ noted: 0, crawled: { association: 3 } });
    expect(store.log).toEqual([`attempt 3 ${NOW} listless ${NOW}`, 'save 3']);
  });

  it('deletes nothing when the DBB offers no Association at all', async () => {
    const store = fakeStore([
      { association: BAYERN, clubs: [], updatedAt: NOW },
    ]);

    await runClubIndex(runWith(store, fakeData(BERLIN_TEAMS, [])));

    expect(store.log).toEqual([]);
  });

  describe('Verbände without a list (#3022)', () => {
    const BAYERN_LIST = { association: BAYERN, clubs: [], updatedAt: NOW };

    function warningsOf(store: ClubIndexStore, data = fakeData()) {
      const warnings: ListlessWarning[] = [];
      const run = runClubIndex(
        runWith(store, data, { warn: (warning) => warnings.push(warning) })
      );
      return { warnings, run };
    }

    it('warns of a Verband without a list for over a week, with its last error, before it crawls', async () => {
      const since = NOW - WEEK - 1;
      const store = fakeStore(
        [BAYERN_LIST],
        new Map([[3, NOW - DAY]]),
        [3],
        [],
        {
          since: new Map([[3, since]]),
          errors: new Map([[3, 'unavailable: DBB down']]),
        }
      );
      const { warnings, run } = warningsOf(
        store,
        fakeData(() =>
          Promise.reject(new BasketballDataError('unavailable', 'DBB down'))
        )
      );

      await expect(run).rejects.toMatchObject({ kind: 'unavailable' });
      expect(warnings).toEqual([
        {
          association: 3,
          listlessSince: new Date(since).toISOString(),
          lastError: 'unavailable: DBB down',
        },
      ]);
      expect(store.log).toEqual([
        `attempt 3 ${NOW} listless ${since}`,
        'failure 3 unavailable: DBB down',
      ]);
    });

    it('says when no error was recorded, as after a timeout', async () => {
      const store = fakeStore([BAYERN_LIST], new Map(), [3], [], {
        since: new Map([[3, NOW - 2 * WEEK]]),
      });
      const { warnings, run } = warningsOf(store);

      expect(await run).toMatchObject({ withoutList: 1 });
      expect(warnings).toEqual([
        expect.objectContaining({
          association: 3,
          lastError: NO_ERROR_RECORDED,
        }),
      ]);
    });

    it('warns of none while every list is there', async () => {
      const store = fakeStore(
        [BAYERN_LIST, { association: BERLIN, clubs: [], updatedAt: NOW }],
        new Map(),
        [],
        [],
        { since: new Map([[3, NOW - 2 * WEEK]]) }
      );
      const { warnings, run } = warningsOf(store);

      expect(await run).toMatchObject({ withoutList: 0 });
      expect(warnings).toEqual([]);
    });

    it('warns of none without a list for less than a week', async () => {
      const store = fakeStore([BAYERN_LIST], new Map(), [3], [], {
        since: new Map([[3, NOW - WEEK]]),
      });
      const { warnings, run } = warningsOf(store);

      expect(await run).toMatchObject({ withoutList: 1 });
      expect(warnings).toEqual([]);
    });

    it('dates no attempt of a Verband that has a list', async () => {
      const store = fakeStore([
        { association: BAYERN, clubs: [], updatedAt: NOW - 2 * WEEK },
        { association: BERLIN, clubs: [], updatedAt: NOW },
      ]);

      await runClubIndex(runWith(store));

      expect(store.log).toEqual([`attempt 2 ${NOW}`, 'save 2']);
    });

    it("rejects with the crawl's error where noting it fails too", async () => {
      const store = {
        ...fakeStore([BAYERN_LIST], new Map(), [3]),
        markFailure: () => Promise.reject(new Error('Firestore down')),
      };

      await expect(
        runClubIndex(
          runWith(
            store,
            fakeData(() =>
              Promise.reject(new BasketballDataError('unavailable', 'DBB down'))
            )
          )
        )
      ).rejects.toMatchObject({ kind: 'unavailable' });
    });

    it('stores at most 200 characters of an unexpected error, by its name', async () => {
      const store = fakeStore([BAYERN_LIST], new Map(), [3]);

      await expect(
        runClubIndex(
          runWith(
            store,
            fakeData(() => Promise.reject(new TypeError('x'.repeat(300))))
          )
        )
      ).rejects.toBeInstanceOf(TypeError);
      const failure = store.log.at(-1) ?? '';
      expect(failure).toMatch(/^failure 3 TypeError: x+$/);
      expect(failure.length).toBe('failure 3 '.length + LAST_ERROR_LENGTH);
    });
  });
});
