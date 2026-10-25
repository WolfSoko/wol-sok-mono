/**
 * The Cloud Functions of Bacteria Wars (ADR 0011, 0012), codebase
 * `bacteria` in `firebase.bacteria-game-remote.json`. Triggers run with
 * retries off and are idempotent: a transaction or a `create()` checks the
 * state first.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { setGlobalOptions } from 'firebase-functions/v2';
import {
  onDocumentCreated,
  onDocumentCreatedWithAuthContext,
  onDocumentDeleted,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as v1 from 'firebase-functions/v1';
import {
  checkGoogleLink,
  countAccount as countNewAccount,
  deletePlayerBoards as deleteBoardsOf,
} from './admin/accounts';
import { runAdminCommand } from './admin/command';
import type { AdminDeps } from './admin/deps';
import { runHourly } from './boards/hourly';
import { boardProfileChanged as relabelEntries } from './boards/profile-changed';
import { rankDaily } from './boards/rank-daily';
import { rankEndless, trackDeclaredMatch } from './boards/rank-endless';
import { rankOnline } from './boards/rank-online';
import {
  PROGRESS_KEY,
  rankProgress as countProgress,
} from './boards/rank-progress';
import { rebuildTop as rebuildTopOf } from './boards/rebuild-top';
import { HOURLY_ON, REGION } from './config';
import type { AccountInfo } from './boards/verify-slice';
import { acceptSubmission } from './replays/accept';
import { deleteReplayChildren } from './replays/cleanup';
import { runReplayCommand } from './replays/command';
import { deletePlayerReplays as deleteReplaysOf } from './replays/delete-player';

initializeApp();
setGlobalOptions({ region: REGION, maxInstances: 5 });

const db = () => getFirestore();

/** The HMAC key of ban tombstones (ADR 0012), in Secret Manager. */
const BAN_TOMBSTONE_KEY = defineSecret('BAN_TOMBSTONE_KEY');

/** The `google.com` provider uid of an Auth user, null without Google. */
const googleUidOf = (user: {
  providerData: readonly { providerId: string; uid: string }[];
}) => user.providerData.find((p) => p.providerId === 'google.com')?.uid ?? null;

/**
 * Auth, the Realtime Database and the tombstone key for the admin and ban
 * functions - loaded when first used: the other functions never need them.
 */
const adminDeps: AdminDeps = {
  async account(uid) {
    const { getAuth } = await import('firebase-admin/auth');
    try {
      const user = await getAuth().getUser(uid);
      const googleUid = googleUidOf(user);
      return {
        googleUid,
        admin:
          user.customClaims?.['admin'] === true &&
          user.emailVerified &&
          googleUid !== null,
      };
    } catch {
      return null;
    }
  },
  async listUids(pageToken) {
    const { getAuth } = await import('firebase-admin/auth');
    const page = await getAuth().listUsers(1000, pageToken);
    return { uids: page.users.map((user) => user.uid), next: page.pageToken };
  },
  rtdb: {
    async set(path, value) {
      const { getDatabase } = await import('firebase-admin/database');
      await getDatabase().ref(path).set(value);
    },
    async remove(path) {
      const { getDatabase } = await import('firebase-admin/database');
      await getDatabase().ref(path).remove();
    },
    async get(path) {
      const { getDatabase } = await import('firebase-admin/database');
      return (await getDatabase().ref(path).get()).val();
    },
  },
  tombstoneKey: () => BAN_TOMBSTONE_KEY.value(),
};

/** `replaySubmissions/{id}` into `replays/{id}` - see `acceptSubmission`. */
export const acceptReplay = onDocumentCreated(
  { document: 'replaySubmissions/{id}', memory: '256MiB', cpu: 'gcf_gen1' },
  async (event) => {
    const data = event.data?.data();
    if (data !== undefined) {
      await acceptSubmission(db(), event.params.id, data);
    }
  }
);

/** A player's (and later the owner's) command on a replay. */
export const replayCommand = onDocumentCreatedWithAuthContext(
  { document: 'replayCommands/{id}', memory: '256MiB', cpu: 'gcf_gen1' },
  async (event) => {
    const data = event.data?.data();
    if (data !== undefined) {
      const result = await runReplayCommand(
        db(),
        event.params.id,
        data,
        event.authType === 'unauthenticated' ? undefined : event.authId
      );
      if (!result.ok) {
        logger.info('Replay command refused', { id: event.params.id, result });
      }
    }
  }
);

/** An expired or deleted replay takes its blob and reports along. */
export const cleanReplay = onDocumentDeleted(
  { document: 'replays/{id}', memory: '256MiB', cpu: 'gcf_gen1' },
  (event) => deleteReplayChildren(db(), event.params.id)
);

/** A deleted account leaves its replays. */
export const deletePlayerReplays = v1
  .region(REGION)
  .auth.user()
  .onDelete(async (user) => {
    const counts = await deleteReplaysOf(db(), user.uid);
    logger.info('Replays of a deleted account', { uid: user.uid, ...counts });
  });

/**
 * When an account was made and whether it signs in with Google - for the
 * online board's new-account cap and the order of verification.
 */
async function accountInfo(uid: string): Promise<AccountInfo> {
  // Loaded here only: the auth stack is heavy, and the other functions
  // never need it.
  const { getAuth } = await import('firebase-admin/auth');
  try {
    const user = await getAuth().getUser(uid);
    const created = user.metadata.creationTime;
    return {
      createdAt: created ? Date.parse(created) : null,
      google: user.providerData.some((p) => p.providerId === 'google.com'),
    };
  } catch {
    return { createdAt: null, google: false };
  }
}

const accountCreatedAt = async (uid: string) =>
  (await accountInfo(uid)).createdAt;

/** The XP board, from the player's stored progress (ADR 0012). */
export const rankProgress = onDocumentWritten(
  {
    document: 'players/{uid}/storage/{key}',
    memory: '256MiB',
    cpu: 'gcf_gen1',
    secrets: [BAN_TOMBSTONE_KEY],
  },
  async (event) => {
    // Settings and other keys share the collection; only progress counts.
    const after = event.data?.after;
    if (event.params.key !== PROGRESS_KEY || after?.exists !== true) {
      return;
    }
    const createdAt = after.createTime?.toMillis() ?? Date.now();
    const outcome = await countProgress(
      db(),
      event.params.uid,
      after.data() ?? {},
      createdAt
    );
    // A guest who linked Google is checked against the ban tombstones.
    if (typeof outcome === 'object') {
      await checkGoogleLink(
        db(),
        adminDeps,
        event.params.uid,
        Date.now(),
        outcome.member
      );
    }
  }
);

/**
 * The online board, once an online match turns `agreed`, and the daily and
 * endless boards, when a replay of a declared attempt comes (ADR 0012).
 */
export const rankReplay = onDocumentWritten(
  { document: 'replays/{id}', memory: '256MiB', cpu: 'gcf_gen1' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (after === undefined) {
      return;
    }
    if (
      after['kind'] === 'online' &&
      after['state'] === 'agreed' &&
      before?.['state'] !== 'agreed'
    ) {
      const reason = await rankOnline(
        db(),
        event.params.id,
        after,
        accountCreatedAt
      );
      logger.info('Online match ranked', { id: event.params.id, reason });
    } else if (
      before === undefined &&
      after['kind'] === 'daily' &&
      after['attempt'] !== undefined
    ) {
      const reason = await rankDaily(db(), event.params.id, after);
      logger.info('Daily attempt ranked', { id: event.params.id, reason });
    } else if (
      before === undefined &&
      after['kind'] === 'endless' &&
      after['attempt'] !== undefined
    ) {
      const reason = await rankEndless(db(), event.params.id, after);
      logger.info('Endless match ranked', { id: event.params.id, reason });
    }
  }
);

/** A board's top document, one rebuild at a time. */
export const rebuildTop = onDocumentWritten(
  {
    document: 'boards/{boardId}/entries/{entryId}',
    memory: '256MiB',
    cpu: 'gcf_gen1',
    maxInstances: 1,
    concurrency: 1,
    // One instance takes one event: one that finds it busy is turned away,
    // and the retry delivers it. Safe, as a rebuild reads the board afresh.
    retry: true,
  },
  async (event) => {
    await rebuildTopOf(
      db(),
      event.params.boardId,
      event.params.entryId,
      event.data?.after.data()
    );
  }
);

/**
 * A player's entries follow their name, opt-ins and preset - also when the
 * profile is made or deleted (a deleted one shows no name any more).
 */
export const boardProfileChanged = onDocumentWritten(
  { document: 'profiles/{uid}', memory: '256MiB', cpu: 'gcf_gen1' },
  async (event) => {
    await relabelEntries(
      db(),
      event.params.uid,
      event.data?.before.data(),
      event.data?.after.data()
    );
  }
);

/**
 * Every hour at minute 17 (UTC): closes unreported online matches and
 * yesterday's daily board, then checks daily entries for 25 minutes at
 * most (ADR 0012). Off until the owner has set up Cloud Scheduler.
 */
export const hourly = HOURLY_ON
  ? onSchedule(
      {
        schedule: '17 * * * *',
        timeZone: 'UTC',
        memory: '1GiB',
        timeoutSeconds: 1800,
        maxInstances: 1,
        retryCount: 0,
        secrets: [BAN_TOMBSTONE_KEY],
      },
      async () => {
        const result = await runHourly(
          db(),
          Date.now(),
          accountInfo,
          adminDeps
        );
        logger.info('Hourly run', result);
      }
    )
  : undefined;

/** A declared endless match joins its run at once (ADR 0012). */
export const declaredMatch = onDocumentCreated(
  {
    document: 'players/{uid}/attempts/{attemptId}',
    memory: '256MiB',
    cpu: 'gcf_gen1',
  },
  async (event) => {
    await trackDeclaredMatch(
      db(),
      event.params.uid,
      event.params.attemptId,
      Date.now()
    );
  }
);

/** The owner's commands (ADR 0012): checked, run, audited. */
export const adminCommand = onDocumentCreatedWithAuthContext(
  {
    document: 'adminCommands/{id}',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: [BAN_TOMBSTONE_KEY],
  },
  async (event) => {
    const data = event.data?.data();
    if (data !== undefined) {
      const result = await runAdminCommand(
        db(),
        adminDeps,
        event.params.id,
        data,
        event.authType === 'unauthenticated' ? undefined : event.authId
      );
      logger.info('Admin command', { id: event.params.id, result });
    }
  }
);

/** A new account is counted, and a banned Google identity banned again. */
export const countAccount = v1
  .runWith({ secrets: ['BAN_TOMBSTONE_KEY'] })
  .region(REGION)
  .auth.user()
  .onCreate(async (user) => {
    const created = Date.parse(user.metadata.creationTime);
    const result = await countNewAccount(
      db(),
      adminDeps,
      user.uid,
      googleUidOf(user),
      Number.isNaN(created) ? Date.now() : created,
      Date.now()
    );
    if (result.rebanned) {
      logger.info('A banned identity came back', { uid: user.uid });
    }
  });

/** A deleted account leaves the boards, its ban kept in a tombstone. */
export const deletePlayerBoards = v1
  .runWith({ secrets: ['BAN_TOMBSTONE_KEY'] })
  .region(REGION)
  .auth.user()
  .onDelete(async (user) => {
    const counts = await deleteBoardsOf(
      db(),
      adminDeps,
      user.uid,
      googleUidOf(user),
      Date.now()
    );
    logger.info('Boards of a deleted account', { uid: user.uid, ...counts });
  });
