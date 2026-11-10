import {
  CLUB_INDEX_CRAWL_DAYS,
  FIRESTORE_REGION,
} from '@wolsok/feat-shared-korbjaeger-account';
import { days, dToMs, minutes, mToMs } from '@wolsok/utils-time';

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

/**
 * How the club index calls the DBB (ADR 0018, its amendment of #2988). The
 * User-Agent carries no version, unlike the proxy's: `@wolsok/utils-version`
 * would redeploy the functions with every release.
 */
export const CLUB_INDEX_DBB = {
  /** Names the app, as the proxy's User-Agent does, with the app's URL. */
  userAgent: 'Korbjaeger-ClubIndex (+https://korb.wolsok.de)',
  /** One request at a time, this far apart. */
  pauseMs: 1000,
  timeoutMs: 15_000,
} as const;

/**
 * When the club index crawls an Association (`ClubIndexSchedule`), its
 * days shared with the privacy policy (`CLUB_INDEX_CRAWL_DAYS`).
 */
export const CLUB_INDEX_SCHEDULE = {
  maxAgeMs: dToMs(days(CLUB_INDEX_CRAWL_DAYS.maxAge)),
  retryAfterMs: dToMs(days(CLUB_INDEX_CRAWL_DAYS.retryAfter)),
  /**
   * The first fill of a large Association reads one name per Club (Bayern:
   * about 900 requests in all), so after this a Team's name stands in,
   * read again a day later, well inside the run's 30 minutes.
   */
  namesForMs: mToMs(minutes(20)),
} as const;
