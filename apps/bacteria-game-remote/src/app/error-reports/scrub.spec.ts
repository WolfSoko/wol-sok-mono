import type { ErrorEvent } from '@sentry/angular';
import { scrubBreadcrumb, scrubEvent, scrubIds, stripUrl } from './scrub';

const UID = 'Xy3kQ9vLm2PzR7tW5nB8cD4fG6hJ';

describe('stripUrl', () => {
  it('drops the hash of an invitation and any query', () => {
    expect(stripUrl('https://bacteria-wars.wolsok.de/#friend=AB12CD')).toBe(
      'https://bacteria-wars.wolsok.de/'
    );
    expect(stripUrl('https://bacteria-wars.wolsok.de/watch/r1?x=1#t=3')).toBe(
      'https://bacteria-wars.wolsok.de/watch/r1'
    );
    expect(stripUrl('/privacy')).toBe('/privacy');
  });
});

describe('scrubIds', () => {
  it('replaces account and document ids, not words or numbers', () => {
    expect(scrubIds(`No document: players/${UID}/storage/progress`)).toBe(
      'No document: players/<id>/storage/progress'
    );
    expect(
      scrubIds('Missing or insufficient permissions 12345678901234567890')
    ).toBe('Missing or insufficient permissions 12345678901234567890');
  });
});

describe('scrubEvent', () => {
  it('drops the user, the cookies, the query and the referrer and strips the URL', () => {
    const event: ErrorEvent = {
      type: undefined,
      user: { id: UID, ip_address: '{{auto}}' },
      request: {
        url: 'https://bacteria-wars.wolsok.de/?ref=mail#friend=AB12CD',
        cookies: { session: 'secret' },
        query_string: 'ref=mail',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://example.com/?who=me',
        },
      },
      exception: {
        values: [{ type: 'FirebaseError', value: `players/${UID} is gone` }],
      },
    };

    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.request).toEqual({
      url: 'https://bacteria-wars.wolsok.de/',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    expect(scrubbed.exception?.values?.[0]?.value).toBe('players/<id> is gone');
  });

  it('leaves an event without request alone', () => {
    const event: ErrorEvent = { type: undefined, message: 'plain' };
    expect(scrubEvent(event)).toEqual({ type: undefined, message: 'plain' });
  });
});

describe('scrubBreadcrumb', () => {
  it('drops console breadcrumbs', () => {
    expect(
      scrubBreadcrumb({ category: 'console', message: `uid ${UID}` })
    ).toBeNull();
  });

  it('strips the URLs of navigations and requests', () => {
    expect(
      scrubBreadcrumb({
        category: 'navigation',
        data: { from: '/#friend=AB12CD', to: '/watch/r1?x=1' },
      })
    ).toEqual({
      category: 'navigation',
      data: { from: '/', to: '/watch/r1' },
    });
    expect(
      scrubBreadcrumb({
        category: 'fetch',
        data: {
          url: `https://firestore.googleapis.com/v1/players/${UID}?key=k`,
          status_code: 403,
        },
      })
    ).toEqual({
      category: 'fetch',
      data: {
        url: 'https://firestore.googleapis.com/v1/players/<id>',
        status_code: 403,
      },
    });
  });
});
