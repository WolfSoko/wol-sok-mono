import { directDbbTransport } from './dbb-transport';

describe('directDbbTransport', () => {
  function transportAnswering(response: Response) {
    const calls: [string, RequestInit][] = [];
    const transport = directDbbTransport({
      baseUrl: 'https://dbb.test/rest/',
      fetch: async (url, init) => {
        calls.push([url, init]);
        return response;
      },
      timeoutMs: 1000,
      userAgent: 'Korbjaeger-Test',
    });
    return { transport, calls };
  }

  it('reads an allowlisted path with its own User-Agent and no cookies', async () => {
    const { transport, calls } = transportAnswering(
      new Response('{"status":"0"}', { status: 200 })
    );

    await expect(
      transport({ kind: 'spielplan', ligaId: 54862 })
    ).resolves.toEqual({
      status: '0',
    });
    const [url, init] = calls[0];
    expect(url).toBe('https://dbb.test/rest/competition/spielplan/id/54862');
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      headers: { accept: 'application/json', 'user-agent': 'Korbjaeger-Test' },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws on any other status', async () => {
    const { transport } = transportAnswering(new Response('', { status: 503 }));

    await expect(transport({ kind: 'tabelle', ligaId: 1 })).rejects.toThrow(
      'HTTP 503'
    );
  });

  it('builds no call for a read the allowlist refuses', async () => {
    const { transport, calls } = transportAnswering(new Response('{}'));

    await expect(transport({ kind: 'tabelle', ligaId: -1 })).rejects.toThrow(
      RangeError
    );
    expect(calls).toEqual([]);
  });
});
