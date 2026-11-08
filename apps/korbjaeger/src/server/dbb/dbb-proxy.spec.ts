// @vitest-environment node
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { dbbHttpRequest } from '@wolsok/feat-shared-basketball-data';
import { createApp, createRouter, toWebHandler, type EventHandler } from 'h3';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROXY_ROUTES,
  paramOf,
  type AnyProxyRoute,
  type ProxyKind,
} from '../../shared/dbb-proxy-routes';
import {
  DBB_PROXY_CACHE_CONTROL,
  FINISHED_BOXSCORE_CACHE_CONTROL,
} from './dbb-proxy';
import { PROXY_USER_AGENT } from './dbb-upstream-config';
import type { UpstreamFetch } from './dbb-upstream';

const BASE_URL = 'https://dbb.test/rest';

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

/** Each route's file, imported as Nitro's file routing would find it. */
const ROUTE_FILES: {
  readonly [K in ProxyKind]: () => Promise<{ readonly default: EventHandler }>;
} = {
  'team-spiele': () => import('../routes/api/dbb/team/[teamId]/spiele.get'),
  tabelle: () => import('../routes/api/dbb/liga/[ligaId]/tabelle.get'),
  'spiel-info': () => import('../routes/api/dbb/spiel/[spielId].get'),
  spielbericht: () => import('../routes/api/dbb/spiel/[spielId]/bericht.get'),
};

const KINDS = Object.keys(PROXY_ROUTES) as ProxyKind[];

/** `route`'s path with `id` (a number, or anything a visitor types). */
function pathWith(route: AnyProxyRoute, id: number | string): string {
  return route.pattern.replace(`:${paramOf(route)}`, String(id));
}

/** Where Nitro's file routing looks for `route`'s file. */
function routeFile(route: AnyProxyRoute): string {
  return join(
    __dirname,
    '../routes',
    `${pathWith(route, `[${paramOf(route)}]`)}.get.ts`
  );
}

/**
 * The real route files, mounted where Nitro's file routing puts them:
 * `*.get.ts` for GET only, `index.ts` and `[...].ts` for any method.
 */
async function proxyRoutes(): Promise<(request: Request) => Promise<Response>> {
  const router = createRouter();
  for (const kind of KINDS) {
    router.get(PROXY_ROUTES[kind].pattern, (await ROUTE_FILES[kind]()).default);
  }
  const [prefix, rest] = await Promise.all([
    import('../routes/api/dbb/index'),
    import('../routes/api/dbb/[...]'),
  ]);
  router.use('/api/dbb', prefix.default).use('/api/dbb/**', rest.default);
  return toWebHandler(createApp().use(router));
}

/** Each route with an id the fake DBB has a recording of. */
const ROUTES = [
  { name: "a Team's Spiele", route: PROXY_ROUTES['team-spiele'], id: 313036 },
  { name: "a Liga's Tabelle", route: PROXY_ROUTES.tabelle, id: 54862 },
  {
    name: "a Spiel's match info",
    route: PROXY_ROUTES['spiel-info'],
    id: 2911141,
  },
  {
    // planned, so no Spielbericht yet: cached as any other read
    name: "a Spiel's Spielbericht",
    route: PROXY_ROUTES.spielbericht,
    id: 2843814,
  },
] as const;

/** The DBB path `route` reads for `id`. */
function dbbPath(route: AnyProxyRoute, id: number): string {
  return dbbHttpRequest(route.read(id)).path;
}

let handle: (request: Request) => Promise<Response>;

// Nitro's runtime config, as `vite.config.ts` and NITRO_DBB_BASE_URL set it
vi.mock('nitropack/runtime', () => ({
  useRuntimeConfig: () => ({ dbbBaseUrl: 'https://dbb.test/rest' }),
}));

beforeAll(async () => {
  handle = await proxyRoutes();
});

beforeEach(() => {
  // a failed read warns; the specs below that care read it through warnings()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The proxy's routes in front of `fetch` as the DBB. */
function proxy(fetch: UpstreamFetch) {
  vi.stubGlobal('fetch', fetch);
  return (path: string, init?: RequestInit): Promise<Response> =>
    handle(new Request(`http://localhost${path}`, init));
}

/** What the proxy warned about, one text per warning. */
function warnings(): () => readonly string[] {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  return () => warn.mock.calls.map((args) => args.map(String).join(' '));
}

describe('DBB proxy', () => {
  it.each(KINDS)(
    'serves %s from its route file where Nitro finds it',
    (kind) => {
      expect(existsSync(routeFile(PROXY_ROUTES[kind]))).toBe(true);
    }
  );

  describe.each(ROUTES)('$name', ({ route, id }) => {
    const path = pathWith(route, id);
    const unknown = 7;

    describe('allowlist', () => {
      it("forwards to the DBB's read", async () => {
        const dbb = recordedDbb();

        const response = await proxy(dbb)(path);

        expect(response.status).toBe(200);
        expect(String(dbb.mock.calls[0][0])).toBe(
          `${BASE_URL}/${dbbPath(route, id)}`
        );
      });

      it('passes the DBB body through unchanged', async () => {
        const body = JSON.stringify(fakeDbbAnswer('GET', dbbPath(route, id)));

        const response = await proxy(dbbAnswering(body))(path);

        expect(await response.text()).toBe(body);
        expect(response.headers.get('content-type')).toMatch(
          /^application\/json/
        );
      });

      it.each([
        ['a non-numeric id', 'abc'],
        ['a negative id', '-1'],
        ['a fractional id', '1.5'],
        ['an id of 0', '0'],
        ['an id too large', '99999999999999999999'],
      ])('answers %s with 404 and never asks the DBB', async (_case, bad) => {
        const dbb = recordedDbb();

        const response = await proxy(dbb)(pathWith(route, bad));

        expect(response.status).toBe(404);
        expect(response.headers.get('cache-control')).toBeNull();
        expect(dbb).not.toHaveBeenCalled();
      });

      it('answers another method than GET with 404', async () => {
        const dbb = recordedDbb();

        const response = await proxy(dbb)(path, { method: 'POST' });

        expect(response.status).toBe(404);
        expect(dbb).not.toHaveBeenCalled();
      });
    });

    describe('cache headers', () => {
      it('lets browser and CDN cache a success', async () => {
        const response = await proxy(recordedDbb())(path);

        expect(response.headers.get('cache-control')).toBe(
          'public, max-age=60, s-maxage=300'
        );
        expect(DBB_PROXY_CACHE_CONTROL).toBe(
          'public, max-age=60, s-maxage=300'
        );
      });
    });

    describe('errors', () => {
      it('answers DBB status "1" with 404 and the DBB body, not cached', async () => {
        const body = JSON.stringify(
          fakeDbbAnswer('GET', dbbPath(route, unknown))
        );

        const response = await proxy(dbbAnswering(body))(
          pathWith(route, unknown)
        );

        expect(response.status).toBe(404);
        expect(await response.text()).toBe(body);
        expect(response.headers.get('cache-control')).toBeNull();
      });

      it.each([
        ['DBB status "-1"', dbbAnswering('{"status":"-1","message":"x"}')],
        ['an upstream 500', dbbAnswering('oops', 500)],
        ['an upstream 502', dbbAnswering('oops', 502)],
        ['an upstream 503', dbbAnswering('', 503)],
        [
          'an upstream timeout',
          async () => {
            throw new DOMException('The operation timed out.', 'TimeoutError');
          },
        ],
        [
          'a network error',
          async () => {
            throw new TypeError('fetch failed');
          },
        ],
        ['a DBB body with no JSON', dbbAnswering('Service Unavailable')],
        ['a DBB body with no envelope', dbbAnswering('[]')],
        ['a DBB body with an unknown status', dbbAnswering('{"status":"2"}')],
      ] as ReadonlyArray<[string, UpstreamFetch]>)(
        'answers %s with 502, not cached',
        async (_case, dbb) => {
          const response = await proxy(dbb)(path);

          expect(response.status).toBe(502);
          expect(await response.json()).toEqual({ error: 'dbb-unavailable' });
          expect(response.headers.get('cache-control')).toBeNull();
        }
      );
    });
  });

  describe("a played Spiel's Spielbericht", () => {
    it.each([
      ['with Spielerwerte', 2911141],
      ['with the Kader only', 2861436],
    ])('lets the CDN keep it an hour, %s', async (_case, spielId) => {
      const response = await proxy(recordedDbb())(
        `/api/dbb/spiel/${spielId}/bericht`
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe(
        'public, max-age=60, s-maxage=3600'
      );
      expect(FINISHED_BOXSCORE_CACHE_CONTROL).toBe(
        'public, max-age=60, s-maxage=3600'
      );
    });

    it("keeps the played Spiel's match info five minutes only", async () => {
      const response = await proxy(recordedDbb())('/api/dbb/spiel/2911141');

      expect(response.headers.get('cache-control')).toBe(
        DBB_PROXY_CACHE_CONTROL
      );
    });
  });

  it.each([
    ['an unknown read', '/api/dbb/team/313036/spieler'],
    ['a DBB path', '/api/dbb/team/id/313036/matches'],
    ['a DBB Tabelle path', '/api/dbb/competition/table/id/54862'],
    ['a DBB boxscore path', '/api/dbb/match/id/2911141/boxscore'],
    ['more after a Spielbericht', '/api/dbb/spiel/2911141/bericht/1'],
    ['the bare prefix', '/api/dbb'],
    ['the prefix with a slash', '/api/dbb/'],
  ])('answers %s with 404 and never asks the DBB', async (_case, path) => {
    const dbb = recordedDbb();

    const response = await proxy(dbb)(path);

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBeNull();
    expect(dbb).not.toHaveBeenCalled();
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
      expect(headers.get('user-agent')).toBe(PROXY_USER_AGENT);
    });

    it('sends no credentials and follows no cookie jar', async () => {
      const dbb = recordedDbb();

      await proxy(dbb)('/api/dbb/team/313036/spiele');

      expect(dbb.mock.calls[0][1].credentials).toBe('omit');
    });
  });

  describe('logs', () => {
    it.each([
      ['an upstream 5xx', dbbAnswering('oops', 503), 'HTTP 503'],
      [
        'a timeout',
        async () => {
          throw new DOMException('The operation timed out.', 'TimeoutError');
        },
        'TimeoutError',
      ],
      [
        'a redirect',
        async () => {
          throw new TypeError('fetch failed', {
            cause: new Error('unexpected redirect'),
          });
        },
        'unexpected redirect',
      ],
      ['DBB status "-1"', dbbAnswering('{"status":"-1"}'), 'DBB status -1'],
      ['no envelope', dbbAnswering('<html>busy</html>'), 'no DBB envelope'],
    ] as ReadonlyArray<[string, UpstreamFetch, string]>)(
      'why the DBB failed on %s, naming the read',
      async (_case, dbb, reason) => {
        const logged = warnings();

        await proxy(dbb)('/api/dbb/team/313036/spiele');

        expect(logged()).toEqual([
          expect.stringContaining('GET team/id/313036/matches'),
        ]);
        expect(logged()[0]).toContain(reason);
      }
    );

    it("logs neither the DBB's body nor anything of the visitor", async () => {
      const logged = warnings();

      await proxy(dbbAnswering('<html>secret page</html>'))(
        '/api/dbb/team/313036/spiele',
        {
          headers: { cookie: 'session=parent', 'user-agent': 'Parent Browser' },
        }
      );

      expect(logged().join('\n')).not.toMatch(/secret|session|Parent/);
    });

    it('logs nothing on success or a Team the DBB does not know', async () => {
      const logged = warnings();

      await proxy(recordedDbb())('/api/dbb/team/313036/spiele');
      await proxy(recordedDbb())('/api/dbb/team/7/spiele');

      expect(logged()).toEqual([]);
    });
  });
});
