/**
 * Where and within which limits the game's functions run (ADR 0011).
 */

/**
 * The functions' region: the Firestore location of `bacteria-wars`
 * (`gcloud firestore databases describe`, confirmed by the owner on
 * 2026-10-25), where the Realtime Database and the secrets are too.
 * Firestore triggers must run there.
 */
export const REGION = 'europe-west1';

/**
 * The project's Realtime Database (ADR 0010, 0012), where the admin
 * commands mirror bans and drop a banned player's presence - the URL the
 * game's `environment.prod.ts` names, rather than one the runtime guesses.
 */
export const RTDB_URL =
  'https://bacteria-wars-default-rtdb.europe-west1.firebasedatabase.app';

/**
 * How many replays one player may submit in an hour - unranked and ranked
 * each (ADR 0012), so unranked uploads never push out a ranked one.
 */
export const SUBMISSIONS_PER_HOUR = 60;

/**
 * How many unranked replays the server takes in a UTC day, from everyone
 * together: it bounds storage and writes, as guest accounts are free.
 */
export const DAILY_SUBMISSIONS = 5_000;

/**
 * How many ranked replays (with a declared attempt) it takes in a UTC day
 * (ADR 0012) - apart from the unranked ones, which could otherwise use up
 * the day for everyone.
 */
export const DAILY_RANKED_SUBMISSIONS = 20_000;

/**
 * An online replay still waiting for its second report this long after
 * the first is closed as "Not reported" (ADR 0012) - its `closeAt`.
 */
export const NOT_REPORTED_AFTER_MS = 2 * 60 * 60 * 1000;

/** How long a private replay is kept: 30 days after the match. */
export const REPLAY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * How long `rankReplay` keeps retrying an event (ADR 0012). Its steps are
 * idempotent, so a retry ranks a stored replay late instead of never; an
 * older event is dropped, so a poison event cannot retry for days.
 */
export const RETRY_FOR_MS = 60 * 60 * 1000;

/** How long a ban decision is trusted before it is read again. */
export const BAN_CACHE_MS = 60 * 1000;

/**
 * Whether the hourly function is deployed - on since the owner enabled
 * Cloud Scheduler and Pub/Sub (2026-10-25). Off takes it out of the next
 * deploy.
 */
export const HOURLY_ON = true;

/**
 * Whether `featureBest`, the gallery's daily pick (ADR 0011), is deployed -
 * on since the gallery pages and the Replays view of `/admin`, where the
 * owner takes a pick down, shipped (2026-10-26). Off takes it out of the
 * next deploy.
 */
export const FEATURE_BEST_ON = true;

/**
 * Whether `guestCleanup`, the daily deletion of guest accounts unused for
 * {@link GUEST_IDLE_DAYS} days (ADR 0012, owner's decision of 2026-10-26),
 * is deployed. Off takes it out of the next deploy. On only once "Mirror
 * friend lists" (`presence.backfill`) has run in production: before, a
 * deleted guest's entries in other players' lists have no `listedBy` to be
 * found by. Ships with the friends-only status rule.
 */
export const GUEST_CLEANUP_ON = true;

/** How many days a guest account may go unused before it is deleted. */
export const GUEST_IDLE_DAYS = 90;

/**
 * Where the functions' error reports go: the Sentry project
 * `bacteria-wars-functions` (owner's decision of 2026-10-26). A DSN is
 * public client config, not a secret; `error-reports.ts` uses it only in a
 * deployed function.
 */
export const SENTRY_DSN =
  'https://9d093973267967ca62b97a4c25aeb276@o1384048.ingest.us.sentry.io/4512322908651520';
