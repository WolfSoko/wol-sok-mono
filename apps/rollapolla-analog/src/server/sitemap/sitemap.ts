import { FEATURED_POLLS } from '../../shared/featured-polls';
import { isOpen } from '../../shared/poll';
import { pollUrl, SITE_URL } from '../../shared/site-url';

/** A listed poll, as far as the sitemap cares. */
export type SitemapPoll = {
  id: string;
  closesAt: Date;
};

/**
 * The URLs of the indexable pages: home, the poll search, the privacy policy, the featured polls and every
 * listed poll that still takes votes. Personal pages (my polls, admin) and
 * unlisted polls are `noindex`, so they stay out.
 */
export function sitemapUrls(
  polls: readonly SitemapPoll[],
  now: Date = new Date()
): string[] {
  const featuredIds = new Set(FEATURED_POLLS.map(({ id }) => id));
  return [
    `${SITE_URL}/`,
    `${SITE_URL}/polls`,
    `${SITE_URL}/privacy`,
    ...FEATURED_POLLS.map(({ id }) => pollUrl(id)),
    // no lastmod: an edit changes a poll without a date to tell
    ...polls
      .filter((poll) => !featuredIds.has(poll.id) && isOpen(poll, now))
      .map(({ id }) => pollUrl(id)),
  ];
}

export function sitemapXml(locs: readonly string[]): string {
  const urls = locs.map(
    (loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`
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
