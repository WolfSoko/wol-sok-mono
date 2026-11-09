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
