/**
 * How long an answer of the DBB proxy may be reused, in seconds (ADR 0018):
 * a minute in the browser, five minutes in Firebase Hosting's CDN, an hour
 * there for a played Spiel's Spielbericht, which the DBB rarely changes
 * once its result and Kader are in. The proxy's headers and the privacy
 * policy both take them from here.
 */
export const PROXY_CACHE_SEKUNDEN = {
  browser: 60,
  cdn: 300,
  cdnFertigerSpielbericht: 3600,
} as const;

/**
 * How long the club index (`/api/clubs`, #2988) may be reused, in seconds.
 * `complete`, once every Verband has its list: an hour in the browser, a
 * day in the CDN, since its lists change weekly and a long CDN cache keeps
 * nearly every request off the server and Firestore. `filling`, while it
 * is empty or misses a Verband (#3005): as briefly as the DBB proxy's, so
 * each hourly crawl shows within minutes. The route's headers and the
 * privacy policy both take them from here.
 */
export const CLUB_INDEX_CACHE_SECONDS = {
  complete: { browser: 3600, cdn: 86_400 },
  filling: {
    browser: PROXY_CACHE_SEKUNDEN.browser,
    cdn: PROXY_CACHE_SEKUNDEN.cdn,
  },
} as const;
