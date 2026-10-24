/**
 * The Cloud Functions of Bacteria Wars (ADR 0011, ADR 0012), codebase
 * `bacteria` in `firebase.bacteria-game-remote.json`. Every trigger is
 * idempotent - a transaction checks the state first, and documents are
 * written with `create()` - and runs with retries off, but `rankReplay`,
 * which retries for an hour: a stored replay it fails to rank would
 * otherwise never count.
 *
 * Each function is a thin wrapper around a core that takes the Firestore it
 * acts on, which the specs run against the emulator.
 */
import { logger, setGlobalOptions } from 'firebase-functions';
import * as functionsV1 from 'firebase-functions/v1';
import {
  onDocumentCreated,
  onDocumentCreatedWithAuthContext,
  onDocumentUpdated,
  onDocumentWritten,
} from 'firebase-functions/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/scheduler';
import { accountOf, authAccounts } from './accounts';
import { runAdminCommand } from './admin/admin-command';
import {
  countAccount as countAccountOf,
  deletePlayerBoards as deleteBoardsOf,
} from './admin/account-events';
import { checkGoogleLink, Moderation } from './admin/bans';
import { tombstoneKey, TombstoneKey } from './admin/tombstones';
import { auth, db, rtdb } from './app';
import {
  boardProfileChanged as relabel,
  touchesBoards,
} from './boards/board-profile-changed';
import { runHourly } from './boards/hourly';
import { rankProgress as rankProgressOf } from './boards/rank-progress';
import {
  rankReplay as rankReplayOf,
  tooOldToRetry,
  touchesRanking,
} from './boards/rank-replay';
import { rebuildTop as rebuildTopOf } from './boards/rebuild-top';
import type { EntryDoc } from './boards/model';
import {
  FEATURE_BEST_ENABLED,
  HOURLY_ENABLED,
  MAX_INSTANCES,
  REGION,
} from './config';
import { loadEngine } from './engine';
import { rtdbPresence } from './presence';
import { acceptSubmission } from './replays/accept-replay';
import { deletePlayerReplays as deleteReplaysOf } from './replays/delete-player-replays';
import { featureBest as featureBestOf } from './replays/feature-best';
import type { ReplayDoc } from './replays/model';
import { onProfileChanged } from './replays/profile-changed';
import { runReplayCommand } from './replays/replay-command';

setGlobalOptions({ region: REGION, maxInstances: MAX_INSTANCES });

/**
 * The key of the ban tombstones (ADR 0012): 32 random bytes in Secret
 * Manager, read at run time - never a literal in the code.
 */
const BAN_TOMBSTONE_KEY = defineSecret('BAN_TOMBSTONE_KEY');

/**
 * The light triggers run on a fraction of a vCPU (ADR 0012's budget table)
 * at 256 MiB.
 */
const LIGHT = { memory: '256MiB', cpu: 'gcf_gen1', retry: false } as const;

/** The tombstone key - null only in the emulator without a local secret. */
function tombstones(): TombstoneKey | null {
  try {
    return tombstoneKey(BAN_TOMBSTONE_KEY.value());
  } catch (error) {
    if (process.env['FUNCTIONS_EMULATOR'] === 'true') {
      logger.warn('No BAN_TOMBSTONE_KEY in the emulator: no tombstones');
      return null;
    }
    throw error;
  }
}

/**
 * What moderation, the boards and the hourly run work on - the engine
 * loaded only by what needs it.
 */
function moderation(): Moderation {
  return {
    db: db(),
    engine: loadEngine,
    presence: rtdbPresence(rtdb),
    accounts: authAccounts(auth()),
    tombstones: tombstones(),
  };
}

/**
 * Runs the cores of one trigger side by side, each whatever the others do,
 * and logs every failure; the first is rethrown, so the function fails.
 */
async function allOf(
  name: string,
  cores: Record<string, () => Promise<unknown>>
): Promise<void> {
  const entries = Object.entries(cores);
  const results = await Promise.allSettled(entries.map(([, run]) => run()));
  const failed = results.flatMap((result, index): [string, unknown][] =>
    result.status === 'rejected' ? [[entries[index][0], result.reason]] : []
  );
  for (const [core, error] of failed) {
    logger.error(`${name}: ${core} failed`, error);
  }
  if (failed.length > 0) {
    throw failed[0][1];
  }
}

/** Stores a submitted replay - see `acceptSubmission`. */
export const acceptReplay = onDocumentCreated(
  {
    ...LIGHT,
    document: 'replaySubmissions/{id}',
    secrets: [BAN_TOMBSTONE_KEY],
  },
  async (event) => {
    const deps = moderation();
    await acceptSubmission(
      deps.db,
      event.params.id,
      event.data?.data(),
      Date.now(),
      (uid) => checkGoogleLink(deps, uid, Date.now())
    );
  }
);

/**
 * A player's `remove`, or the owner's `feature`, `unfeature` and
 * `anonymise`. Featuring may re-run a replay of up to 6 minutes, inside the
 * 540 s an event trigger may take; so one vCPU, not a fraction.
 */
export const replayCommand = onDocumentCreatedWithAuthContext(
  {
    document: 'replayCommands/{id}',
    memory: '512MiB',
    cpu: 1,
    timeoutSeconds: 540,
    retry: false,
  },
  async (event) => {
    await runReplayCommand(
      db(),
      authAccounts(auth()),
      event.params.id,
      event.data?.data(),
      event.authId
    );
  }
);

/**
 * A profile change: the player's name in their public replays
 * (`onProfileChanged`) and on every board (`boardProfileChanged`). Both run
 * whatever the other does; a failure of either fails the function.
 */
export const profileChanged = onDocumentUpdated(
  { ...LIGHT, document: 'profiles/{uid}' },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    await allOf('profileChanged', {
      gallery: () => onProfileChanged(db(), uid, before, after),
      boards: async () =>
        touchesBoards(before, after)
          ? relabel(db(), await loadEngine(), uid, before, after)
          : 0,
    });
  }
);

/**
 * Erases a deleted account from the replays (`deletePlayerReplays`) and the
 * boards (`deletePlayerBoards`), both whatever the other does. Auth
 * onDelete exists in v1 only.
 */
export const deletePlayer = functionsV1
  .region(REGION)
  .runWith({
    memory: '256MB',
    timeoutSeconds: 540,
    secrets: [BAN_TOMBSTONE_KEY],
  })
  .auth.user()
  .onDelete(async (user) => {
    await allOf('deletePlayer', {
      replays: () => deleteReplaysOf(db(), user.uid),
      boards: () => deleteBoardsOf(moderation(), accountOf(user)),
    });
  });

/**
 * Daily at 04:00 in Berlin: re-runs the previous day's best candidates and
 * publishes the gallery's matches of the day. Does nothing until
 * {@link FEATURE_BEST_ENABLED} - the owner must be able to unfeature first.
 */
export const featureBest = onSchedule(
  {
    schedule: '0 4 * * *',
    timeZone: 'Europe/Berlin',
    memory: '512MiB',
    cpu: 1,
    timeoutSeconds: 1800,
    retryCount: 0,
    maxInstances: 1,
  },
  async () => {
    if (!FEATURE_BEST_ENABLED) {
      logger.info('featureBest is paused (FEATURE_BEST_ENABLED is false)');
      return;
    }
    const result = await featureBestOf(db(), authAccounts(auth()));
    logger.info('featureBest done', result);
  }
);

/**
 * The boards' view of a stored replay: counts agreed online matches, takes
 * replays of declared attempts into their day or run, and follows re-runs
 * - see `rankReplay`. Retried, for an hour at most (`RETRY_FOR_MS`).
 */
export const rankReplay = onDocumentWritten(
  { ...LIGHT, retry: true, document: 'replays/{id}' },
  async (event) => {
    if (tooOldToRetry(event.time, Date.now())) {
      logger.error('rankReplay: gave up on an event older than an hour', {
        id: event.params.id,
        time: event.time,
      });
      return;
    }
    const before = event.data?.before.data() as ReplayDoc | undefined;
    const after = event.data?.after.data() as ReplayDoc | undefined;
    if (!touchesRanking(before, after)) {
      return;
    }
    await rankReplayOf(
      db(),
      await loadEngine(),
      authAccounts(auth()),
      event.params.id,
      before,
      after
    );
  }
);

/**
 * The rank board from the player's stored progress. On the literal path,
 * so writes of other keys - the settings - do not invoke it.
 */
export const rankProgress = onDocumentWritten(
  {
    ...LIGHT,
    document: 'players/{uid}/storage/bacteria-game.progress',
    secrets: [BAN_TOMBSTONE_KEY],
  },
  async (event) => {
    const after = event.data?.after;
    await rankProgressOf(
      moderation(),
      event.params.uid,
      after?.exists ? after.data() : undefined,
      after?.createTime?.toMillis()
    );
  }
);

/** Rebuilds a board's top document, one at a time - see `rebuildTop`. */
export const rebuildTop = onDocumentWritten(
  {
    ...LIGHT,
    document: 'boards/{boardId}/entries/{entryId}',
    maxInstances: 1,
    concurrency: 1,
  },
  async (event) => {
    const after = event.data?.after;
    await rebuildTopOf(
      db(),
      await loadEngine(),
      event.params.boardId,
      event.params.entryId,
      after?.exists ? (after.data() as EntryDoc) : undefined
    );
  }
);

/**
 * The owner's admin actions. `board.verify` may re-run up to 6 match
 * minutes inside the 540 s an event trigger may take: one vCPU.
 */
export const adminCommand = onDocumentCreatedWithAuthContext(
  {
    document: 'adminCommands/{id}',
    memory: '512MiB',
    cpu: 1,
    timeoutSeconds: 540,
    retry: false,
    secrets: [BAN_TOMBSTONE_KEY],
  },
  async (event) => {
    await runAdminCommand(
      { ...moderation(), users: auth() },
      event.params.id,
      event.data?.data(),
      event.authId
    );
  }
);

/** Counts a new account and checks a Google sign-up's tombstone (v1 only). */
export const countAccount = functionsV1
  .region(REGION)
  .runWith({ memory: '256MB', secrets: [BAN_TOMBSTONE_KEY] })
  .auth.user()
  .onCreate(async (user) => {
    await countAccountOf(moderation(), accountOf(user));
  });

/**
 * At minute 17 of every hour (UTC): ended bans, closed attempts, "Not
 * reported", final daily boards, the statistics snapshot, then the hour's
 * verification slice. Does nothing until {@link HOURLY_ENABLED}: the
 * client that writes attempts ships first (ADR 0012, rollout step 6).
 */
export const hourly = onSchedule(
  {
    schedule: '17 * * * *',
    timeZone: 'UTC',
    memory: '1GiB',
    cpu: 1,
    timeoutSeconds: 1800,
    retryCount: 0,
    maxInstances: 1,
    secrets: [BAN_TOMBSTONE_KEY],
  },
  async () => {
    if (!HOURLY_ENABLED) {
      logger.info('hourly is paused (HOURLY_ENABLED is false)');
      return;
    }
    const result = await runHourly(moderation());
    logger.info('hourly done', result);
  }
);
