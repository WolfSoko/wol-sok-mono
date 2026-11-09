import { FIRESTORE_REGION } from '@wolsok/feat-shared-korbjaeger-account';

/**
 * Where Korbjäger's functions run: next to the Firestore database they
 * write. The app's Nitro function runs elsewhere, in `REGIONS.function`.
 */
export const REGION = FIRESTORE_REGION.id;

/**
 * Whether `clubIndex` is deployed (#2988): on, so the club index fills
 * within about a day of the first deploy and refreshes weekly. `false`
 * takes it out of the next deploy (`--force` deletes it); the stored
 * lists stay and `/api/clubs` keeps serving them.
 */
export const CLUB_INDEX_ON = true;

/** How the club index calls the DBB (ADR 0018, its amendment of #2988). */
export const CLUB_INDEX_DBB = {
  /** Names the app, as the proxy's User-Agent does, with the app's URL. */
  userAgent: 'Korbjaeger-ClubIndex (+https://korb.wolsok.de)',
  /** One request at a time, this far apart. */
  pauseMs: 1000,
  timeoutMs: 15_000,
  /** How old a list grows before its Association is crawled again. */
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  /** How long after a crawl that left no list it is tried again. */
  retryAfterMs: 24 * 60 * 60 * 1000,
  /**
   * How long into a run Clubs' names are still read: the first fill of a
   * large Association reads one per Club (Bayern: about 900 requests in
   * all), so after this a Team's name stands in, read again next week,
   * well inside the run's 30 minutes.
   */
  namesForMs: 20 * 60 * 1000,
} as const;
