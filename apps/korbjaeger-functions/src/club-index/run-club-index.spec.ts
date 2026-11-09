import {
  BasketballDataError,
  type AssociationClubs,
  type BasketballData,
  type LigaSeite,
} from '@wolsok/feat-shared-basketball-data';
import { runClubIndex, type ClubIndexStore } from './run-club-index';

const WEEK = 7 * 86_400_000;
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

function fakeData(
  teams: () => Promise<
    readonly { id: number; name: string; vereinId: number }[]
  >
): BasketballData {
  const unused = () => Promise.reject(new Error('not read'));
  return {
    ligaSuche: async (filter) => ({
      facetten: {
        verbaende: [
          { ...BAYERN, treffer: 392 },
          { ...BERLIN, treffer: 101 },
          { id: 99, name: 'Ohne Ligen', treffer: 0 },
        ],
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
    vereinsTeams: async (verein) => ({
      verein: { id: verein, name: `Verein ${verein}` },
      teams: [],
    }),
    teamSpiele: unused,
    tabelle: unused,
    spiel: unused,
    spielbericht: unused,
  };
}

function fakeStore(lists: AssociationClubs[]): ClubIndexStore & {
  saved: AssociationClubs[];
} {
  const saved: AssociationClubs[] = [];
  return {
    saved,
    all: async () => lists,
    save: async (list) => {
      saved.push(list);
    },
  };
}

const BERLIN_TEAMS = async () => [
  { id: 1, name: 'ALBA Berlin 2', vereinId: 700 },
  { id: 2, name: 'TuS Lichterfelde', vereinId: 800 },
];

describe('runClubIndex', () => {
  it('crawls the Association without a list and saves its Clubs, names known from any list kept', async () => {
    const store = fakeStore([
      {
        association: BAYERN,
        clubs: [{ id: 700, name: 'ALBA Berlin' }],
        updatedAt: NOW,
      },
    ]);

    const result = await runClubIndex({
      data: fakeData(BERLIN_TEAMS),
      store,
      now: () => NOW,
      pause: async () => undefined,
      maxAgeMs: WEEK,
    });

    expect(result).toEqual({ crawled: true, association: 3, clubs: 2 });
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

  it('does nothing while every offered Association has a fresh list', async () => {
    const store = fakeStore([
      { association: BAYERN, clubs: [], updatedAt: NOW - 1 },
      { association: BERLIN, clubs: [], updatedAt: NOW - 1 },
    ]);

    const result = await runClubIndex({
      data: fakeData(BERLIN_TEAMS),
      store,
      now: () => NOW,
      pause: async () => undefined,
      maxAgeMs: WEEK,
    });

    expect(result).toEqual({ crawled: false });
    expect(store.saved).toEqual([]);
  });

  it('saves nothing when the crawl fails', async () => {
    const store = fakeStore([
      { association: BAYERN, clubs: [], updatedAt: NOW },
    ]);

    await expect(
      runClubIndex({
        data: fakeData(() =>
          Promise.reject(new BasketballDataError('unavailable', 'DBB down'))
        ),
        store,
        now: () => NOW,
        pause: async () => undefined,
        maxAgeMs: WEEK,
      })
    ).rejects.toMatchObject({ kind: 'unavailable' });
    expect(store.saved).toEqual([]);
  });
});
