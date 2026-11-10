import { isBasketballDataError } from '@wolsok/feat-shared-basketball-data';
import { KeinInternetError } from '../basketball-data/kein-internet-error';
import type { ProxyFetch } from '../basketball-data/proxy-call';
import { CLUB_INDEX_PATH, proxyClubIndex } from './club-index';

const POST_SV = {
  id: 1476,
  name: 'Post SV Nürnberg',
  associations: [{ id: 2, name: 'Bayern' }],
};

function answering(status: number, body: string): ProxyFetch {
  return async () => new Response(body, { status });
}

const signal = new AbortController().signal;

describe('proxyClubIndex', () => {
  it('reads the index from the club route', async () => {
    const proxy = vi.fn<ProxyFetch>(answering(200, JSON.stringify([POST_SV])));

    await expect(proxyClubIndex(proxy)(signal)).resolves.toEqual([POST_SV]);
    expect(proxy).toHaveBeenCalledWith(CLUB_INDEX_PATH, expect.anything());
    expect(CLUB_INDEX_PATH).toBe('/api/clubs');
  });

  it('calls no server where the browser is offline', async () => {
    const proxy = vi.fn<ProxyFetch>();

    await expect(
      proxyClubIndex(proxy, { online: () => false })(signal)
    ).rejects.toBeInstanceOf(KeinInternetError);
    expect(proxy).not.toHaveBeenCalled();
  });

  it('is offline where no server answers', async () => {
    const error = await proxyClubIndex(async () => {
      throw new TypeError('Failed to fetch');
    })(signal).catch((e: unknown) => e);

    expect(isBasketballDataError(error, 'offline')).toBe(true);
  });

  it('is offline where the server answers too late', async () => {
    const hanging: ProxyFetch = (_url, init) =>
      new Promise((_resolve, reject) =>
        init.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason)
        )
      );

    const error = await proxyClubIndex(hanging, { zeitlimitMs: 1 })(
      signal
    ).catch((e: unknown) => e);

    expect(isBasketballDataError(error, 'offline')).toBe(true);
  });

  it('is unavailable for a failed read of the index', async () => {
    const error = await proxyClubIndex(answering(502, '{}'))(signal).catch(
      (e: unknown) => e
    );

    expect(isBasketballDataError(error, 'unavailable')).toBe(true);
  });

  it('is unexpected-shape for a body that is no index', async () => {
    const error = await proxyClubIndex(answering(200, '{"clubs":[]}'))(
      signal
    ).catch((e: unknown) => e);

    expect(isBasketballDataError(error, 'unexpected-shape')).toBe(true);
  });
});
