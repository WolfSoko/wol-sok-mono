import { defineEventHandler, setResponseHeaders } from 'h3';
import { listedPolls } from '../sitemap/listed-polls';
import { sitemapEntries, SitemapPoll, sitemapXml } from '../sitemap/sitemap';

/** GET /sitemap.xml, linked from robots.txt */
export default defineEventHandler(async (event) => {
  let polls: SitemapPoll[] = [];
  try {
    polls = await listedPolls();
  } catch (error) {
    // the static pages are still worth listing
    console.error('sitemap.xml: could not read the listed polls', error);
  }
  setResponseHeaders(event, {
    'content-type': 'application/xml; charset=utf-8',
    // Firebase Hosting's CDN keeps it for an hour
    'cache-control': 'public, max-age=3600, s-maxage=3600',
  });
  return sitemapXml(sitemapEntries(polls));
});
