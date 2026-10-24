/**
 * Settings of the game's Cloud Functions (ADR 0011, ADR 0012).
 */

/**
 * The one region all functions run in: the one Firebase pairs with the
 * location of the `bacteria-wars` Firestore database, `nam5` (US
 * multi-region), which cannot be moved. Every trigger is a Firestore, Auth
 * or schedule trigger; none reads the Realtime Database in europe-west1.
 * Hosting rewrites name this region too.
 */
export const REGION = 'us-central1';

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
