/**
 * Settings of the game's Cloud Functions (ADR 0011, ADR 0012).
 */

/**
 * The one region all functions run in: where the `bacteria-wars` Firestore
 * database and the Realtime Database both live, europe-west1 (Belgium).
 * Firestore triggers must run in their database's region, which cannot be
 * moved once created (the owner moved `(default)` from `nam5` on 24
 * October 2026 by recreating it). Hosting rewrites name this region too.
 */
export const REGION = 'europe-west1';

/** No function scales past this many instances. */
export const MAX_INSTANCES = 5;

/**
 * True once the owner can unfeature: `featureBest` publishes nothing until
 * then and returns at once (ADR 0012: its schedule is enabled only once the
 * Replays view of `/admin` ships). The Cloud Scheduler job exists from the
 * first deploy, so turning this on is a code change and a deploy.
 */
export const FEATURE_BEST_ENABLED = false;

/**
 * True once the client release that writes attempts ships (ADR 0012,
 * rollout step 6): until then `hourly` returns at once. A deploy cannot
 * create a paused Cloud Scheduler job, so the job exists and fires from
 * the first deploy; turning this on is a code change and a deploy, like
 * {@link FEATURE_BEST_ENABLED}.
 */
export const HOURLY_ENABLED = false;

/** Days a private replay is kept after its match (TTL on `expireAt`). */
export const REPLAY_DAYS = 30;
/** Years an admin audit entry is kept. */
export const AUDIT_YEARS = 2;
