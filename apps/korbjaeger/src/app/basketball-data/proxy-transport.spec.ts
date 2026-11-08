import {
  DbbBasketballData,
  isBasketballDataError,
  type BasketballDataErrorKind,
} from '@wolsok/feat-shared-basketball-data';
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { createApp, createRouter, toWebHandler } from 'h3';
import { proxyRouteHandler } from '../../server/dbb/dbb-proxy';
import type { DbbUpstream } from '../../server/dbb/dbb-upstream';
import { PROXY_ROUTES } from '../../shared/dbb-proxy-routes';
import { proxyTransport, type ProxyFetch } from './proxy-transport';

/** The DBB as the fake DBB server answers it, from the recorded fixtures. */
const recordedDbb: DbbUpstream = async ({ method, path }) => {
  const answer = fakeDbbAnswer(method, path);
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

describe('proxyTransport', () => {
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

  it('reads a network failure as unavailable', async () => {
    const offline: ProxyFetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const transport = proxyTransport(offline);

    expect(
      await rejectionKind(transport({ kind: 'team-spiele', teamId: 313036 }))
    ).toBe('unavailable');
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
});
