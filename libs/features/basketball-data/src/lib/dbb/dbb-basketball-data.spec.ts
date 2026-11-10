import { rejectedError } from '../../testing/caught-error';
import { BasketballDataError } from '../domain/basketball-data-error';
import {
  NO_LEAGUE_FILTER,
  offered,
  nextStartIndex,
  type LeagueSearchFilter,
} from '../domain/league-search';
import type { ReadOptions } from '../basketball-data';
import { DbbBasketballData } from './dbb-basketball-data';
import {
  type DbbRequest,
  type DbbRequestKind,
  type DbbTransport,
} from './dbb-request';
import boxscoreNotFound from './fixtures/boxscore-not-found.json';
import noReport from './fixtures/boxscore-2843814.json';
import withStats from './fixtures/boxscore-2911141.json';
import clubMatches from './fixtures/club-1476-actualmatches.json';
import clubNotFound from './fixtures/club-not-found.json';
import unavailable from './fixtures/envelope-unavailable.json';
import matchInfo from './fixtures/matchinfo-2911141.json';
import schedule from './fixtures/spielplan-54379.json';
import table from './fixtures/table-54308.json';
import tableNotFound from './fixtures/table-not-found.json';
import teamMatches from './fixtures/team-313036-matches.json';
import teamNotFound from './fixtures/team-not-found.json';
import wamData from './fixtures/wam-data-bayern-u14.json';
import secondPage from './fixtures/wam-liga-list-bayern-u14-10.json';
import allLeagues from './fixtures/wam-data-alle.json';
import niedersachsen from './fixtures/wam-data-niedersachsen.json';
import niedersachsenU12 from './fixtures/wam-data-niedersachsen-u12.json';
import firstRoundSchedule from './fixtures/spielplan-54862.json';
import nsU12mFirst from './fixtures/wam-data-niedersachsen-u12-jugend-maennlich.json';
import nsU12mSecond from './fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-10.json';
import nsU12mThird from './fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-20.json';

const BAYERN_U14: LeagueSearchFilter = {
  ...NO_LEAGUE_FILTER,
  associationIds: [2],
  ageGroupIds: [14],
};

const NIEDERSACHSEN_U12_YOUTH_MALE: LeagueSearchFilter = {
  associationIds: [7],
  ageGroupIds: [12],
  ageGroupGenderIds: ['2_1'],
};

/** The recorded pages of the male U12 youth Ligen of Niedersachsen. */
const NS_U12M_PAGES: ReadonlyMap<number, unknown> = new Map([
  [10, nsU12mSecond],
  [20, nsU12mThird],
]);

/** A transport that answers each kind of read with one recorded response. */
class FakeTransport {
  public readonly requests: DbbRequest[] = [];

  public constructor(
    private readonly responses: Partial<Record<DbbRequestKind, unknown>>
  ) {}

  public readonly send = async (request: DbbRequest): Promise<unknown> => {
    this.requests.push(request);
    const response = this.responses[request.kind];
    if (response === undefined) {
      throw new Error(`no fixture for ${request.kind}`);
    }
    return response;
  };
}

function dataWith(responses: Partial<Record<DbbRequestKind, unknown>>): {
  data: DbbBasketballData;
  transport: FakeTransport;
} {
  const transport = new FakeTransport(responses);
  return { data: new DbbBasketballData(transport.send), transport };
}

describe('DbbBasketballData', () => {
  it('searches Ligen with the filter and pages through the list call', async () => {
    const { data, transport } = dataWith({
      'league-search': wamData,
      'league-page': secondPage,
    });

    const search = await data.leagueSearch(BAYERN_U14);
    const page = await data.leaguePage(
      BAYERN_U14,
      search.firstPage.leagues.length
    );

    expect(search.facets.associations.length).toBeGreaterThan(0);
    expect(page.startIndex).toBe(10);
    expect(transport.requests).toEqual([
      { kind: 'league-search', filter: BAYERN_U14 },
      { kind: 'league-page', filter: BAYERN_U14, startIndex: 10 },
    ]);
  });

  it('offers each Verband that has Ligen when nothing is picked yet', async () => {
    const { data } = dataWith({ 'league-search': allLeagues });

    const { associations } = (await data.leagueSearch(NO_LEAGUE_FILTER)).facets;

    expect(offered(associations)).toContainEqual({
      id: 7,
      name: 'Niedersachsen',
      hits: 252,
    });
    expect(offered(associations)).toHaveLength(23);
  });

  it('offers the age groups a Verband has, and none it lacks', async () => {
    const { data } = dataWith({ 'league-search': niedersachsen });

    const { ageGroups } = (
      await data.leagueSearch({ ...NO_LEAGUE_FILTER, associationIds: [7] })
    ).facets;

    const names = offered(ageGroups).map((facet) => facet.name);
    expect(names).toContain('U12');
    expect(names).not.toContain('U19');
  });

  it('offers the genders of the picked age group only', async () => {
    const { data } = dataWith({ 'league-search': niedersachsenU12 });

    const { ageGroupGenders } = (
      await data.leagueSearch({
        ...NO_LEAGUE_FILTER,
        associationIds: [7],
        ageGroupIds: [12],
      })
    ).facets;

    expect(offered(ageGroupGenders)).toEqual([
      { id: '2_1', name: 'Jugend männlich', hits: 28 },
      { id: '2_2', name: 'Jugend weiblich', hits: 8 },
    ]);
  });

  it('pages through the Ligen of a filter until there are no more', async () => {
    const requests: DbbRequest[] = [];
    const data = new DbbBasketballData(async (request) => {
      requests.push(request);
      return request.kind === 'league-page'
        ? NS_U12M_PAGES.get(request.startIndex)
        : nsU12mFirst;
    });

    const filter = NIEDERSACHSEN_U12_YOUTH_MALE;
    const pages = [(await data.leagueSearch(filter)).firstPage];
    for (
      let start = nextStartIndex(pages[0]);
      start !== undefined;
      start = nextStartIndex(pages[pages.length - 1])
    ) {
      pages.push(await data.leaguePage(filter, start));
    }

    expect(pages.map((page) => page.startIndex)).toEqual([0, 10, 20]);
    expect(pages.flatMap((page) => page.leagues)).toHaveLength(28);
    expect(pages[1].leagues.map((league) => league.id)).toContain(54862);
    expect(requests).toEqual([
      { kind: 'league-search', filter },
      { kind: 'league-page', filter, startIndex: 10 },
      { kind: 'league-page', filter, startIndex: 20 },
    ]);
  });

  it('reads the Teams of a Liga from its Spielplan', async () => {
    const { data, transport } = dataWith({ schedule });

    expect((await data.leagueTeams(54379)).map((team) => team.id)).toEqual([
      281627, 234544, 314384, 317492,
    ]);
    expect(transport.requests).toEqual([{ kind: 'schedule', leagueId: 54379 }]);
  });

  it('reads every Team of a Liga with its Verein, each once', async () => {
    const { data } = dataWith({ schedule: firstRoundSchedule });

    expect(await data.leagueTeams(54862)).toEqual([
      { id: 201500, name: 'MTV Gifhorn', clubId: 645 },
      { id: 313036, name: 'MTV Wasbüttel -RST-', clubId: 1837 },
      { id: 320898, name: 'SV Groß Oesingen -RST-', clubId: 5256 },
      { id: 322695, name: 'SV Groß Schwülper', clubId: 4332 },
      { id: 319164, name: 'TuS Müden-Dieckhorst -RST/aK-', clubId: 3890 },
      {
        id: 313040,
        name: 'TV Jahn Wolfsburg Honeybadgers -RST-',
        clubId: 2486,
      },
    ]);
  });

  it('reads a Verein’s Teams from its Spiele of four weeks either way', async () => {
    const { data, transport } = dataWith({ 'club-games': clubMatches });

    expect((await data.clubTeams(1476)).club.name).toBe('Post SV Nürnberg');
    expect(transport.requests).toEqual([
      { kind: 'club-games', clubId: 1476, days: 28 },
    ]);
  });

  it('reads a Verein alone from its Spiele of the nearest days only', async () => {
    const { data, transport } = dataWith({ 'club-games': clubMatches });

    expect(await data.club(1476)).toEqual({
      id: 1476,
      name: 'Post SV Nürnberg',
    });
    expect(transport.requests).toEqual([
      { kind: 'club-games', clubId: 1476, days: 1 },
    ]);
  });

  it('rejects a Verein the DBB does not know as not found', async () => {
    const { data } = dataWith({ 'club-games': clubNotFound });

    expect((await rejectedError(() => data.club(1))).kind).toBe('not-found');
  });

  it('rejects a Verein id the DBB cannot have as not found, without asking it', async () => {
    const { data, transport } = dataWith({ 'club-games': clubMatches });

    expect((await rejectedError(() => data.club(0))).kind).toBe('not-found');
    expect(transport.requests).toEqual([]);
  });

  it('reads a Team’s Spiele across its Ligen', async () => {
    const { data } = dataWith({ 'team-games': teamMatches });

    const season = await data.teamGames(313036);

    expect(season.leagues).toHaveLength(2);
    expect(season.games).toHaveLength(6);
  });

  it('reads the Tabelle, the Spiel and its Spielbericht', async () => {
    const { data, transport } = dataWith({
      standings: table,
      'game-info': matchInfo,
      'game-report': withStats,
    });

    expect((await data.standings(54308)).rows).toHaveLength(7);
    expect((await data.game(2911141)).venue?.name).toBe('Paul-Moor-Schule');
    expect((await data.gameReport(2911141))?.home.playerStatsRecorded).toBe(
      true
    );
    expect(transport.requests.map((request) => request.kind)).toEqual([
      'standings',
      'game-info',
      'game-report',
    ]);
  });

  it('reads a Spiel without Spielbericht as such', async () => {
    const { data } = dataWith({ 'game-report': noReport });

    await expect(data.gameReport(2843814)).resolves.toBeUndefined();
  });

  it.each([
    ['a Liga', () => dataWith({ standings: tableNotFound }).data.standings(1)],
    [
      'a Team',
      () => dataWith({ 'team-games': teamNotFound }).data.teamGames(1),
    ],
    [
      'a Spiel',
      () => dataWith({ 'game-report': boxscoreNotFound }).data.gameReport(1),
    ],
  ])('rejects %s the DBB does not know as not found', async (_case, read) => {
    expect((await rejectedError(read)).kind).toBe('not-found');
  });

  it('rejects an id the DBB cannot have as not found, without asking it', async () => {
    const { data, transport } = dataWith({ standings: table });

    expect((await rejectedError(() => data.standings(-1))).kind).toBe(
      'not-found'
    );
    expect(transport.requests).toEqual([]);
  });

  it.each<[string, (data: DbbBasketballData) => Promise<unknown>]>([
    [
      'a negative start index',
      (data) => data.leaguePage(NO_LEAGUE_FILTER, -10),
    ],
    [
      'a malformed age group and gender id',
      (data) =>
        data.leagueSearch({
          ...NO_LEAGUE_FILTER,
          ageGroupGenderIds: ['x'],
        }),
    ],
    [
      'a Verband id that is no id',
      (data) => data.leagueSearch({ ...NO_LEAGUE_FILTER, associationIds: [0] }),
    ],
  ])(
    'lets %s, a caller’s bug, throw before asking the DBB',
    async (_case, read) => {
      const { data, transport } = dataWith({
        'league-search': wamData,
        'league-page': secondPage,
      });

      await expect(read(data)).rejects.toBeInstanceOf(RangeError);
      expect(transport.requests).toEqual([]);
    }
  );

  it('rejects a DBB server error as unavailable', async () => {
    const { data } = dataWith({ standings: unavailable });

    expect((await rejectedError(() => data.standings(54308))).kind).toBe(
      'unavailable'
    );
  });

  it('rejects a transport failure as unavailable, keeping its cause', async () => {
    const cause = new TypeError('fetch failed');
    const data = new DbbBasketballData(() => Promise.reject(cause));

    const error = await rejectedError(() => data.game(2911141));

    expect(error.kind).toBe('unavailable');
    expect(error.cause).toBe(cause);
  });

  it('rejects even a RangeError of the transport as unavailable', async () => {
    const cause = new RangeError('Invalid time value');
    const data = new DbbBasketballData(() => Promise.reject(cause));

    const error = await rejectedError(() => data.game(2911141));

    expect(error.kind).toBe('unavailable');
    expect(error.cause).toBe(cause);
  });

  it.each(['not-found', 'offline'] as const)(
    'passes on a typed %s error the transport throws itself',
    async (kind) => {
      const own = new BasketballDataError(kind, 'proxy: nope');
      const data = new DbbBasketballData(() => Promise.reject(own));

      expect(await rejectedError(() => data.game(2911141))).toBe(own);
    }
  );

  it('rejects a response of the wrong shape as unexpected', async () => {
    const { data } = dataWith({
      'game-info': { status: '0', data: { matchId: 'x' } },
    });

    expect((await rejectedError(() => data.game(2911141))).kind).toBe(
      'unexpected-shape'
    );
  });
  describe('cancelling', () => {
    const reads: ReadonlyArray<
      [
        string,
        (data: DbbBasketballData, signal: AbortSignal) => Promise<unknown>,
      ]
    > = [
      [
        'leagueSearch',
        (data, signal) => data.leagueSearch(BAYERN_U14, { signal }),
      ],
      [
        'leaguePage',
        (data, signal) => data.leaguePage(BAYERN_U14, 10, { signal }),
      ],
      ['leagueTeams', (data, signal) => data.leagueTeams(54379, { signal })],
      ['clubTeams', (data, signal) => data.clubTeams(1476, { signal })],
      ['club', (data, signal) => data.club(1476, { signal })],
      ['teamGames', (data, signal) => data.teamGames(313036, { signal })],
      ['standings', (data, signal) => data.standings(54308, { signal })],
      ['game', (data, signal) => data.game(2911141, { signal })],
      ['gameReport', (data, signal) => data.gameReport(2911141, { signal })],
    ];

    it.each(reads)(
      'hands the signal of %s to the transport',
      async (_read, read) => {
        const transport = jest.fn<Promise<unknown>, Parameters<DbbTransport>>(
          async () => {
            throw new TypeError('fetch failed');
          }
        );
        const { signal } = new AbortController();

        await read(new DbbBasketballData(transport), signal).catch(
          () => undefined
        );

        expect(transport).toHaveBeenCalledWith(expect.anything(), { signal });
      }
    );

    it("hands the read's options to the transport as they are, typed fields of the transport's own too", async () => {
      interface OwnOptions extends ReadOptions {
        readonly eigenes: number;
      }
      const transport = jest.fn<
        Promise<unknown>,
        Parameters<DbbTransport<OwnOptions>>
      >(async () => {
        throw new TypeError('fetch failed');
      });
      const options: OwnOptions = {
        signal: new AbortController().signal,
        eigenes: 1,
      };

      await new DbbBasketballData<OwnOptions>(transport)
        .teamGames(313036, options)
        .catch(() => undefined);

      expect(transport.mock.calls[0][1]).toBe(options);
      expect(transport.mock.calls[0][1]?.eigenes).toBe(1);
    });

    it('rejects a cancelled read with the reason it was cancelled for', async () => {
      const controller = new AbortController();
      const transport: DbbTransport = (_request, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () =>
            reject(new TypeError('aborted fetch'))
          )
        );
      const read = new DbbBasketballData(transport).teamGames(313036, {
        signal: controller.signal,
      });

      const reason = new Error('navigated away');
      controller.abort(reason);

      await expect(read).rejects.toBe(reason);
    });

    it('takes any signal of the shape a read needs, not only a DOM one', async () => {
      const reason = new Error('navigated away');
      const signal = {
        aborted: true,
        reason,
        throwIfAborted: (): never => {
          throw reason;
        },
        addEventListener: (): void => undefined,
      };

      await expect(
        new DbbBasketballData(async () => teamMatches).teamGames(313036, {
          signal,
        })
      ).rejects.toBe(reason);
    });

    it('asks nothing for a read cancelled before it began', async () => {
      const transport = jest.fn<Promise<unknown>, Parameters<DbbTransport>>();
      const reason = new Error('navigated away');

      await expect(
        new DbbBasketballData(transport).teamGames(313036, {
          signal: AbortSignal.abort(reason),
        })
      ).rejects.toBe(reason);
      expect(transport).not.toHaveBeenCalled();
    });
  });
});
