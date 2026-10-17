import { FEATURED_POLLS } from '../../shared/featured-polls';
import { sitemapUrls, sitemapXml } from './sitemap';

const now = new Date('2026-10-17T12:00:00Z');

function poll(id: string, closesAt: string) {
  return { id, closesAt: new Date(closesAt) };
}

describe('sitemapUrls', () => {
  it('lists home, the poll search and the featured polls', () => {
    expect(sitemapUrls([], now)).toEqual([
      'https://rollapolla.com/',
      'https://rollapolla.com/polls',
      ...FEATURED_POLLS.map(({ id }) => `https://rollapolla.com/poll/${id}`),
    ]);
  });

  it('adds open listed polls', () => {
    expect(sitemapUrls([poll('abc', '2026-10-31T00:00:00Z')], now).at(-1)).toBe(
      'https://rollapolla.com/poll/abc'
    );
  });

  it('leaves out closed polls, the TTL deletes them soon', () => {
    expect(
      sitemapUrls([poll('old', '2026-10-17T11:00:00Z')], now)
    ).not.toContain('https://rollapolla.com/poll/old');
  });

  it('lists a stored featured poll only once', () => {
    const featuredId = FEATURED_POLLS[0].id;
    const urls = sitemapUrls([poll(featuredId, '2027-01-01T00:00:00Z')], now);

    expect(
      urls.filter((url) => url.endsWith(`/poll/${featuredId}`))
    ).toHaveLength(1);
  });
});

describe('sitemapXml', () => {
  it('writes a urlset', () => {
    expect(
      sitemapXml(['https://rollapolla.com/', 'https://rollapolla.com/poll/abc'])
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        '    <loc>https://rollapolla.com/</loc>',
        '  </url>',
        '  <url>',
        '    <loc>https://rollapolla.com/poll/abc</loc>',
        '  </url>',
        '</urlset>',
        '',
      ].join('\n')
    );
  });

  it('escapes XML special characters', () => {
    expect(sitemapXml(['https://rollapolla.com/?a=1&b=<2>'])).toContain(
      '<loc>https://rollapolla.com/?a=1&amp;b=&lt;2&gt;</loc>'
    );
  });
});
