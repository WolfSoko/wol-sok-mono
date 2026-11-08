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
import type { LetzteAntwort, LetzteAntworten } from './letzte-antworten';
import { proxyTransport, type ProxyFetch } from './proxy-transport';
import type { Stand, StandReadOptions } from './stand';

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

    expect(proxy).toHaveBeenCalledWith('/api/dbb/liga/54862/spielplan', {
      headers: { accept: 'application/json' },
    });
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

    expect(proxy).toHaveBeenCalledWith('/api/dbb/team/313036/spiele', {
      headers: { accept: 'application/json' },
    });
    expect(saison.team.id).toBe(313036);
    expect(saison.spiele).toHaveLength(6);
  });

  it("reads a Verein's Teams from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const vereinsTeams = await data.vereinsTeams(1837);

    expect(proxy).toHaveBeenCalledWith('/api/dbb/verein/1837/spiele', {
      headers: { accept: 'application/json' },
    });
    expect(vereinsTeams.verein.name).toBe('MTV Wasbüttel');
    expect(vereinsTeams.teams.map(({ team }) => team.id)).toContain(313036);
  });

  it("reads a Liga's Tabelle from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const tabelle = await data.tabelle(54862);

    expect(proxy).toHaveBeenCalledWith('/api/dbb/liga/54862/tabelle', {
      headers: { accept: 'application/json' },
    });
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

  it('reads a device the browser calls offline as offline, without calling the proxy', async () => {
    const proxy = recordedProxy();
    const transport = proxyTransport(proxy, { online: () => false });

    expect(
      await rejectionKind(transport({ kind: 'team-spiele', teamId: 313036 }))
    ).toBe('offline');
    expect(proxy).not.toHaveBeenCalled();
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
    expect(proxy.mock.calls[0][1].signal).toBe(controller.signal);
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

    /** `LetzteAntworten` in memory, with what was stored. */
    class GemerkteAntworten implements LetzteAntworten {
      public readonly gemerkt = new Map<string, LetzteAntwort>();

      public lesen(pfad: string): LetzteAntwort | undefined {
        return this.gemerkt.get(pfad);
      }

      public merken(pfad: string, antwort: LetzteAntwort): void {
        this.gemerkt.set(pfad, antwort);
      }
    }

    /** The proxy as `antworten` answer it: recorded, until told otherwise. */
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

    /** A read's options that note the `Stand` it was answered from. */
    function mitStand(): { options: StandReadOptions; staende: Stand[] } {
      const staende: Stand[] = [];
      return { options: { beiStand: (stand) => staende.push(stand) }, staende };
    }

    function transportMit(proxy: ProxyFetch, antworten: LetzteAntworten) {
      let jetzt = 1_000;
      return {
        data: new DbbBasketballData(
          proxyTransport(proxy, { antworten, jetzt: () => jetzt })
        ),
        spaeter: (ms: number): void => {
          jetzt += ms;
        },
      };
    }

    it.each([
      ['offline', nichtErreichbar],
      ['unavailable', proxyAnswering(502, '{"error":"dbb-unavailable"}')],
      ['unavailable', proxyAnswering(200, '<html>captive portal</html>')],
    ] as const)(
      'answers a read that fails as %s from the last good answer, with when it came',
      async (grund, danach) => {
        const { proxy, antwortet } = proxyMit();
        const { data, spaeter } = transportMit(proxy, new GemerkteAntworten());
        const frisch = await data.teamSpiele(313036);
        antwortet(danach);
        spaeter(7_200_000);
        const { options, staende } = mitStand();

        const veraltet = await data.teamSpiele(313036, options);

        expect(veraltet).toEqual(frisch);
        expect(staende).toEqual([{ gespeichertAm: 1_000, grund }]);
      }
    );

    it('answers from the last good answer while the browser says it is offline', async () => {
      const antworten = new GemerkteAntworten();
      await new DbbBasketballData(
        proxyTransport(recordedProxy(), { antworten, jetzt: () => 1_000 })
      ).teamSpiele(313036);
      const { options, staende } = mitStand();

      await new DbbBasketballData(
        proxyTransport(recordedProxy(), { antworten, online: () => false })
      ).teamSpiele(313036, options);

      expect(staende).toEqual([{ gespeichertAm: 1_000, grund: 'offline' }]);
    });

    it('notes no Stand for a read the proxy answered', async () => {
      const { data } = transportMit(recordedProxy(), new GemerkteAntworten());
      const { options, staende } = mitStand();

      await data.teamSpiele(313036, options);

      expect(staende).toEqual([]);
    });

    it('stores successes only, per proxy path, never an error', async () => {
      const antworten = new GemerkteAntworten();
      const { proxy, antwortet } = proxyMit();
      const { data, spaeter } = transportMit(proxy, antworten);
      await data.teamSpiele(313036);
      await data.teamSpiele(7).catch(() => undefined);
      spaeter(60_000);
      antwortet(proxyAnswering(502, '{"error":"dbb-unavailable"}'));
      await data.teamSpiele(313036);

      expect([...antworten.gemerkt.keys()]).toEqual([TEAM_SPIELE]);
      expect(antworten.gemerkt.get(TEAM_SPIELE)?.gespeichertAm).toBe(1_000);
    });

    it('answers a 404 as not found, whatever answer it had before', async () => {
      const { proxy, antwortet } = proxyMit();
      const { data } = transportMit(proxy, new GemerkteAntworten());
      await data.teamSpiele(313036);
      antwortet(proxyAnswering(404, '{"error":"not-found"}'));

      expect(await rejectionKind(data.teamSpiele(313036))).toBe('not-found');
    });

    it.each([
      ['offline', nichtErreichbar],
      ['unavailable', proxyAnswering(502, '{"error":"dbb-unavailable"}')],
    ] as const)(
      'fails as %s without a last good answer',
      async (kind, proxy) => {
        const { data } = transportMit(proxy, new GemerkteAntworten());

        expect(await rejectionKind(data.teamSpiele(313036))).toBe(kind);
      }
    );

    it('answers a cancelled read with its cancellation, not the last good answer', async () => {
      const { proxy, antwortet } = proxyMit();
      const { data } = transportMit(proxy, new GemerkteAntworten());
      await data.teamSpiele(313036);
      antwortet(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            )
          )
      );
      const controller = new AbortController();
      const { options, staende } = mitStand();
      const abbrechbar: StandReadOptions = {
        ...options,
        signal: controller.signal,
      };

      const read = data.teamSpiele(313036, abbrechbar);
      controller.abort(new Error('navigated away'));

      await expect(read).rejects.toThrow('navigated away');
      expect(staende).toEqual([]);
    });
  });
});
