import { rejectedError } from '../../testing/caught-error';
import { BasketballDataError } from '../domain/basketball-data-error';
import {
  KEIN_LIGA_FILTER,
  angeboten,
  naechsterStartIndex,
  type LigaSucheFilter,
} from '../domain/liga-suche';
import { DbbBasketballData } from './dbb-basketball-data';
import {
  type DbbRequest,
  type DbbRequestKind,
  type DbbTransport,
} from './dbb-request';
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
import alleLigen from './fixtures/wam-data-alle.json';
import niedersachsen from './fixtures/wam-data-niedersachsen.json';
import niedersachsenU12 from './fixtures/wam-data-niedersachsen-u12.json';
import vorrundeSpielplan from './fixtures/spielplan-54862.json';
import nsU12mErste from './fixtures/wam-data-niedersachsen-u12-jugend-maennlich.json';
import nsU12mZweite from './fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-10.json';
import nsU12mDritte from './fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-20.json';

const BAYERN_U14: LigaSucheFilter = {
  ...KEIN_LIGA_FILTER,
  verbandIds: [2],
  altersklasseIds: [14],
};

const NIEDERSACHSEN_U12_JUGEND_MAENNLICH: LigaSucheFilter = {
  verbandIds: [7],
  altersklasseIds: [12],
  altersgruppeGeschlechtIds: ['2_1'],
};

/** The recorded pages of the male U12 youth Ligen of Niedersachsen. */
const NS_U12M_SEITEN: ReadonlyMap<number, unknown> = new Map([
  [10, nsU12mZweite],
  [20, nsU12mDritte],
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

  it('offers each Verband that has Ligen when nothing is picked yet', async () => {
    const { data } = dataWith({ 'liga-suche': alleLigen });

    const { verbaende } = (await data.ligaSuche(KEIN_LIGA_FILTER)).facetten;

    expect(angeboten(verbaende)).toContainEqual({
      id: 7,
      name: 'Niedersachsen',
      treffer: 252,
    });
    expect(angeboten(verbaende)).toHaveLength(23);
  });

  it('offers the age groups a Verband has, and none it lacks', async () => {
    const { data } = dataWith({ 'liga-suche': niedersachsen });

    const { altersklassen } = (
      await data.ligaSuche({ ...KEIN_LIGA_FILTER, verbandIds: [7] })
    ).facetten;

    const namen = angeboten(altersklassen).map((facette) => facette.name);
    expect(namen).toContain('U12');
    expect(namen).not.toContain('U19');
  });

  it('offers the genders of the picked age group only', async () => {
    const { data } = dataWith({ 'liga-suche': niedersachsenU12 });

    const { altersgruppenGeschlechter } = (
      await data.ligaSuche({
        ...KEIN_LIGA_FILTER,
        verbandIds: [7],
        altersklasseIds: [12],
      })
    ).facetten;

    expect(angeboten(altersgruppenGeschlechter)).toEqual([
      { id: '2_1', name: 'Jugend männlich', treffer: 28 },
      { id: '2_2', name: 'Jugend weiblich', treffer: 8 },
    ]);
  });

  it('pages through the Ligen of a filter until there are no more', async () => {
    const requests: DbbRequest[] = [];
    const data = new DbbBasketballData(async (request) => {
      requests.push(request);
      return request.kind === 'liga-seite'
        ? NS_U12M_SEITEN.get(request.startIndex)
        : nsU12mErste;
    });

    const filter = NIEDERSACHSEN_U12_JUGEND_MAENNLICH;
    const seiten = [(await data.ligaSuche(filter)).ersteSeite];
    for (
      let start = naechsterStartIndex(seiten[0]);
      start !== undefined;
      start = naechsterStartIndex(seiten[seiten.length - 1])
    ) {
      seiten.push(await data.ligaSeite(filter, start));
    }

    expect(seiten.map((seite) => seite.startIndex)).toEqual([0, 10, 20]);
    expect(seiten.flatMap((seite) => seite.ligen)).toHaveLength(28);
    expect(seiten[1].ligen.map((liga) => liga.id)).toContain(54862);
    expect(requests).toEqual([
      { kind: 'liga-suche', filter },
      { kind: 'liga-seite', filter, startIndex: 10 },
      { kind: 'liga-seite', filter, startIndex: 20 },
    ]);
  });

  it('reads the Teams of a Liga from its Spielplan', async () => {
    const { data, transport } = dataWith({ spielplan });

    expect((await data.ligaTeams(54379)).map((team) => team.id)).toEqual([
      281627, 234544, 314384, 317492,
    ]);
    expect(transport.requests).toEqual([{ kind: 'spielplan', ligaId: 54379 }]);
  });

  it('reads every Team of a Liga with its Verein, each once', async () => {
    const { data } = dataWith({ spielplan: vorrundeSpielplan });

    expect(await data.ligaTeams(54862)).toEqual([
      { id: 201500, name: 'MTV Gifhorn', vereinId: 645 },
      { id: 313036, name: 'MTV Wasbüttel -RST-', vereinId: 1837 },
      { id: 320898, name: 'SV Groß Oesingen -RST-', vereinId: 5256 },
      { id: 322695, name: 'SV Groß Schwülper', vereinId: 4332 },
      { id: 319164, name: 'TuS Müden-Dieckhorst -RST/aK-', vereinId: 3890 },
      {
        id: 313040,
        name: 'TV Jahn Wolfsburg Honeybadgers -RST-',
        vereinId: 2486,
      },
    ]);
  });

  it('reads a Verein’s Teams from its Spiele of four weeks either way', async () => {
    const { data, transport } = dataWith({ 'vereins-spiele': clubMatches });

    expect((await data.vereinsTeams(1476)).verein.name).toBe(
      'Post SV Nürnberg'
    );
    expect(transport.requests).toEqual([
      { kind: 'vereins-spiele', vereinId: 1476, tage: 28 },
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
    expect((await data.spielbericht(2911141))?.heim.spielerwerteErfasst).toBe(
      true
    );
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

  it.each(['not-found', 'offline'] as const)(
    'passes on a typed %s error the transport throws itself',
    async (kind) => {
      const own = new BasketballDataError(kind, 'proxy: nope');
      const data = new DbbBasketballData(() => Promise.reject(own));

      expect(await rejectedError(() => data.spiel(2911141))).toBe(own);
    }
  );

  it('rejects a response of the wrong shape as unexpected', async () => {
    const { data } = dataWith({
      'spiel-info': { status: '0', data: { matchId: 'x' } },
    });

    expect((await rejectedError(() => data.spiel(2911141))).kind).toBe(
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
      ['ligaSuche', (data, signal) => data.ligaSuche(BAYERN_U14, { signal })],
      [
        'ligaSeite',
        (data, signal) => data.ligaSeite(BAYERN_U14, 10, { signal }),
      ],
      ['ligaTeams', (data, signal) => data.ligaTeams(54379, { signal })],
      ['vereinsTeams', (data, signal) => data.vereinsTeams(1476, { signal })],
      ['teamSpiele', (data, signal) => data.teamSpiele(313036, { signal })],
      ['tabelle', (data, signal) => data.tabelle(54308, { signal })],
      ['spiel', (data, signal) => data.spiel(2911141, { signal })],
      [
        'spielbericht',
        (data, signal) => data.spielbericht(2911141, { signal }),
      ],
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

    it('rejects a cancelled read with the reason it was cancelled for', async () => {
      const controller = new AbortController();
      const transport: DbbTransport = (_request, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () =>
            reject(new TypeError('aborted fetch'))
          )
        );
      const read = new DbbBasketballData(transport).teamSpiele(313036, {
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
        new DbbBasketballData(async () => teamMatches).teamSpiele(313036, {
          signal,
        })
      ).rejects.toBe(reason);
    });

    it('asks nothing for a read cancelled before it began', async () => {
      const transport = jest.fn<Promise<unknown>, Parameters<DbbTransport>>();
      const reason = new Error('navigated away');

      await expect(
        new DbbBasketballData(transport).teamSpiele(313036, {
          signal: AbortSignal.abort(reason),
        })
      ).rejects.toBe(reason);
      expect(transport).not.toHaveBeenCalled();
    });
  });
});
