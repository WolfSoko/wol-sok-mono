import { rejectedError } from '../../testing/caught-error';
import { BasketballDataError } from '../domain/basketball-data-error';
import { KEIN_LIGA_FILTER, type LigaSucheFilter } from '../domain/liga-suche';
import { DbbBasketballData, VEREINS_SPIELE_TAGE } from './dbb-basketball-data';
import type { DbbRequest, DbbRequestKind } from './dbb-request';
import boxscoreNotFound from './fixtures/boxscore-not-found.json';
import keinBericht from './fixtures/boxscore-2843814.json';
import mitWerten from './fixtures/boxscore-2911141.json';
import clubMatches from './fixtures/club-1476-actualmatches.json';
import unavailable from './fixtures/envelope-unavailable.json';
import matchInfo from './fixtures/matchinfo-2911141.json';
import spielplan from './fixtures/spielplan-54379.json';
import table from './fixtures/table-54308.json';
import tableNotFound from './fixtures/table-not-found.json';
import teamMatches from './fixtures/team-313036-matches.json';
import teamNotFound from './fixtures/team-not-found.json';
import wamData from './fixtures/wam-data-bayern-u14.json';
import zweiteSeite from './fixtures/wam-liga-list-bayern-u14-10.json';

const BAYERN_U14: LigaSucheFilter = {
  ...KEIN_LIGA_FILTER,
  verbandIds: [2],
  altersklasseIds: [14],
};

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
      'liga-suche': wamData,
      'liga-seite': zweiteSeite,
    });

    const suche = await data.ligaSuche(BAYERN_U14);
    const seite = await data.ligaSeite(
      BAYERN_U14,
      suche.ersteSeite.ligen.length
    );

    expect(suche.facetten.verbaende.length).toBeGreaterThan(0);
    expect(seite.startIndex).toBe(10);
    expect(transport.requests).toEqual([
      { kind: 'liga-suche', filter: BAYERN_U14 },
      { kind: 'liga-seite', filter: BAYERN_U14, startIndex: 10 },
    ]);
  });

  it('reads the Teams of a Liga from its Spielplan', async () => {
    const { data, transport } = dataWith({ spielplan });

    expect((await data.ligaTeams(54379)).map((team) => team.id)).toEqual([
      281627, 234544, 314384, 317492,
    ]);
    expect(transport.requests).toEqual([{ kind: 'spielplan', ligaId: 54379 }]);
  });

  it('reads a Verein’s Teams from its Spiele of the weeks around today', async () => {
    const { data, transport } = dataWith({ 'vereins-spiele': clubMatches });

    expect((await data.vereinsTeams(1476)).verein.name).toBe(
      'Post SV Nürnberg'
    );
    expect(transport.requests).toEqual([
      { kind: 'vereins-spiele', vereinId: 1476, tage: VEREINS_SPIELE_TAGE },
    ]);
  });

  it('reads a Team’s Spiele across its Ligen', async () => {
    const { data } = dataWith({ 'team-spiele': teamMatches });

    const saison = await data.teamSpiele(313036);

    expect(saison.ligen).toHaveLength(2);
    expect(saison.spiele).toHaveLength(6);
  });

  it('reads the Tabelle, the Spiel and its Spielbericht', async () => {
    const { data, transport } = dataWith({
      tabelle: table,
      'spiel-info': matchInfo,
      spielbericht: mitWerten,
    });

    expect((await data.tabelle(54308)).zeilen).toHaveLength(7);
    expect((await data.spiel(2911141)).halle?.name).toBe('Paul-Moor-Schule');
    expect((await data.spielbericht(2911141))?.spielerwerteErfasst).toBe(true);
    expect(transport.requests.map((request) => request.kind)).toEqual([
      'tabelle',
      'spiel-info',
      'spielbericht',
    ]);
  });

  it('reads a Spiel without Spielbericht as such', async () => {
    const { data } = dataWith({ spielbericht: keinBericht });

    await expect(data.spielbericht(2843814)).resolves.toBeUndefined();
  });

  it.each([
    ['a Liga', () => dataWith({ tabelle: tableNotFound }).data.tabelle(1)],
    [
      'a Team',
      () => dataWith({ 'team-spiele': teamNotFound }).data.teamSpiele(1),
    ],
    [
      'a Spiel',
      () => dataWith({ spielbericht: boxscoreNotFound }).data.spielbericht(1),
    ],
  ])('rejects %s the DBB does not know as not found', async (_case, read) => {
    expect((await rejectedError(read)).kind).toBe('not-found');
  });

  it('rejects an id the DBB cannot have as not found, without asking it', async () => {
    const { data, transport } = dataWith({ tabelle: table });

    expect((await rejectedError(() => data.tabelle(-1))).kind).toBe(
      'not-found'
    );
    expect(transport.requests).toEqual([]);
  });

  it.each<[string, (data: DbbBasketballData) => Promise<unknown>]>([
    ['a negative start index', (data) => data.ligaSeite(KEIN_LIGA_FILTER, -10)],
    [
      'a malformed age group and gender id',
      (data) =>
        data.ligaSuche({
          ...KEIN_LIGA_FILTER,
          altersgruppeGeschlechtIds: ['x'],
        }),
    ],
    [
      'a Verband id that is no id',
      (data) => data.ligaSuche({ ...KEIN_LIGA_FILTER, verbandIds: [0] }),
    ],
  ])(
    'lets %s, a caller’s bug, throw before asking the DBB',
    async (_case, read) => {
      const { data, transport } = dataWith({
        'liga-suche': wamData,
        'liga-seite': zweiteSeite,
      });

      await expect(read(data)).rejects.toBeInstanceOf(RangeError);
      expect(transport.requests).toEqual([]);
    }
  );

  it('rejects a DBB server error as unavailable', async () => {
    const { data } = dataWith({ tabelle: unavailable });

    expect((await rejectedError(() => data.tabelle(54308))).kind).toBe(
      'unavailable'
    );
  });

  it('rejects a transport failure as unavailable, keeping its cause', async () => {
    const cause = new TypeError('fetch failed');
    const data = new DbbBasketballData(() => Promise.reject(cause));

    const error = await rejectedError(() => data.spiel(2911141));

    expect(error.kind).toBe('unavailable');
    expect(error.cause).toBe(cause);
  });

  it('rejects even a RangeError of the transport as unavailable', async () => {
    const cause = new RangeError('Invalid time value');
    const data = new DbbBasketballData(() => Promise.reject(cause));

    const error = await rejectedError(() => data.spiel(2911141));

    expect(error.kind).toBe('unavailable');
    expect(error.cause).toBe(cause);
  });

  it('passes on a typed error the transport throws itself', async () => {
    const own = new BasketballDataError('not-found', 'proxy: 404');
    const data = new DbbBasketballData(() => Promise.reject(own));

    expect(await rejectedError(() => data.spiel(2911141))).toBe(own);
  });

  it('rejects a response of the wrong shape as unexpected', async () => {
    const { data } = dataWith({
      'spiel-info': { status: '0', data: { matchId: 'x' } },
    });

    expect((await rejectedError(() => data.spiel(2911141))).kind).toBe(
      'unexpected-shape'
    );
  });
});
