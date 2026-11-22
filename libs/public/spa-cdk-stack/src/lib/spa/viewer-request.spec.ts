import { runInNewContext } from 'node:vm';
import { ViewerRequestOptions, viewerRequestSource } from './viewer-request';

type QueryString = Record<
  string,
  { value: string; multiValue?: { value: string }[] }
>;

interface ViewerRequest {
  uri: string;
  querystring: QueryString;
}

interface RedirectResponse {
  statusCode: number;
  statusDescription: string;
  headers: { location: { value: string } };
}

type Handler = (event: {
  request: ViewerRequest;
}) => ViewerRequest | RedirectResponse;

/** The deployed source itself, run in a context of its own as CloudFront does. */
function handlerFor(options: ViewerRequestOptions): Handler {
  return runInNewContext(
    `${viewerRequestSource(options)}; handler;`
  ) as Handler;
}

function request(uri: string, querystring: QueryString = {}): ViewerRequest {
  return { uri, querystring };
}

function locationOf(response: ViewerRequest | RedirectResponse): string {
  expect(response).toMatchObject({ statusCode: 301 });
  return (response as RedirectResponse).headers.location.value;
}

function uriOf(response: ViewerRequest | RedirectResponse): string {
  expect(response).not.toHaveProperty('statusCode');
  return (response as ViewerRequest).uri;
}

const ASSETS = ['/', '/main-ABC.js', '/blog/x/nat-walls.svg', '/ads.txt'];

describe('viewer request', () => {
  describe('with redirectTrailingSlash only', () => {
    const handler = handlerFor({ redirectTrailingSlash: true });

    it.each([
      ['/career/', '/career'],
      ['/blog/', '/blog'],
      ['/blog/bacteria-wars-turn-relay/', '/blog/bacteria-wars-turn-relay'],
      ['/blog//', '/blog'],
      ['//', '/'],
    ])('redirects %s permanently to %s', (uri, location) => {
      expect(locationOf(handler({ request: request(uri) }))).toBe(location);
    });

    it.each(['//evil.com/', '///evil.com/', '/\\evil.com/'])(
      'keeps the redirect of %s on this site',
      (uri) => {
        const location = locationOf(handler({ request: request(uri) }));

        expect(location).toBe('/evil.com');
        expect(new URL(location, 'https://wolsok.de/x').host).toBe('wolsok.de');
      }
    );

    it('keeps the query string, every value of a repeated key too', () => {
      const response = handler({
        request: request('/career/', {
          a: { value: '1' },
          b: { value: '2', multiValue: [{ value: '2' }, { value: '3' }] },
        }),
      });

      expect(locationOf(response)).toBe('/career?a=1&b=2&b=3');
    });

    it.each([...ASSETS, '/career'])('passes %s on unchanged', (uri) => {
      const original = request(uri);

      expect(handler({ request: original })).toBe(original);
    });
  });

  describe('with resolveFolderIndex only', () => {
    const handler = handlerFor({ resolveFolderIndex: true });

    it.each([
      ['/career', '/career/index.html'],
      [
        '/blog/bacteria-wars-turn-relay',
        '/blog/bacteria-wars-turn-relay/index.html',
      ],
      ['/career/', '/career/index.html'],
      ['/blog/x/', '/blog/x/index.html'],
    ])('serves %s from %s', (uri, resolved) => {
      expect(uriOf(handler({ request: request(uri) }))).toBe(resolved);
    });

    it('leaves the query string as it came', () => {
      const querystring = { a: { value: '1' } };

      const response = handler({ request: request('/career', querystring) });

      expect(response).toEqual({
        uri: '/career/index.html',
        querystring: { a: { value: '1' } },
      });
    });

    it.each(ASSETS)('passes %s on unchanged', (uri) => {
      expect(uriOf(handler({ request: request(uri) }))).toBe(uri);
    });
  });

  describe('with both', () => {
    const handler = handlerFor({
      redirectTrailingSlash: true,
      resolveFolderIndex: true,
    });

    it('redirects a trailing slash before resolving anything', () => {
      expect(locationOf(handler({ request: request('/career/') }))).toBe(
        '/career'
      );
    });

    it('serves the bare path from its folder index', () => {
      expect(uriOf(handler({ request: request('/career') }))).toBe(
        '/career/index.html'
      );
    });

    it.each(ASSETS)('passes %s on unchanged', (uri) => {
      expect(uriOf(handler({ request: request(uri) }))).toBe(uri);
    });
  });
});
