import {
  DbbBasketballData,
  isBasketballDataError,
  type BasketballDataErrorKind,
  type LeagueSearchFilter,
} from '@wolsok/feat-shared-basketball-data';
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { createApp, createRouter, toWebHandler } from 'h3';
import { proxyRouteHandler } from '../../server/dbb/dbb-proxy';
import type { DbbUpstream } from '../../server/dbb/dbb-upstream';
import { PROXY_ROUTES } from '../../shared/dbb-proxy-routes';
import type { DbbRequestKind } from '@wolsok/feat-shared-basketball-data';
import type {
  CachedAnswer,
  AnswerCache,
} from '@wolsok/feat-korbjaeger-answers';
import { Reading, type KorbReadOptions } from './reading';
import { NoInternetError } from './no-internet-error';
import { proxyTransport, STORABLE_KINDS } from './proxy-transport';
import { PROXY_TIMEOUT_MS, type ProxyFetch } from './proxy-fetch';

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
const hanging: ProxyFetch = (_url, init) =>
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

const NIEDERSACHSEN_U12_JUGEND_MAENNLICH: LeagueSearchFilter = {
  associationIds: [7],
  ageGroupIds: [12],
  ageGroupGenderIds: ['2_1'],
};

describe('proxyTransport', () => {
  it("searches Ligen and pages through them from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));
    const filter = NIEDERSACHSEN_U12_JUGEND_MAENNLICH;

    const search = await data.leagueSearch(filter);
    const page = await data.leaguePage(filter, 10);

    expect(proxy.mock.calls.map(([url]) => url)).toEqual([
      '/api/dbb/ligen?verband=7&altersklasse=12&geschlecht=2_1',
      '/api/dbb/ligen/seite?start=10&verband=7&altersklasse=12&geschlecht=2_1',
    ]);
    expect(search.firstPage.leagues).toHaveLength(10);
    expect(page.leagues.map((league) => league.id)).toContain(54862);
  });

  it("reads the Teams of a Liga from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const teams = await data.leagueTeams(54862);

    expect(proxy).toHaveBeenCalledWith(
      '/api/dbb/liga/54862/spielplan',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    );
    expect(teams).toContainEqual({
      id: 313036,
      name: 'MTV Wasbüttel -RST-',
      clubId: 1837,
    });
  });

  it("reads a Team's Spiele from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const season = await data.teamGames(313036);

    expect(proxy).toHaveBeenCalledWith(
      '/api/dbb/team/313036/spiele',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    );
    expect(season.team.id).toBe(313036);
    expect(season.games).toHaveLength(6);
  });

  it("reads a Verein's Teams from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const clubTeams = await data.clubTeams(1837);

    expect(proxy).toHaveBeenCalledWith(
      '/api/dbb/verein/1837/spiele',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    );
    expect(clubTeams.club.name).toBe('MTV Wasbüttel');
    expect(clubTeams.teams.map(({ team }) => team.id)).toContain(313036);
  });

  it("reads a Liga's Tabelle from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const standings = await data.standings(54862);

    expect(proxy).toHaveBeenCalledWith(
      '/api/dbb/liga/54862/tabelle',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    );
    expect(standings.league.id).toBe(54862);
    expect(standings.rows).toHaveLength(6);
  });

  it("reads a Spiel and its Spielbericht from the app's proxy", async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const [details, report] = await Promise.all([
      data.game(2861436),
      data.gameReport(2861436),
    ]);

    expect(proxy.mock.calls.map(([url]) => url)).toEqual([
      '/api/dbb/spiel/2861436',
      '/api/dbb/spiel/2861436/bericht',
    ]);
    expect(details.venue?.name).toBe('Schulsporthalle');
    expect(report?.home.entries).toHaveLength(9);
  });

  it('reads a Spiel without Spielbericht yet as such', async () => {
    const data = new DbbBasketballData(proxyTransport(recordedProxy()));

    expect(await data.gameReport(2843814)).toBeUndefined();
  });

  it('reads the Tabelle of a Liga the DBB does not know as not found', async () => {
    const data = new DbbBasketballData(proxyTransport(recordedProxy()));

    expect(await rejectionKind(data.standings(7))).toBe('not-found');
  });

  it('hands a 404 to the adapter, which reads the not-found envelope', async () => {
    const data = new DbbBasketballData(proxyTransport(recordedProxy()));

    expect(await rejectionKind(data.teamGames(7))).toBe('not-found');
  });

  it('reads a 502 of the proxy as unavailable', async () => {
    const data = new DbbBasketballData(
      proxyTransport(proxyAnswering(502, '{"error":"dbb-unavailable"}'))
    );

    expect(await rejectionKind(data.teamGames(313036))).toBe('unavailable');
  });

  it('reads a network failure as offline', async () => {
    const offline: ProxyFetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const transport = proxyTransport(offline);

    expect(
      await rejectionKind(transport({ kind: 'team-games', teamId: 313036 }))
    ).toBe('offline');
  });

  it('reads a device the browser calls offline as offline, without internet, without calling the proxy', async () => {
    const proxy = recordedProxy();
    const transport = proxyTransport(proxy, { online: () => false });

    const error = await transport({ kind: 'team-games', teamId: 313036 }).then(
      () => undefined,
      (caught: unknown) => caught
    );

    expect(isBasketballDataError(error, 'offline')).toBe(true);
    expect(error).toBeInstanceOf(NoInternetError);
    expect(proxy).not.toHaveBeenCalled();
  });

  it('gives up on a proxy that does not answer within 8 seconds, as unreachable', async () => {
    const transport = proxyTransport(hanging, { timeoutMs: 20 });

    const error = await transport({ kind: 'team-games', teamId: 313036 }).then(
      () => undefined,
      (caught: unknown) => caught
    );

    expect(isBasketballDataError(error, 'offline')).toBe(true);
    expect(error).not.toBeInstanceOf(NoInternetError);
    expect(PROXY_TIMEOUT_MS).toBe(8_000);
  });

  it('reads a body that is no JSON as unavailable', async () => {
    const transport = proxyTransport(proxyAnswering(200, '<html>'));

    expect(
      await rejectionKind(transport({ kind: 'team-games', teamId: 313036 }))
    ).toBe('unavailable');
  });

  it("reads the proxy's own 404, which is no DBB envelope, as not found", async () => {
    const data = new DbbBasketballData(
      proxyTransport(proxyAnswering(404, '{"error":"not-found"}'))
    );

    expect(await rejectionKind(data.teamGames(313036))).toBe('not-found');
  });

  it('reads a 404 without JSON as not found', async () => {
    const data = new DbbBasketballData(
      proxyTransport(proxyAnswering(404, 'Not Found'))
    );

    expect(await rejectionKind(data.teamGames(313036))).toBe('not-found');
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
    const read = new DbbBasketballData(proxyTransport(proxy)).teamGames(
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
      { kind: 'team-games', teamId: 313036 },
      { signal }
    );
    listeners.forEach((listener) => listener());

    const fetchSignal = proxy.mock.calls[0][1].signal;
    expect(fetchSignal?.aborted).toBe(true);
    expect(fetchSignal?.reason).toBe(signal.reason);
  });

  describe('the last good answer', () => {
    const TEAM_GAMES = '/api/dbb/team/313036/spiele';

    /** `AnswerCache` in memory, with what was stored and its kind. */
    class RememberedAnswers implements AnswerCache {
      public readonly remembered = new Map<
        string,
        CachedAnswer & { kind: DbbRequestKind }
      >();

      public read(path: string): CachedAnswer | undefined {
        return this.remembered.get(path);
      }

      public store(
        path: string,
        kind: DbbRequestKind,
        answer: CachedAnswer
      ): void {
        this.remembered.set(path, { ...answer, kind });
      }
    }

    /** The proxy as recorded, until told to answer otherwise. */
    function proxyWith(): {
      proxy: ProxyFetch;
      answer: (proxy: ProxyFetch) => void;
    } {
      let current: ProxyFetch = recordedProxy();
      return {
        proxy: (url, init) => current(url, init),
        answer: (proxy) => {
          current = proxy;
        },
      };
    }

    const unreachable: ProxyFetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    function transportWith(proxy: ProxyFetch, answers: AnswerCache) {
      let now = 1_000;
      const data = new DbbBasketballData<KorbReadOptions>(
        proxyTransport(proxy, {
          answers,
          now: () => now,
          timeoutMs: 20,
        })
      );
      return {
        data,
        later: (ms: number): void => {
          now += ms;
        },
        /** A read as a resource makes it: kept once it was read. */
        readAnswer: async <T>(
          read: (options: KorbReadOptions) => Promise<T>
        ): Promise<{ value: T; reading: Reading }> => {
          const reading = new Reading();
          const value = await read({ reading });
          reading.complete();
          return { value, reading };
        },
      };
    }

    it('keeps only the kinds of read without persons in them', () => {
      expect([...STORABLE_KINDS].sort()).toEqual([
        'club-games',
        'game-info',
        'standings',
        'team-games',
      ]);
    });

    it.each([
      ['no-connection', unreachable],
      ['no-connection', hanging],
      ['unavailable', proxyAnswering(502, '{"error":"dbb-unavailable"}')],
      ['unavailable', proxyAnswering(200, '<html>captive portal</html>')],
    ] as const)(
      'answers a read that fails as %s from the last good answer, with when it came',
      async (reason, afterwards) => {
        const { proxy, answer: answers } = proxyWith();
        const { data, readAnswer, later } = transportWith(
          proxy,
          new RememberedAnswers()
        );
        const fresh = await readAnswer((o) => data.teamGames(313036, o));
        answers(afterwards);
        later(7_200_000);

        const stale = await readAnswer((o) => data.teamGames(313036, o));

        expect(stale.value).toEqual(fresh.value);
        expect(stale.reading.asOf).toEqual({ storedAt: 1_000, reason });
        expect(fresh.reading.asOf).toBeUndefined();
      }
    );

    it('stores an answer only once the read is done with it', async () => {
      const answers = new RememberedAnswers();
      const { data } = transportWith(recordedProxy(), answers);
      const reading = new Reading();

      await data.teamGames(313036, { reading });
      expect(answers.remembered.size).toBe(0);

      reading.complete();
      expect([...answers.remembered.keys()]).toEqual([TEAM_GAMES]);
    });

    it.each([
      [
        'a Spielbericht, with the Kader',
        (data: DbbBasketballData<KorbReadOptions>, o: KorbReadOptions) =>
          data.gameReport(2861436, o),
      ],
      [
        'the Liga search',
        (data: DbbBasketballData<KorbReadOptions>, o: KorbReadOptions) =>
          data.leagueSearch(NIEDERSACHSEN_U12_JUGEND_MAENNLICH, o),
      ],
      [
        'a later page of Ligen',
        (data: DbbBasketballData<KorbReadOptions>, o: KorbReadOptions) =>
          data.leaguePage(NIEDERSACHSEN_U12_JUGEND_MAENNLICH, 10, o),
      ],
      [
        "a Liga's Teams",
        (data: DbbBasketballData<KorbReadOptions>, o: KorbReadOptions) =>
          data.leagueTeams(54862, o),
      ],
    ] as ReadonlyArray<
      [
        string,
        (
          data: DbbBasketballData<KorbReadOptions>,
          o: KorbReadOptions
        ) => Promise<unknown>,
      ]
    >)('never stores %s', async (_what, read) => {
      const answers = new RememberedAnswers();
      const { data, readAnswer } = transportWith(recordedProxy(), answers);

      await readAnswer((o) => read(data, o));

      expect(answers.remembered.size).toBe(0);
    });

    it.each(['team-games', 'standings', 'game-info', 'club-games'] as const)(
      'stores a read of kind %s with its kind',
      async (kind) => {
        const answers = new RememberedAnswers();
        const { data, readAnswer } = transportWith(recordedProxy(), answers);
        const reads: Readonly<
          Record<typeof kind, (o: KorbReadOptions) => Promise<unknown>>
        > = {
          'team-games': (o: KorbReadOptions) => data.teamGames(313036, o),
          standings: (o: KorbReadOptions) => data.standings(54862, o),
          'game-info': (o: KorbReadOptions) => data.game(2861436, o),
          'club-games': (o: KorbReadOptions) => data.clubTeams(1837, o),
        };

        await readAnswer(reads[kind]);

        expect([...answers.remembered.values()].map((g) => g.kind)).toEqual([
          kind,
        ]);
      }
    );

    it("stores a Spiel's match info without its persons, players and referees (ADR 0019)", async () => {
      const answers = new RememberedAnswers();
      const { data, readAnswer } = transportWith(recordedProxy(), answers);

      await readAnswer((o) => data.game(2861436, o));

      const stored = JSON.stringify(
        answers.remembered.get('/api/dbb/spiel/2861436')?.answer
      );
      expect(stored).toContain('Schulsporthalle');
      expect(stored).not.toMatch(
        /vorname|nachname|"person|playerId|topPerformances/
      );
    });

    it('answers from the last good answer while the browser says it is offline', async () => {
      const answers = new RememberedAnswers();
      const reading = new Reading();
      await new DbbBasketballData<KorbReadOptions>(
        proxyTransport(recordedProxy(), { answers, now: () => 1_000 })
      ).teamGames(313036, { reading });
      reading.complete();
      const offline = new Reading();

      await new DbbBasketballData<KorbReadOptions>(
        proxyTransport(recordedProxy(), { answers, online: () => false })
      ).teamGames(313036, { reading: offline });

      expect(offline.asOf).toEqual({
        storedAt: 1_000,
        reason: 'no-internet',
      });
    });

    it('answers a read that can show no Stand without its last good answer', async () => {
      const { proxy, answer } = proxyWith();
      const { data, readAnswer } = transportWith(
        proxy,
        new RememberedAnswers()
      );
      await readAnswer((o) => data.teamGames(313036, o));
      answer(unreachable);

      expect(await rejectionKind(data.teamGames(313036))).toBe('offline');
    });

    it('stores successes only, never an error', async () => {
      const answers = new RememberedAnswers();
      const { proxy, answer } = proxyWith();
      const { data, readAnswer, later } = transportWith(proxy, answers);
      await readAnswer((o) => data.teamGames(313036, o));
      await readAnswer((o) => data.teamGames(7, o)).catch(() => undefined);
      later(60_000);
      answer(proxyAnswering(502, '{"error":"dbb-unavailable"}'));
      await readAnswer((o) => data.teamGames(313036, o));

      expect([...answers.remembered.keys()]).toEqual([TEAM_GAMES]);
      expect(answers.remembered.get(TEAM_GAMES)?.storedAt).toBe(1_000);
    });

    it('answers a 404 as not found, whatever answer it had before', async () => {
      const { proxy, answer } = proxyWith();
      const { data, readAnswer } = transportWith(
        proxy,
        new RememberedAnswers()
      );
      await readAnswer((o) => data.teamGames(313036, o));
      answer(proxyAnswering(404, '{"error":"not-found"}'));

      expect(
        await rejectionKind(data.teamGames(313036, { reading: new Reading() }))
      ).toBe('not-found');
    });

    it.each([
      ['offline', unreachable],
      ['unavailable', proxyAnswering(502, '{"error":"dbb-unavailable"}')],
    ] as const)(
      'fails as %s without a last good answer',
      async (kind, proxy) => {
        const { data } = transportWith(proxy, new RememberedAnswers());

        expect(
          await rejectionKind(
            data.teamGames(313036, { reading: new Reading() })
          )
        ).toBe(kind);
      }
    );

    it('answers a cancelled read with its cancellation, not the last good answer', async () => {
      const { proxy, answer } = proxyWith();
      const { data, readAnswer } = transportWith(
        proxy,
        new RememberedAnswers()
      );
      await readAnswer((o) => data.teamGames(313036, o));
      answer(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            )
          )
      );
      const controller = new AbortController();
      const reading = new Reading();

      const read = data.teamGames(313036, {
        signal: controller.signal,
        reading,
      });
      controller.abort(new Error('navigated away'));

      await expect(read).rejects.toThrow('navigated away');
      expect(reading.asOf).toBeUndefined();
    });
  });
});
