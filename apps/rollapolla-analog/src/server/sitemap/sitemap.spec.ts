import { FEATURED_POLLS } from '../../shared/featured-polls';
import { sitemapEntries, sitemapXml } from './sitemap';

const now = new Date('2026-10-17T12:00:00Z');

function poll(id: string, closesAt: string) {
  return {
    id,
    createdAt: new Date('2026-10-01T08:00:00Z'),
    closesAt: new Date(closesAt),
  };
}

describe('sitemapEntries', () => {
  it('lists home, the poll search and the featured polls', () => {
    const locs = sitemapEntries([], now).map(({ loc }) => loc);

    expect(locs).toEqual([
      'https://rollapolla.com/',
      'https://rollapolla.com/polls',
      ...FEATURED_POLLS.map(({ id }) => `https://rollapolla.com/poll/${id}`),
    ]);
  });

  it('adds open listed polls with their creation date', () => {
    const entries = sitemapEntries([poll('abc', '2026-10-31T00:00:00Z')], now);

    expect(entries.at(-1)).toEqual({
      loc: 'https://rollapolla.com/poll/abc',
      lastmod: new Date('2026-10-01T08:00:00Z'),
    });
  });

  it('leaves out closed polls, the TTL deletes them soon', () => {
    const entries = sitemapEntries([poll('old', '2026-10-17T11:00:00Z')], now);

    expect(entries.map(({ loc }) => loc)).not.toContain(
      'https://rollapolla.com/poll/old'
    );
  });

  it('lists a stored featured poll only once', () => {
    const featuredId = FEATURED_POLLS[0].id;
    const entries = sitemapEntries(
      [poll(featuredId, '2027-01-01T00:00:00Z')],
      now
    );

    expect(
      entries.filter(({ loc }) => loc.endsWith(`/poll/${featuredId}`))
    ).toHaveLength(1);
  });
});

describe('sitemapXml', () => {
  it('writes a urlset with lastmod where known', () => {
    const xml = sitemapXml([
      { loc: 'https://rollapolla.com/' },
      {
        loc: 'https://rollapolla.com/poll/abc',
        lastmod: new Date('2026-10-01T08:00:00Z'),
      },
    ]);

    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        '    <loc>https://rollapolla.com/</loc>',
        '  </url>',
        '  <url>',
        '    <loc>https://rollapolla.com/poll/abc</loc>',
        '    <lastmod>2026-10-01T08:00:00.000Z</lastmod>',
        '  </url>',
        '</urlset>',
        '',
      ].join('\n')
    );
  });

  it('escapes XML special characters', () => {
    expect(
      sitemapXml([{ loc: 'https://rollapolla.com/?a=1&b=<2>' }])
    ).toContain('<loc>https://rollapolla.com/?a=1&amp;b=&lt;2&gt;</loc>');
  });
});
