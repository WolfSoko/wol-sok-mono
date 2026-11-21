import { runInNewContext } from 'node:vm';
import { TRAILING_SLASH_REDIRECT_SOURCE } from './trailing-slash-redirect';

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

/** The deployed source itself, run in a context of its own as CloudFront does. */
const handler = runInNewContext(
  `${TRAILING_SLASH_REDIRECT_SOURCE}; handler;`
) as (event: { request: ViewerRequest }) => ViewerRequest | RedirectResponse;

function request(uri: string, querystring: QueryString = {}): ViewerRequest {
  return { uri, querystring };
}

function locationOf(response: ViewerRequest | RedirectResponse): string {
  expect(response).toMatchObject({ statusCode: 301 });
  return (response as RedirectResponse).headers.location.value;
}

describe('trailing-slash redirect', () => {
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

  it.each(['/', '/career', '/main-ABC.js', '/blog/x/nat-walls.svg'])(
    'passes %s on unchanged',
    (uri) => {
      const original = request(uri);

      expect(handler({ request: original })).toBe(original);
    }
  );
});
