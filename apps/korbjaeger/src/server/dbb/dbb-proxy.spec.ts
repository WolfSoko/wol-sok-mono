// @vitest-environment node
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { createApp, createRouter, toWebHandler } from 'h3';
import { DBB_PROXY_CACHE_CONTROL, teamSpieleHandler } from './dbb-proxy';
import { unknownDbbPathHandler } from './dbb-proxy-response';
import { dbbUpstream, type UpstreamFetch } from './dbb-upstream';

const BASE_URL = 'https://dbb.test/rest';
const USER_AGENT = 'Korbjaeger/1.2.3 (+https://korb.wolsok.de)';

/** The DBB, answering from the recorded fixtures with a cookie it sets. */
function recordedDbb(): ReturnType<typeof vi.fn<UpstreamFetch>> {
  return vi.fn<UpstreamFetch>(async (url) => {
    const path = String(url).slice(`${BASE_URL}/`.length);
    const answer = fakeDbbAnswer('GET', path);
    return answer === undefined
      ? new Response('', { status: 404 })
      : new Response(JSON.stringify(answer), {
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'JSESSIONID=abc; Path=/',
          },
        });
  });
}

/** The DBB answering every read with `body` and `status`. */
function dbbAnswering(body: string, status = 200): UpstreamFetch {
  return async () => new Response(body, { status });
}

/** The proxy's routes, as Nitro mounts them, in front of `fetch`. */
function proxy(fetch: UpstreamFetch, timeoutMs = 1000) {
  const upstream = dbbUpstream({
    baseUrl: BASE_URL,
    fetch,
    timeoutMs,
    userAgent: USER_AGENT,
  });
  const router = createRouter()
    .get('/api/dbb/team/:teamId/spiele', teamSpieleHandler(upstream))
    .use('/api/dbb/**', unknownDbbPathHandler);
  const handle = toWebHandler(createApp().use(router));
  return (path: string, init?: RequestInit): Promise<Response> =>
    handle(new Request(`http://localhost${path}`, init));
}

describe('DBB proxy', () => {
  describe('allowlist', () => {
    it("forwards a Team's Spiele to the DBB's team matches", async () => {
      const dbb = recordedDbb();

      const response = await proxy(dbb)('/api/dbb/team/313036/spiele');

      expect(response.status).toBe(200);
      expect(String(dbb.mock.calls[0][0])).toBe(
        `${BASE_URL}/team/id/313036/matches`
      );
    });

    it('passes the DBB body through unchanged', async () => {
      const body = JSON.stringify(
        fakeDbbAnswer('GET', 'team/id/313036/matches')
      );

      const response = await proxy(dbbAnswering(body))(
        '/api/dbb/team/313036/spiele'
      );

      expect(await response.text()).toBe(body);
      expect(response.headers.get('content-type')).toMatch(
        /^application\/json/
      );
    });

    it.each([
      ['a non-numeric id', '/api/dbb/team/abc/spiele'],
      ['a negative id', '/api/dbb/team/-1/spiele'],
      ['a fractional id', '/api/dbb/team/1.5/spiele'],
      ['an id of 0', '/api/dbb/team/0/spiele'],
      ['an id too large', '/api/dbb/team/99999999999999999999/spiele'],
      ['an unknown read', '/api/dbb/team/313036/spieler'],
      ['a DBB path', '/api/dbb/team/id/313036/matches'],
      ['the bare prefix', '/api/dbb'],
    ])('answers %s with 404 and never asks the DBB', async (_case, path) => {
      const dbb = recordedDbb();

      const response = await proxy(dbb)(path);

      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBeNull();
      expect(dbb).not.toHaveBeenCalled();
    });

    it('answers another method than GET with 404', async () => {
      const dbb = recordedDbb();

      const response = await proxy(dbb)('/api/dbb/team/313036/spiele', {
        method: 'POST',
      });

      expect(response.status).toBe(404);
      expect(dbb).not.toHaveBeenCalled();
    });
  });

  describe('cache headers', () => {
    it('lets browser and CDN cache a success', async () => {
      const response = await proxy(recordedDbb())(
        '/api/dbb/team/313036/spiele'
      );

      expect(response.headers.get('cache-control')).toBe(
        'public, max-age=60, s-maxage=300'
      );
      expect(DBB_PROXY_CACHE_CONTROL).toBe('public, max-age=60, s-maxage=300');
    });

    it.each([
      ['DBB status "1"', recordedDbb(), '/api/dbb/team/7/spiele'],
      [
        'DBB status "-1"',
        dbbAnswering('{"status":"-1","data":null}'),
        '/api/dbb/team/7/spiele',
      ],
      ['an upstream 5xx', dbbAnswering('', 503), '/api/dbb/team/7/spiele'],
    ])('sets none on %s', async (_case, dbb, path) => {
      const response = await proxy(dbb)(path);

      expect(response.status).not.toBe(200);
      expect(response.headers.get('cache-control')).toBeNull();
    });
  });

  describe('errors', () => {
    it('answers DBB status "1" with 404 and the DBB body', async () => {
      const body = JSON.stringify(fakeDbbAnswer('GET', 'team/id/7/matches'));

      const response = await proxy(dbbAnswering(body))(
        '/api/dbb/team/7/spiele'
      );

      expect(response.status).toBe(404);
      expect(await response.text()).toBe(body);
    });

    it('answers DBB status "-1" with 502', async () => {
      const response = await proxy(
        dbbAnswering('{"status":"-1","message":"Internal Server Error"}')
      )('/api/dbb/team/313036/spiele');

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: 'dbb-unavailable' });
    });

    it.each([500, 502, 503])(
      'answers an upstream %i with 502',
      async (status) => {
        const response = await proxy(dbbAnswering('oops', status))(
          '/api/dbb/team/313036/spiele'
        );

        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({ error: 'dbb-unavailable' });
      }
    );

    it('answers an upstream timeout with 502', async () => {
      const hanging: UpstreamFetch = (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          )
        );

      const response = await proxy(hanging, 5)('/api/dbb/team/313036/spiele');

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: 'dbb-unavailable' });
    });

    it('answers a network error with 502', async () => {
      const unreachable: UpstreamFetch = async () => {
        throw new TypeError('fetch failed');
      };

      const response = await proxy(unreachable)('/api/dbb/team/313036/spiele');

      expect(response.status).toBe(502);
    });

    it.each([
      ['no JSON', 'Service Unavailable'],
      ['no envelope', '[]'],
      ['an unknown status', '{"status":"2"}'],
    ])('answers a DBB body with %s with 502', async (_case, body) => {
      const response = await proxy(dbbAnswering(body))(
        '/api/dbb/team/313036/spiele'
      );

      expect(response.status).toBe(502);
    });
  });

  describe('upstream call', () => {
    it('forwards no cookies to the DBB', async () => {
      const dbb = recordedDbb();

      await proxy(dbb)('/api/dbb/team/313036/spiele', {
        headers: { cookie: 'session=parent', authorization: 'Bearer x' },
      });

      const headers = new Headers(dbb.mock.calls[0][1].headers);
      expect(headers.get('cookie')).toBeNull();
      expect(headers.get('authorization')).toBeNull();
    });

    it('passes no cookie of the DBB back', async () => {
      const response = await proxy(recordedDbb())(
        '/api/dbb/team/313036/spiele'
      );

      expect(response.headers.get('set-cookie')).toBeNull();
    });

    it('sends its own User-Agent', async () => {
      const dbb = recordedDbb();

      await proxy(dbb)('/api/dbb/team/313036/spiele', {
        headers: { 'user-agent': 'Parent Browser' },
      });

      const headers = new Headers(dbb.mock.calls[0][1].headers);
      expect(headers.get('user-agent')).toBe(USER_AGENT);
    });

    it('sends no credentials and follows no cookie jar', async () => {
      const dbb = recordedDbb();

      await proxy(dbb)('/api/dbb/team/313036/spiele');

      expect(dbb.mock.calls[0][1].credentials).toBe('omit');
    });
  });
});
