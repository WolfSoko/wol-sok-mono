/**
 * Where and within which limits the game's functions run (ADR 0011).
 */

/**
 * The functions' region: the Firestore location of `bacteria-wars`, which
 * the owner confirms before the first deploy
 * (`gcloud firestore databases describe --project bacteria-wars`).
 */
export const REGION = 'europe-west3';

/** How many replays one player may submit in an hour. */
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

/** How long a private replay is kept: 30 days after the match. */
export const REPLAY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** How long a ban decision is trusted before it is read again. */
export const BAN_CACHE_MS = 60 * 1000;
