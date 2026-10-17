import { defineEventHandler, setResponseHeaders } from 'h3';
import { listedPolls } from '../sitemap/listed-polls';
import { sitemapUrls, SitemapPoll, sitemapXml } from '../sitemap/sitemap';

/** GET /sitemap.xml, linked from robots.txt */
export default defineEventHandler(async (event) => {
  let polls: SitemapPoll[] | undefined;
  try {
    polls = await listedPolls();
  } catch (error) {
    // the static pages are still worth listing
    console.error('sitemap.xml: could not read the listed polls', error);
  }
  setResponseHeaders(event, {
    'content-type': 'application/xml; charset=utf-8',
    // Firebase Hosting's CDN keeps it for an hour, a fallback only briefly
    'cache-control': polls
      ? 'public, max-age=3600, s-maxage=3600'
      : 'public, max-age=60, s-maxage=60',
  });
  return sitemapXml(sitemapUrls(polls ?? []));
});
