import {
  DbbBasketballData,
  UnsupportedDbbRequestError,
  isBasketballDataError,
  type BasketballDataErrorKind,
} from '@wolsok/feat-shared-basketball-data';
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { proxyTransport, type ProxyFetch } from './proxy-transport';

/** The app's proxy, answering with the DBB's recorded bodies. */
function recordedProxy(): ReturnType<typeof vi.fn<ProxyFetch>> {
  return vi.fn<ProxyFetch>(async (url) => {
    const teamId = /^\/api\/dbb\/team\/(\d+)\/spiele$/.exec(url)?.[1];
    const answer = fakeDbbAnswer('GET', `team/id/${teamId}/matches`);
    const status = isNotFound(answer) ? 404 : 200;
    return new Response(JSON.stringify(answer), { status });
  });
}

function isNotFound(answer: unknown): boolean {
  return (answer as { readonly status: string }).status === '1';
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

  it('refuses a read the proxy has no route for yet, as a bug, without a call', async () => {
    const proxy = recordedProxy();
    const data = new DbbBasketballData(proxyTransport(proxy));

    const error = await data.tabelle(54308).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnsupportedDbbRequestError);
    expect((error as UnsupportedDbbRequestError).kind).toBe('tabelle');
    expect(proxy).not.toHaveBeenCalled();
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
});
