import {
  NO_LEAGUE_FILTER,
  type LeagueSearchFilter,
} from '../domain/league-search';
import {
  dbbFetchInput,
  dbbHttpRequest,
  assertValidDbbRequest,
  dbbIdOf,
  isDbbId,
  parseDbbId,
  type DbbRequest,
} from './dbb-request';

const BAYERN_U14: LeagueSearchFilter = {
  associationIds: [2],
  ageGroupIds: [14],
  ageGroupGenderIds: ['2_1'],
};

const FILTER_BODY = {
  token: 0,
  verbandIds: [2],
  gebietIds: [],
  ligatypIds: [],
  akgGeschlechtIds: ['2_1'],
  altersklasseIds: [14],
  spielklasseIds: [],
  sortBy: 0,
};

describe('dbbFetchInput', () => {
  const HEADERS = { 'user-agent': 'Korbjaeger/test' };

  it('reads a GET under the base URL with the given headers', () => {
    expect(
      dbbFetchInput(
        'https://dbb.test/rest/',
        dbbHttpRequest({ kind: 'team-games', teamId: 313036 }),
        HEADERS
      )
    ).toEqual({
      url: 'https://dbb.test/rest/team/id/313036/matches',
      method: 'GET',
      headers: HEADERS,
      body: undefined,
    });
  });

  it('drops every trailing slash of the base URL, also a long run of them', () => {
    const slashes = '/'.repeat(100_000);
    const http = dbbHttpRequest({ kind: 'team-games', teamId: 313036 });

    expect(
      dbbFetchInput(`https://dbb.test/rest${slashes}`, http, HEADERS).url
    ).toBe('https://dbb.test/rest/team/id/313036/matches');
    expect(dbbFetchInput(slashes, http, HEADERS).url).toBe(
      '/team/id/313036/matches'
    );
  });

  it('sends a POST its body as JSON', () => {
    const http = dbbHttpRequest({ kind: 'league-search', filter: BAYERN_U14 });

    expect(dbbFetchInput('https://dbb.test/rest', http, HEADERS)).toEqual({
      url: 'https://dbb.test/rest/wam/data',
      method: 'POST',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify(http.method === 'POST' ? http.body : undefined),
    });
  });
});

describe('dbbHttpRequest', () => {
  it('posts the Liga search with the filter as the DBB body', () => {
    expect(
      dbbHttpRequest({ kind: 'league-search', filter: BAYERN_U14 })
    ).toEqual({
      method: 'POST',
      path: 'wam/data',
      body: FILTER_BODY,
    });
  });

  it('pages the Liga list through its own call', () => {
    expect(
      dbbHttpRequest({
        kind: 'league-page',
        filter: BAYERN_U14,
        startIndex: 10,
      })
    ).toEqual({
      method: 'POST',
      path: 'wam/liga/list?startAtIndex=10',
      body: FILTER_BODY,
    });
  });

  it.each<[DbbRequest, string]>([
    [{ kind: 'standings', leagueId: 54308 }, 'competition/table/id/54308'],
    [{ kind: 'schedule', leagueId: 54308 }, 'competition/spielplan/id/54308'],
    [{ kind: 'team-games', teamId: 313036 }, 'team/id/313036/matches'],
    [
      { kind: 'club-games', clubId: 1476, days: 7 },
      'club/id/1476/actualmatches?rangeDays=7',
    ],
    [{ kind: 'game-info', gameId: 2911141 }, 'match/id/2911141/matchInfo'],
    [{ kind: 'game-report', gameId: 2911141 }, 'match/id/2911141/boxscore'],
  ])('gets %j from %s', (request, path) => {
    expect(dbbHttpRequest(request)).toEqual({ method: 'GET', path });
  });

  it.each<DbbRequest>([
    { kind: 'standings', leagueId: 0 },
    { kind: 'standings', leagueId: -3 },
    { kind: 'standings', leagueId: 1.5 },
    { kind: 'game-info', gameId: Number.NaN },
    { kind: 'league-page', filter: NO_LEAGUE_FILTER, startIndex: -10 },
    { kind: 'club-games', clubId: 1476, days: 0 },
    { kind: 'club-games', clubId: 1476, days: 61 },
    {
      kind: 'league-search',
      filter: { ...NO_LEAGUE_FILTER, associationIds: [0] },
    },
    {
      kind: 'league-search',
      filter: { ...NO_LEAGUE_FILTER, ageGroupGenderIds: ['2_1/../x'] },
    },
  ])('refuses %j', (request) => {
    expect(() => dbbHttpRequest(request)).toThrow(RangeError);
  });
});

describe('dbbIdOf', () => {
  it.each<[DbbRequest, number | undefined]>([
    [{ kind: 'league-search', filter: NO_LEAGUE_FILTER }, undefined],
    [
      { kind: 'league-page', filter: NO_LEAGUE_FILTER, startIndex: 10 },
      undefined,
    ],
    [{ kind: 'standings', leagueId: 54308 }, 54308],
    [{ kind: 'schedule', leagueId: 54379 }, 54379],
    [{ kind: 'team-games', teamId: 313036 }, 313036],
    [{ kind: 'club-games', clubId: 1476, days: 7 }, 1476],
    [{ kind: 'game-info', gameId: 2911141 }, 2911141],
    [{ kind: 'game-report', gameId: 2843811 }, 2843811],
  ])('names the id %j reads', (request, id) => {
    expect(dbbIdOf(request)).toBe(id);
  });
});

describe('isDbbId', () => {
  it('takes positive integers only', () => {
    expect([1, 54308].map(isDbbId)).toEqual([true, true]);
    expect(
      [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1].map(isDbbId)
    ).toEqual([false, false, false, false, false]);
  });
});

describe('parseDbbId', () => {
  it('reads the digits of a DBB id', () => {
    expect(['1', '313036'].map(parseDbbId)).toEqual([1, 313036]);
  });

  it.each([
    ['nothing', undefined],
    ['an empty text', ''],
    ['letters', 'abc'],
    ['digits and letters', '313036abc'],
    ['a sign', '-1'],
    ['a plus', '+1'],
    ['a fraction', '1.5'],
    ['spaces', ' 1'],
    ['an exponent', '1e3'],
    ['0', '0'],
    ['an id too large to be exact', '9007199254740993'],
  ])('reads no id from %s', (_case, text) => {
    expect(parseDbbId(text)).toBeUndefined();
  });
});

describe('assertValidDbbRequest', () => {
  it('takes a request dbbHttpRequest can build', () => {
    expect(() =>
      assertValidDbbRequest({
        kind: 'league-page',
        filter: BAYERN_U14,
        startIndex: 10,
      })
    ).not.toThrow();
    expect(() =>
      assertValidDbbRequest({ kind: 'club-games', clubId: 1476, days: 7 })
    ).not.toThrow();
  });

  it.each<DbbRequest>([
    { kind: 'standings', leagueId: 0 },
    { kind: 'league-page', filter: NO_LEAGUE_FILTER, startIndex: -10 },
    { kind: 'club-games', clubId: 1476, days: 61 },
    {
      kind: 'league-search',
      filter: { ...NO_LEAGUE_FILTER, ageGroupIds: [1.5] },
    },
    {
      kind: 'league-search',
      filter: { ...NO_LEAGUE_FILTER, ageGroupGenderIds: ['x'] },
    },
  ])('refuses %j without building it', (request) => {
    expect(() => assertValidDbbRequest(request)).toThrow(RangeError);
  });
});
