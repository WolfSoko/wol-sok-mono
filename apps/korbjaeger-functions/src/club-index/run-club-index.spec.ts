import {
  BasketballDataError,
  type AssociationClubs,
  type ClubCrawlSource,
  type LigaSeite,
  type Team,
} from '@wolsok/feat-shared-basketball-data';
import {
  runClubIndex,
  type ClubIndexRun,
  type ClubIndexStore,
} from './run-club-index';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const NOW = 10 * WEEK;
const BAYERN = { id: 2, name: 'Bayern' };
const BERLIN = { id: 3, name: 'Berlin' };

const BERLIN_PAGE: LigaSeite = {
  startIndex: 0,
  weitere: false,
  ligen: [
    {
      id: 51,
      name: 'Oberliga U14',
      verband: BERLIN,
      altersklasse: 'U14',
      geschlecht: 'männlich',
      spielklasse: 'Oberliga',
    },
  ],
};

const BERLIN_TEAMS = async (): Promise<readonly Team[]> => [
  { id: 1, name: 'ALBA Berlin 2', vereinId: 700 },
  { id: 2, name: 'TuS Lichterfelde', vereinId: 800 },
];

function fakeData(
  teams: () => Promise<readonly Team[]> = BERLIN_TEAMS,
  offered = [
    { ...BAYERN, treffer: 392 },
    { ...BERLIN, treffer: 101 },
    { id: 99, name: 'Ohne Ligen', treffer: 0 },
  ]
): ClubCrawlSource {
  const unused = () => Promise.reject(new Error('not read'));
  return {
    ligaSuche: async (filter) => ({
      facetten: {
        verbaende: offered,
        altersklassen: [],
        altersgruppenGeschlechter: [],
      },
      ersteSeite:
        filter.verbandIds.length === 0
          ? { startIndex: 0, ligen: [], weitere: true }
          : BERLIN_PAGE,
    }),
    ligaSeite: unused,
    ligaTeams: teams,
    club: async (verein) => ({ id: verein, name: `Verein ${verein}` }),
  };
}

function fakeStore(
  lists: AssociationClubs[],
  attempts = new Map<number, number>(),
  noted: readonly number[] = [],
  unmarked: readonly number[] = []
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
    read: async () => ({ lists, attempts, ids, offered }),
    noteOffered: async (associations) => {
      log.push(`note ${associations.join(',')}`);
    },
    markAttempt: async (id, at) => {
      log.push(`attempt ${id} ${at}`);
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
    schedule: { maxAgeMs: WEEK, retryAfterMs: DAY, namesForMs: 20 * 60_000 },
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
      crawled: { association: 3, clubs: 2, namedByTeam: 0 },
    });
    expect(store.log).toEqual(['note 3', `attempt 3 ${NOW}`, 'save 3']);
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

    expect(result).toEqual({ removed: 0, noted: 0 });
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
    expect(store.log).toEqual(['note 3', `attempt 3 ${NOW}`]);
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
    expect(store.log).toEqual([`attempt 3 ${NOW}`, 'save 3']);
  });

  it('deletes nothing when the DBB offers no Association at all', async () => {
    const store = fakeStore([
      { association: BAYERN, clubs: [], updatedAt: NOW },
    ]);

    await runClubIndex(runWith(store, fakeData(BERLIN_TEAMS, [])));

    expect(store.log).toEqual([]);
  });
});
