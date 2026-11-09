import type { BasketballData } from '../basketball-data';
import { BasketballDataError } from '../domain/basketball-data-error';
import type { LigaId, VereinId } from '../domain/ids';
import type { Liga } from '../domain/liga';
import type { LigaSeite, LigaSucheFilter } from '../domain/liga-suche';
import type { Team } from '../domain/team';
import type { VereinsTeams } from '../domain/team-saison';
import { crawlClubs } from './crawl-clubs';

const NIEDERSACHSEN = { id: 7, name: 'Niedersachsen' };

function league(id: LigaId): Liga {
  return {
    id,
    name: `Liga ${id}`,
    verband: NIEDERSACHSEN,
    altersklasse: 'U12',
    geschlecht: 'männlich',
    spielklasse: 'Bezirksliga',
  };
}

function team(id: number, vereinId: VereinId, name: string): Team {
  return { id, name, vereinId };
}

const PAGES: Record<number, LigaSeite> = {
  0: { startIndex: 0, ligen: [league(1), league(2)], weitere: true },
  2: { startIndex: 2, ligen: [league(3)], weitere: false },
};

const TEAMS: Record<
  LigaId,
  readonly Team[] | 'not-found' | 'unavailable' | 'unexpected-shape'
> = {
  1: [team(11, 100, 'MTV Wasbüttel'), team(12, 200, 'MTV Gifhorn 2')],
  2: [team(13, 100, 'MTV Wasbüttel 2'), team(14, 300, 'SG Unbekannt')],
  3: 'not-found',
};

const CLUB_NAMES: Record<VereinId, string> = {
  100: 'MTV Wasbüttel',
  200: 'MTV Gifhorn',
};

/** A source with the pages, Teams and Clubs above, logging every read. */
function fakeData(teams = TEAMS): {
  data: BasketballData;
  reads: string[];
} {
  const reads: string[] = [];
  const unused = () => Promise.reject(new Error('not read by a crawl'));
  const data: BasketballData = {
    ligaSuche: async (filter: LigaSucheFilter) => {
      reads.push(`ligaSuche ${filter.verbandIds.join()}`);
      return {
        facetten: {
          verbaende: [],
          altersklassen: [],
          altersgruppenGeschlechter: [],
        },
        ersteSeite: PAGES[0],
      };
    },
    ligaSeite: async (filter: LigaSucheFilter, startIndex: number) => {
      reads.push(`ligaSeite ${filter.verbandIds.join()} ${startIndex}`);
      return PAGES[startIndex];
    },
    ligaTeams: async (liga: LigaId) => {
      reads.push(`ligaTeams ${liga}`);
      const answer = teams[liga];
      if (typeof answer === 'string') {
        throw new BasketballDataError(answer, `Liga ${liga}`);
      }
      return answer;
    },
    vereinsTeams: async (verein: VereinId): Promise<VereinsTeams> => {
      reads.push(`vereinsTeams ${verein}`);
      const name = CLUB_NAMES[verein];
      if (name === undefined) {
        throw new BasketballDataError('not-found', `Verein ${verein}`);
      }
      return { verein: { id: verein, name }, teams: [] };
    },
    teamSpiele: unused,
    tabelle: unused,
    spiel: unused,
    spielbericht: unused,
  };
  return { data, reads };
}

describe('crawlClubs', () => {
  it("lists every Club of the Association's Leagues once, by id, named by the source", async () => {
    const { data } = fakeData();

    const clubs = await crawlClubs(data, 7, {
      knownNames: new Map(),
      pause: async () => undefined,
    });

    expect(clubs).toEqual([
      { id: 200, name: 'MTV Gifhorn' },
      { id: 100, name: 'MTV Wasbüttel' },
      { id: 300, name: 'SG Unbekannt', nameFromTeam: true },
    ]);
  });

  it("lets a Team's name stand in once there is no time left to read names", async () => {
    const { data, reads } = fakeData();

    const clubs = await crawlClubs(data, 7, {
      knownNames: new Map([[100, 'MTV Wasbüttel']]),
      pause: async () => undefined,
      timeForNames: () => false,
    });

    expect(reads.filter((read) => read.startsWith('vereinsTeams'))).toEqual([]);
    expect(clubs).toEqual([
      { id: 200, name: 'MTV Gifhorn 2', nameFromTeam: true },
      { id: 100, name: 'MTV Wasbüttel' },
      { id: 300, name: 'SG Unbekannt', nameFromTeam: true },
    ]);
  });

  it('skips a League the source cannot map', async () => {
    const { data } = fakeData({ ...TEAMS, 2: 'unexpected-shape' });

    const clubs = await crawlClubs(data, 7, {
      knownNames: new Map(),
      pause: async () => undefined,
    });

    expect(clubs.map(({ id }) => id)).toEqual([200, 100]);
  });

  it('rejects an empty page that promises more, rather than reading it forever', async () => {
    const { data } = fakeData();
    const stuck: BasketballData = {
      ...data,
      ligaSeite: async (_filter, startIndex) => ({
        startIndex,
        ligen: [],
        weitere: true,
      }),
    };

    await expect(
      crawlClubs(stuck, 7, {
        knownNames: new Map(),
        pause: async () => undefined,
      })
    ).rejects.toMatchObject({ kind: 'unexpected-shape' });
  });

  it("reads every page of the Association's Leagues and skips a League the source does not know", async () => {
    const { data, reads } = fakeData();

    await crawlClubs(data, 7, {
      knownNames: new Map(),
      pause: async () => undefined,
    });

    expect(reads.slice(0, 5)).toEqual([
      'ligaSuche 7',
      'ligaSeite 7 2',
      'ligaTeams 1',
      'ligaTeams 2',
      'ligaTeams 3',
    ]);
  });

  it('reads no name it already knows', async () => {
    const { data, reads } = fakeData();

    const clubs = await crawlClubs(data, 7, {
      knownNames: new Map([
        [100, 'MTV Wasbüttel e.V.'],
        [200, 'MTV Gifhorn'],
      ]),
      pause: async () => undefined,
    });

    expect(reads.filter((read) => read.startsWith('vereinsTeams'))).toEqual([
      'vereinsTeams 300',
    ]);
    expect(clubs[1]).toEqual({ id: 100, name: 'MTV Wasbüttel e.V.' });
  });

  it('pauses before every read but the first', async () => {
    const { data, reads } = fakeData();
    let pauses = 0;

    await crawlClubs(data, 7, {
      knownNames: new Map(),
      pause: async () => {
        expect(reads.length).toBe(pauses + 1);
        pauses++;
      },
    });

    expect(pauses).toBe(reads.length - 1);
  });

  it('rejects when a League cannot be read for another reason', async () => {
    const { data } = fakeData({ ...TEAMS, 2: 'unavailable' });

    await expect(
      crawlClubs(data, 7, {
        knownNames: new Map(),
        pause: async () => undefined,
      })
    ).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
