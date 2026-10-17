import { FEATURED_POLLS } from '../../shared/featured-polls';
import { pollUrl, SITE_URL } from '../../shared/site-url';

/** A listed poll, as far as the sitemap cares. */
export type SitemapPoll = {
  id: string;
  createdAt: Date;
  closesAt: Date;
};

export type SitemapEntry = {
  loc: string;
  lastmod?: Date;
};

/**
 * The indexable pages: home, the poll search, the featured polls and every
 * listed poll that still takes votes. Personal pages (my polls, admin) and
 * unlisted polls are `noindex`, so they stay out.
 */
export function sitemapEntries(
  polls: readonly SitemapPoll[],
  now: Date = new Date()
): SitemapEntry[] {
  const featuredIds = new Set(FEATURED_POLLS.map(({ id }) => id));
  return [
    { loc: `${SITE_URL}/` },
    { loc: `${SITE_URL}/polls` },
    ...FEATURED_POLLS.map(({ id }) => ({ loc: pollUrl(id) })),
    ...polls
      .filter(
        ({ id, closesAt }) =>
          !featuredIds.has(id) && closesAt.getTime() > now.getTime()
      )
      .map(({ id, createdAt }) => ({ loc: pollUrl(id), lastmod: createdAt })),
  ];
}

export function sitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries.map(({ loc, lastmod }) =>
    [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod.toISOString()}</lastmod>`] : []),
      '  </url>',
    ].join('\n')
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
