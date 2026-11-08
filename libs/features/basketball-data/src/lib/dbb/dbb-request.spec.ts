import { KEIN_LIGA_FILTER, type LigaSucheFilter } from '../domain/liga-suche';
import {
  dbbHttpRequest,
  assertValidDbbRequest,
  dbbIdOf,
  isDbbId,
  parseDbbId,
  type DbbRequest,
} from './dbb-request';

const BAYERN_U14: LigaSucheFilter = {
  verbandIds: [2],
  altersklasseIds: [14],
  altersgruppeGeschlechtIds: ['2_1'],
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

describe('dbbHttpRequest', () => {
  it('posts the Liga search with the filter as the DBB body', () => {
    expect(dbbHttpRequest({ kind: 'liga-suche', filter: BAYERN_U14 })).toEqual({
      method: 'POST',
      path: 'wam/data',
      body: FILTER_BODY,
    });
  });

  it('pages the Liga list through its own call', () => {
    expect(
      dbbHttpRequest({ kind: 'liga-seite', filter: BAYERN_U14, startIndex: 10 })
    ).toEqual({
      method: 'POST',
      path: 'wam/liga/list?startAtIndex=10',
      body: FILTER_BODY,
    });
  });

  it.each<[DbbRequest, string]>([
    [{ kind: 'tabelle', ligaId: 54308 }, 'competition/table/id/54308'],
    [{ kind: 'spielplan', ligaId: 54308 }, 'competition/spielplan/id/54308'],
    [{ kind: 'team-spiele', teamId: 313036 }, 'team/id/313036/matches'],
    [
      { kind: 'vereins-spiele', vereinId: 1476, tage: 7 },
      'club/id/1476/actualmatches?rangeDays=7',
    ],
    [{ kind: 'spiel-info', spielId: 2911141 }, 'match/id/2911141/matchInfo'],
    [{ kind: 'spielbericht', spielId: 2911141 }, 'match/id/2911141/boxscore'],
  ])('gets %j from %s', (request, path) => {
    expect(dbbHttpRequest(request)).toEqual({ method: 'GET', path });
  });

  it.each<DbbRequest>([
    { kind: 'tabelle', ligaId: 0 },
    { kind: 'tabelle', ligaId: -3 },
    { kind: 'tabelle', ligaId: 1.5 },
    { kind: 'spiel-info', spielId: Number.NaN },
    { kind: 'liga-seite', filter: KEIN_LIGA_FILTER, startIndex: -10 },
    { kind: 'vereins-spiele', vereinId: 1476, tage: 0 },
    { kind: 'vereins-spiele', vereinId: 1476, tage: 61 },
    { kind: 'liga-suche', filter: { ...KEIN_LIGA_FILTER, verbandIds: [0] } },
    {
      kind: 'liga-suche',
      filter: { ...KEIN_LIGA_FILTER, altersgruppeGeschlechtIds: ['2_1/../x'] },
    },
  ])('refuses %j', (request) => {
    expect(() => dbbHttpRequest(request)).toThrow(RangeError);
  });
});

describe('dbbIdOf', () => {
  it.each<[DbbRequest, number | undefined]>([
    [{ kind: 'liga-suche', filter: KEIN_LIGA_FILTER }, undefined],
    [
      { kind: 'liga-seite', filter: KEIN_LIGA_FILTER, startIndex: 10 },
      undefined,
    ],
    [{ kind: 'tabelle', ligaId: 54308 }, 54308],
    [{ kind: 'spielplan', ligaId: 54379 }, 54379],
    [{ kind: 'team-spiele', teamId: 313036 }, 313036],
    [{ kind: 'vereins-spiele', vereinId: 1476, tage: 7 }, 1476],
    [{ kind: 'spiel-info', spielId: 2911141 }, 2911141],
    [{ kind: 'spielbericht', spielId: 2843811 }, 2843811],
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
        kind: 'liga-seite',
        filter: BAYERN_U14,
        startIndex: 10,
      })
    ).not.toThrow();
    expect(() =>
      assertValidDbbRequest({ kind: 'vereins-spiele', vereinId: 1476, tage: 7 })
    ).not.toThrow();
  });

  it.each<DbbRequest>([
    { kind: 'tabelle', ligaId: 0 },
    { kind: 'liga-seite', filter: KEIN_LIGA_FILTER, startIndex: -10 },
    { kind: 'vereins-spiele', vereinId: 1476, tage: 61 },
    {
      kind: 'liga-suche',
      filter: { ...KEIN_LIGA_FILTER, altersklasseIds: [1.5] },
    },
    {
      kind: 'liga-suche',
      filter: { ...KEIN_LIGA_FILTER, altersgruppeGeschlechtIds: ['x'] },
    },
  ])('refuses %j without building it', (request) => {
    expect(() => assertValidDbbRequest(request)).toThrow(RangeError);
  });
});
