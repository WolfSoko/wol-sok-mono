// @vitest-environment node
import { dbbUpstream, type UpstreamFetch } from './dbb-upstream';

describe('dbbUpstream', () => {
  it('gives up on the DBB after its timeout', async () => {
    const hanging: UpstreamFetch = (_url, init) =>
      new Promise((_resolve, reject) =>
        init.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason)
        )
      );
    const upstream = dbbUpstream({
      baseUrl: 'https://dbb.test/rest',
      fetch: hanging,
      timeoutMs: 5,
      userAgent: 'Korbjaeger/test',
    });

    const answer = await upstream({ method: 'GET', path: 'team/id/1/matches' });

    expect(answer).toEqual({
      ok: false,
      reason: expect.stringContaining('TimeoutError'),
    });
  });
});
