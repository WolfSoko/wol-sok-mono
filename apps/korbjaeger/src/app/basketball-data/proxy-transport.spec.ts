import {
  DbbBasketballData,
  isBasketballDataError,
  type BasketballDataErrorKind,
  type LigaSucheFilter,
} from '@wolsok/feat-shared-basketball-data';
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { createApp, createRouter, toWebHandler } from 'h3';
import { proxyRouteHandler } from '../../server/dbb/dbb-proxy';
import type { DbbUpstream } from '../../server/dbb/dbb-upstream';
import { PROXY_ROUTES } from '../../shared/dbb-proxy-routes';
import type { DbbRequestKind } from '@wolsok/feat-shared-basketball-data';
import type {
  LetzteAntwort,
  LetzteAntworten,
} from '@wolsok/feat-korbjaeger-antworten';
import { Lesung, type KorbReadOptions } from './lesung';
import { KeinInternetError } from './kein-internet-error';
import {
  PROXY_ZEITLIMIT_MS,
  proxyTransport,
  SPEICHERBARE_ARTEN,
  type ProxyFetch,
} from './proxy-transport';

/** The DBB as the fake DBB server answers it, from the recorded fixtures. */
const recordedDbb: DbbUpstream = async (call) => {
  const answer = fakeDbbAnswer(
    call.method,
    call.path,
    call.method === 'POST' ? JSON.stringify(call.body) : undefined
  );
  return answer === undefined
    ? { ok: false, reason: 'not recorded' }
    : { ok: true, body: JSON.stringify(answer) };
};

/** The app's proxy, its real routes in front of the recorded DBB. */
const recordedProxyHandler = toWebHandler(
  createApp().use(
    Object.values(PROXY_ROUTES).reduce(
      (router, route) =>
        router.get(route.pattern, proxyRouteHandler(route, recordedDbb)),
      createRouter()
    )
  )
);

/** The app's proxy, answering with the DBB's recorded bodies. */
function recordedProxy(): ReturnType<typeof vi.fn<ProxyFetch>> {
  return vi.fn<ProxyFetch>((url) =>
    recordedProxyHandler(new Request(`http://localhost${url}`))
  );
}

/** A proxy that never answers, until the call is cancelled. */
const haengend: ProxyFetch = (_url, init) =>
  new Promise((_resolve, reject) =>
    init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
  );

/** The proxy answering every read with `status` and `body`. */
function proxyAnswering(status: number, body: string): ProxyFetch {
  return async () => new Response(body, { status });
}

async function rejectionKind(
  read: Promise<unknown>
): Promise<BasketballDataErrorKind | undefined> {
  const error = await read.then(
    () => undefined,
    (caught: unknown) => caught
  );
  return isBasketballDataError(error) ? error.kind : undefined;
}

const NIEDERSACHSEN_U12_JUGEND_MAENNLICH: LigaSucheFilter = {
  verbandIds: [7],
  altersklasseIds: [12],
  altersgruppeGeschlechtIds: ['2_1'],
};

describe('proxyTransport', () => {
  it("searches Ligen and pages through them from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));
    const filter = NIEDERSACHSEN_U12_JUGEND_MAENNLICH;

    const suche = await data.ligaSuche(filter);
    const seite = await data.ligaSeite(filter, 10);

    expect(proxy.mock.calls.map(([url]) => url)).toEqual([
      '/api/dbb/ligen?verband=7&altersklasse=12&geschlecht=2_1',
      '/api/dbb/ligen/seite?start=10&verband=7&altersklasse=12&geschlecht=2_1',
    ]);
    expect(suche.ersteSeite.ligen).toHaveLength(10);
    expect(seite.ligen.map((liga) => liga.id)).toContain(54862);
  });

  it("reads the Teams of a Liga from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const teams = await data.ligaTeams(54862);

    expect(proxy).toHaveBeenCalledWith(
      '/api/dbb/liga/54862/spielplan',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    );
    expect(teams).toContainEqual({
      id: 313036,
      name: 'MTV Wasbüttel -RST-',
      vereinId: 1837,
    });
  });

  it("reads a Team's Spiele from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const saison = await data.teamSpiele(313036);

    expect(proxy).toHaveBeenCalledWith(
      '/api/dbb/team/313036/spiele',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    );
    expect(saison.team.id).toBe(313036);
    expect(saison.spiele).toHaveLength(6);
  });

  it("reads a Verein's Teams from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const vereinsTeams = await data.vereinsTeams(1837);

    expect(proxy).toHaveBeenCalledWith(
      '/api/dbb/verein/1837/spiele',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    );
    expect(vereinsTeams.verein.name).toBe('MTV Wasbüttel');
    expect(vereinsTeams.teams.map(({ team }) => team.id)).toContain(313036);
  });

  it("reads a Liga's Tabelle from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const tabelle = await data.tabelle(54862);

    expect(proxy).toHaveBeenCalledWith(
      '/api/dbb/liga/54862/tabelle',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    );
    expect(tabelle.liga.id).toBe(54862);
    expect(tabelle.zeilen).toHaveLength(6);
  });

  it("reads a Spiel and its Spielbericht from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const [details, bericht] = await Promise.all([
      data.spiel(2861436),
      data.spielbericht(2861436),
    ]);

    expect(proxy.mock.calls.map(([url]) => url)).toEqual([
      '/api/dbb/spiel/2861436',
      '/api/dbb/spiel/2861436/bericht',
    ]);
    expect(details.halle?.name).toBe('Schulsporthalle');
    expect(bericht?.heim.eintraege).toHaveLength(9);
  });

  it('reads a Spiel without Spielbericht yet as such', async () => {
    const data = new DbbBasketballData(proxyTransport(recordedProxy()));

    expect(await data.spielbericht(2843814)).toBeUndefined();
  });

  it('reads the Tabelle of a Liga the DBB does not know as not found', async () => {
    const data = new DbbBasketballData(proxyTransport(recordedProxy()));

    expect(await rejectionKind(data.tabelle(7))).toBe('not-found');
  });

  it('hands a 404 to the adapter, which reads the not-found envelope', async () => {
    const data = new DbbBasketballData(proxyTransport(recordedProxy()));

    expect(await rejectionKind(data.teamSpiele(7))).toBe('not-found');
  });

  it('reads a 502 of the proxy as unavailable', async () => {
    const data = new DbbBasketballData(
      proxyTransport(proxyAnswering(502, '{"error":"dbb-unavailable"}'))
    );

    expect(await rejectionKind(data.teamSpiele(313036))).toBe('unavailable');
  });

  it('reads a network failure as offline', async () => {
    const offline: ProxyFetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const transport = proxyTransport(offline);

    expect(
      await rejectionKind(transport({ kind: 'team-spiele', teamId: 313036 }))
    ).toBe('offline');
  });

  it('reads a device the browser calls offline as offline, without internet, without calling the proxy', async () => {
    const proxy = recordedProxy();
    const transport = proxyTransport(proxy, { online: () => false });

    const error = await transport({ kind: 'team-spiele', teamId: 313036 }).then(
      () => undefined,
      (caught: unknown) => caught
    );

    expect(isBasketballDataError(error, 'offline')).toBe(true);
    expect(error).toBeInstanceOf(KeinInternetError);
    expect(proxy).not.toHaveBeenCalled();
  });

  it('gives up on a proxy that does not answer within 8 seconds, as unreachable', async () => {
    const transport = proxyTransport(haengend, { zeitlimitMs: 20 });

    const error = await transport({ kind: 'team-spiele', teamId: 313036 }).then(
      () => undefined,
      (caught: unknown) => caught
    );

    expect(isBasketballDataError(error, 'offline')).toBe(true);
    expect(error).not.toBeInstanceOf(KeinInternetError);
    expect(PROXY_ZEITLIMIT_MS).toBe(8_000);
  });

  it('reads a body that is no JSON as unavailable', async () => {
    const transport = proxyTransport(proxyAnswering(200, '<html>'));

    expect(
      await rejectionKind(transport({ kind: 'team-spiele', teamId: 313036 }))
    ).toBe('unavailable');
  });

  it("reads the proxy's own 404, which is no DBB envelope, as not found", async () => {
    const data = new DbbBasketballData(
      proxyTransport(proxyAnswering(404, '{"error":"not-found"}'))
    );

    expect(await rejectionKind(data.teamSpiele(313036))).toBe('not-found');
  });

  it('reads a 404 without JSON as not found', async () => {
    const data = new DbbBasketballData(
      proxyTransport(proxyAnswering(404, 'Not Found'))
    );

    expect(await rejectionKind(data.teamSpiele(313036))).toBe('not-found');
  });

  it('cancels the call to the proxy with the read', async () => {
    const proxy = vi.fn<ProxyFetch>(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        )
    );
    const controller = new AbortController();
    const read = new DbbBasketballData(proxyTransport(proxy)).teamSpiele(
      313036,
      { signal: controller.signal }
    );

    controller.abort(new Error('navigated away'));

    await expect(read).rejects.toThrow('navigated away');
    expect(proxy.mock.calls[0][1].signal?.aborted).toBe(true);
    expect(proxy.mock.calls[0][1].signal?.reason).toEqual(
      new Error('navigated away')
    );
  });

  it('cancels the call for a read signal that is no DOM AbortSignal', async () => {
    const listeners: Array<() => void> = [];
    const signal = {
      aborted: false,
      reason: new Error('navigated away'),
      throwIfAborted: (): void => undefined,
      addEventListener: (_type: 'abort', listener: () => void): void => {
        listeners.push(listener);
      },
    };
    const proxy = vi.fn<ProxyFetch>(
      () => new Promise<Response>(() => undefined)
    );

    void proxyTransport(proxy)(
      { kind: 'team-spiele', teamId: 313036 },
      { signal }
    );
    listeners.forEach((listener) => listener());

    const fetchSignal = proxy.mock.calls[0][1].signal;
    expect(fetchSignal?.aborted).toBe(true);
    expect(fetchSignal?.reason).toBe(signal.reason);
  });

  describe('the last good answer', () => {
    const TEAM_SPIELE = '/api/dbb/team/313036/spiele';

    /** `LetzteAntworten` in memory, with what was stored and its kind. */
    class GemerkteAntworten implements LetzteAntworten {
      public readonly gemerkt = new Map<
        string,
        LetzteAntwort & { art: DbbRequestKind }
      >();

      public lesen(pfad: string): LetzteAntwort | undefined {
        return this.gemerkt.get(pfad);
      }

      public merken(
        pfad: string,
        art: DbbRequestKind,
        antwort: LetzteAntwort
      ): void {
        this.gemerkt.set(pfad, { ...antwort, art });
      }
    }

    /** The proxy as recorded, until told to answer otherwise. */
    function proxyMit(): {
      proxy: ProxyFetch;
      antwortet: (proxy: ProxyFetch) => void;
    } {
      let aktuell: ProxyFetch = recordedProxy();
      return {
        proxy: (url, init) => aktuell(url, init),
        antwortet: (proxy) => {
          aktuell = proxy;
        },
      };
    }

    const nichtErreichbar: ProxyFetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    function transportMit(proxy: ProxyFetch, antworten: LetzteAntworten) {
      let jetzt = 1_000;
      const data = new DbbBasketballData<KorbReadOptions>(
        proxyTransport(proxy, {
          antworten,
          jetzt: () => jetzt,
          zeitlimitMs: 20,
        })
      );
      return {
        data,
        spaeter: (ms: number): void => {
          jetzt += ms;
        },
        /** A read as a resource makes it: kept once it was read. */
        lesen: async <T>(
          read: (options: KorbReadOptions) => Promise<T>
        ): Promise<{ wert: T; lesung: Lesung }> => {
          const lesung = new Lesung();
          const wert = await read({ lesung });
          lesung.abschliessen();
          return { wert, lesung };
        },
      };
    }

    it('keeps only the kinds of read without persons in them', () => {
      expect([...SPEICHERBARE_ARTEN].sort()).toEqual([
        'spiel-info',
        'tabelle',
        'team-spiele',
        'vereins-spiele',
      ]);
    });

    it.each([
      ['keine-verbindung', nichtErreichbar],
      ['keine-verbindung', haengend],
      ['unavailable', proxyAnswering(502, '{"error":"dbb-unavailable"}')],
      ['unavailable', proxyAnswering(200, '<html>captive portal</html>')],
    ] as const)(
      'answers a read that fails as %s from the last good answer, with when it came',
      async (grund, danach) => {
        const { proxy, antwortet } = proxyMit();
        const { data, lesen, spaeter } = transportMit(
          proxy,
          new GemerkteAntworten()
        );
        const frisch = await lesen((o) => data.teamSpiele(313036, o));
        antwortet(danach);
        spaeter(7_200_000);

        const veraltet = await lesen((o) => data.teamSpiele(313036, o));

        expect(veraltet.wert).toEqual(frisch.wert);
        expect(veraltet.lesung.stand).toEqual({ gespeichertAm: 1_000, grund });
        expect(frisch.lesung.stand).toBeUndefined();
      }
    );

    it('stores an answer only once the read is done with it', async () => {
      const antworten = new GemerkteAntworten();
      const { data } = transportMit(recordedProxy(), antworten);
      const lesung = new Lesung();

      await data.teamSpiele(313036, { lesung });
      expect(antworten.gemerkt.size).toBe(0);

      lesung.abschliessen();
      expect([...antworten.gemerkt.keys()]).toEqual([TEAM_SPIELE]);
    });

    it.each([
      [
        'a Spielbericht, with the Kader',
        (data: DbbBasketballData<KorbReadOptions>, o: KorbReadOptions) =>
          data.spielbericht(2861436, o),
      ],
      [
        'the Liga search',
        (data: DbbBasketballData<KorbReadOptions>, o: KorbReadOptions) =>
          data.ligaSuche(NIEDERSACHSEN_U12_JUGEND_MAENNLICH, o),
      ],
      [
        'a later page of Ligen',
        (data: DbbBasketballData<KorbReadOptions>, o: KorbReadOptions) =>
          data.ligaSeite(NIEDERSACHSEN_U12_JUGEND_MAENNLICH, 10, o),
      ],
      [
        "a Liga's Teams",
        (data: DbbBasketballData<KorbReadOptions>, o: KorbReadOptions) =>
          data.ligaTeams(54862, o),
      ],
    ] as ReadonlyArray<
      [
        string,
        (
          data: DbbBasketballData<KorbReadOptions>,
          o: KorbReadOptions
        ) => Promise<unknown>,
      ]
    >)('never stores %s', async (_was, read) => {
      const antworten = new GemerkteAntworten();
      const { data, lesen } = transportMit(recordedProxy(), antworten);

      await lesen((o) => read(data, o));

      expect(antworten.gemerkt.size).toBe(0);
    });

    it.each([
      'team-spiele',
      'tabelle',
      'spiel-info',
      'vereins-spiele',
    ] as const)('stores a read of kind %s with its kind', async (art) => {
      const antworten = new GemerkteAntworten();
      const { data, lesen } = transportMit(recordedProxy(), antworten);
      const reads: Readonly<
        Record<typeof art, (o: KorbReadOptions) => Promise<unknown>>
      > = {
        'team-spiele': (o: KorbReadOptions) => data.teamSpiele(313036, o),
        tabelle: (o: KorbReadOptions) => data.tabelle(54862, o),
        'spiel-info': (o: KorbReadOptions) => data.spiel(2861436, o),
        'vereins-spiele': (o: KorbReadOptions) => data.vereinsTeams(1837, o),
      };

      await lesen(reads[art]);

      expect([...antworten.gemerkt.values()].map((g) => g.art)).toEqual([art]);
    });

    it("stores a Spiel's match info without its persons, players and referees (ADR 0019)", async () => {
      const antworten = new GemerkteAntworten();
      const { data, lesen } = transportMit(recordedProxy(), antworten);

      await lesen((o) => data.spiel(2861436, o));

      const gespeichert = JSON.stringify(
        antworten.gemerkt.get('/api/dbb/spiel/2861436')?.antwort
      );
      expect(gespeichert).toContain('Schulsporthalle');
      expect(gespeichert).not.toMatch(
        /vorname|nachname|"person|playerId|topPerformances/
      );
    });

    it('answers from the last good answer while the browser says it is offline', async () => {
      const antworten = new GemerkteAntworten();
      const lesung = new Lesung();
      await new DbbBasketballData<KorbReadOptions>(
        proxyTransport(recordedProxy(), { antworten, jetzt: () => 1_000 })
      ).teamSpiele(313036, { lesung });
      lesung.abschliessen();
      const offline = new Lesung();

      await new DbbBasketballData<KorbReadOptions>(
        proxyTransport(recordedProxy(), { antworten, online: () => false })
      ).teamSpiele(313036, { lesung: offline });

      expect(offline.stand).toEqual({
        gespeichertAm: 1_000,
        grund: 'kein-internet',
      });
    });

    it('answers a read that can show no Stand without its last good answer', async () => {
      const { proxy, antwortet } = proxyMit();
      const { data, lesen } = transportMit(proxy, new GemerkteAntworten());
      await lesen((o) => data.teamSpiele(313036, o));
      antwortet(nichtErreichbar);

      expect(await rejectionKind(data.teamSpiele(313036))).toBe('offline');
    });

    it('stores successes only, never an error', async () => {
      const antworten = new GemerkteAntworten();
      const { proxy, antwortet } = proxyMit();
      const { data, lesen, spaeter } = transportMit(proxy, antworten);
      await lesen((o) => data.teamSpiele(313036, o));
      await lesen((o) => data.teamSpiele(7, o)).catch(() => undefined);
      spaeter(60_000);
      antwortet(proxyAnswering(502, '{"error":"dbb-unavailable"}'));
      await lesen((o) => data.teamSpiele(313036, o));

      expect([...antworten.gemerkt.keys()]).toEqual([TEAM_SPIELE]);
      expect(antworten.gemerkt.get(TEAM_SPIELE)?.gespeichertAm).toBe(1_000);
    });

    it('answers a 404 as not found, whatever answer it had before', async () => {
      const { proxy, antwortet } = proxyMit();
      const { data, lesen } = transportMit(proxy, new GemerkteAntworten());
      await lesen((o) => data.teamSpiele(313036, o));
      antwortet(proxyAnswering(404, '{"error":"not-found"}'));

      expect(
        await rejectionKind(data.teamSpiele(313036, { lesung: new Lesung() }))
      ).toBe('not-found');
    });

    it.each([
      ['offline', nichtErreichbar],
      ['unavailable', proxyAnswering(502, '{"error":"dbb-unavailable"}')],
    ] as const)(
      'fails as %s without a last good answer',
      async (kind, proxy) => {
        const { data } = transportMit(proxy, new GemerkteAntworten());

        expect(
          await rejectionKind(data.teamSpiele(313036, { lesung: new Lesung() }))
        ).toBe(kind);
      }
    );

    it('answers a cancelled read with its cancellation, not the last good answer', async () => {
      const { proxy, antwortet } = proxyMit();
      const { data, lesen } = transportMit(proxy, new GemerkteAntworten());
      await lesen((o) => data.teamSpiele(313036, o));
      antwortet(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            )
          )
      );
      const controller = new AbortController();
      const lesung = new Lesung();

      const read = data.teamSpiele(313036, {
        signal: controller.signal,
        lesung,
      });
      controller.abort(new Error('navigated away'));

      await expect(read).rejects.toThrow('navigated away');
      expect(lesung.stand).toBeUndefined();
    });
  });
});
