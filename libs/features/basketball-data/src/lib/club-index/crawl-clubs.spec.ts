import {
  BasketballDataError,
  type BasketballDataErrorKind,
} from '../domain/basketball-data-error';
import type { LeagueId, ClubId } from '../domain/ids';
import type { League } from '../domain/league';
import type { LeaguePage, LeagueSearchFilter } from '../domain/league-search';
import type { Team } from '../domain/team';
import type { Club } from '../domain/club';
import {
  CLUB_NAME_ATTEMPTS,
  crawlClubs,
  type ClubCrawlSource,
} from './crawl-clubs';

const NIEDERSACHSEN = { id: 7, name: 'Niedersachsen' };

function league(id: LeagueId): League {
  return {
    id,
    name: `Liga ${id}`,
    association: NIEDERSACHSEN,
    ageGroup: 'U12',
    gender: 'male',
    division: 'Bezirksliga',
  };
}

function team(id: number, clubId: ClubId, name: string): Team {
  return { id, name, clubId };
}

const PAGES: Record<number, LeaguePage> = {
  0: { startIndex: 0, leagues: [league(1), league(2)], more: true },
  2: { startIndex: 2, leagues: [league(3)], more: false },
};

const TEAMS: Record<
  LeagueId,
  readonly Team[] | 'not-found' | 'unavailable' | 'unexpected-shape'
> = {
  1: [team(11, 100, 'MTV Wasbüttel'), team(12, 200, 'MTV Gifhorn 2')],
  2: [team(13, 100, 'MTV Wasbüttel 2'), team(14, 300, 'SG Unbekannt')],
  3: 'not-found',
};

const CLUB_NAMES: Record<ClubId, string> = {
  100: 'MTV Wasbüttel',
  200: 'MTV Gifhorn',
};

/** How a Club's name read fails: with `kind`, its first `times` reads (all). */
interface NameFailure {
  readonly kind: BasketballDataErrorKind;
  readonly times?: number;
}

/**
 * A source with the pages, Teams and Clubs above, the name reads of
 * `failedNames` rejecting with their kind, logging every read.
 */
function fakeData(
  teams = TEAMS,
  failedNames: Readonly<Record<ClubId, NameFailure>> = {}
): {
  data: ClubCrawlSource;
  reads: string[];
} {
  const reads: string[] = [];
  const data: ClubCrawlSource = {
    leagueSearch: async (filter: LeagueSearchFilter) => {
      reads.push(`leagueSearch ${filter.associationIds.join()}`);
      return {
        facets: {
          associations: [],
          ageGroups: [],
          ageGroupGenders: [],
        },
        firstPage: PAGES[0],
      };
    },
    leaguePage: async (filter: LeagueSearchFilter, startIndex: number) => {
      reads.push(`leaguePage ${filter.associationIds.join()} ${startIndex}`);
      return PAGES[startIndex];
    },
    leagueTeams: async (leagueId: LeagueId) => {
      reads.push(`leagueTeams ${leagueId}`);
      const answer = teams[leagueId];
      if (typeof answer === 'string') {
        throw new BasketballDataError(answer, `Liga ${leagueId}`);
      }
      return answer;
    },
    club: async (club: ClubId): Promise<Club> => {
      reads.push(`club ${club}`);
      const failure = failedNames[club];
      const attempt = reads.filter((read) => read === `club ${club}`).length;
      if (failure !== undefined && attempt <= (failure.times ?? Infinity)) {
        throw new BasketballDataError(failure.kind, `Verein ${club}`);
      }
      const name = CLUB_NAMES[club];
      if (name === undefined) {
        throw new BasketballDataError('not-found', `Verein ${club}`);
      }
      return { id: club, name };
    },
  };
  return { data, reads };
}

describe('crawlClubs', () => {
  it("lists every Club of the Association's Leagues once, by id, named by the source", async () => {
    const { data } = fakeData();

    const clubs = await crawlClubs(data, 7, {
      knownNames: new Map(),
      pause: async () => undefined,
      timeForNames: () => true,
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

    expect(reads.filter((read) => read.startsWith('club '))).toEqual([]);
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
      timeForNames: () => true,
    });

    expect(clubs.map(({ id }) => id)).toEqual([200, 100]);
  });

  it('rejects an empty page that promises more, rather than reading it forever', async () => {
    const { data } = fakeData();
    const stuck: ClubCrawlSource = {
      ...data,
      leaguePage: async (_filter, startIndex) => ({
        startIndex,
        leagues: [],
        more: true,
      }),
    };

    await expect(
      crawlClubs(stuck, 7, {
        knownNames: new Map(),
        pause: async () => undefined,
        timeForNames: () => true,
      })
    ).rejects.toMatchObject({ kind: 'unexpected-shape' });
  });

  it("reads every page of the Association's Leagues and skips a League the source does not know", async () => {
    const { data, reads } = fakeData();

    await crawlClubs(data, 7, {
      knownNames: new Map(),
      pause: async () => undefined,
      timeForNames: () => true,
    });

    expect(reads.slice(0, 5)).toEqual([
      'leagueSearch 7',
      'leaguePage 7 2',
      'leagueTeams 1',
      'leagueTeams 2',
      'leagueTeams 3',
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
      timeForNames: () => true,
    });

    expect(reads.filter((read) => read.startsWith('club '))).toEqual([
      'club 300',
    ]);
    expect(clubs[1]).toEqual({ id: 100, name: 'MTV Wasbüttel e.V.' });
  });

  it('pauses before every read', async () => {
    const { data, reads } = fakeData();
    let pauses = 0;

    await crawlClubs(data, 7, {
      knownNames: new Map(),
      pause: async () => {
        expect(reads.length).toBe(pauses);
        pauses++;
      },
      timeForNames: () => true,
    });

    expect(pauses).toBe(reads.length);
  });

  it('rejects when a League cannot be read for another reason', async () => {
    const { data } = fakeData({ ...TEAMS, 2: 'unavailable' });

    await expect(
      crawlClubs(data, 7, {
        knownNames: new Map(),
        pause: async () => undefined,
        timeForNames: () => true,
      })
    ).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it("lets a Team's name stand in where the source cannot map the Club", async () => {
    const { data } = fakeData(TEAMS, { 300: { kind: 'unexpected-shape' } });

    const clubs = await crawlClubs(data, 7, {
      knownNames: new Map(),
      pause: async () => undefined,
      timeForNames: () => true,
    });

    expect(clubs[2]).toEqual({
      id: 300,
      name: 'SG Unbekannt',
      nameFromTeam: true,
    });
  });

  it.each(['unavailable', 'offline'] as const)(
    "rejects rather than letting a Team's name stand in where every read of a name fails as %s",
    async (kind) => {
      const { data, reads } = fakeData(TEAMS, { 200: { kind } });

      await expect(
        crawlClubs(data, 7, {
          knownNames: new Map(),
          pause: async () => undefined,
          timeForNames: () => true,
        })
      ).rejects.toMatchObject({ kind });
      expect(reads.filter((read) => read === 'club 200')).toHaveLength(
        CLUB_NAME_ATTEMPTS
      );
    }
  );

  it('reads a name again, pausing first, where a read fails for the moment', async () => {
    const { data, reads } = fakeData(TEAMS, {
      200: { kind: 'unavailable', times: CLUB_NAME_ATTEMPTS - 1 },
    });
    let pauses = 0;

    const clubs = await crawlClubs(data, 7, {
      knownNames: new Map(),
      pause: async () => {
        pauses++;
      },
      timeForNames: () => true,
    });

    expect(clubs[0]).toEqual({ id: 200, name: 'MTV Gifhorn' });
    expect(reads.filter((read) => read === 'club 200')).toHaveLength(
      CLUB_NAME_ATTEMPTS
    );
    expect(pauses).toBe(reads.length);
  });
});
