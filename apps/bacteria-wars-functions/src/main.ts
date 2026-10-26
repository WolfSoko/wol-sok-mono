/**
 * The Cloud Functions of Bacteria Wars (ADR 0011, 0012), codebase
 * `bacteria` in `firebase.bacteria-game-remote.json`. Triggers are
 * idempotent - a transaction or a `create()` checks the state first - and
 * run with retries off, but `rankReplay` (a stored replay it fails to rank
 * would never count) and `rebuildTop`.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import {
  onDocumentCreated,
  onDocumentCreatedWithAuthContext,
  onDocumentDeleted,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as v1 from 'firebase-functions/v1';
import type { UserRecord } from 'firebase-admin/auth';
import {
  countAccount as countAccountOf,
  deleteAccount,
} from './admin/accounts';
import { isOwnerRecord, runAdminCommand } from './admin/command';
import { erasePlayer } from './admin/erase';
import { sweepGuests } from './admin/guests';
import { realtimeOf } from './admin/realtime';
import { remoteTogglesOf } from './admin/toggles';
import {
  checkGoogleLink,
  googleProviderOf,
  tombstoneId,
} from './admin/tombstones';
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
import {
  FEATURE_BEST_ON,
  GUEST_CLEANUP_ON,
  HOURLY_ON,
  REGION,
  RETRY_FOR_MS,
  RTDB_URL,
} from './config';
import { featureBest as pickBest } from './gallery/feature-best';
import { publicProfileChanged } from './gallery/publish';
import { handleSite } from './site/public-site';
import type { AccountInfo } from './boards/verify-slice';
import { tooOldToRetry } from './limits';
import { acceptSubmission, giveUpSubmission } from './replays/accept';
import { deleteReplayChildren } from './replays/cleanup';
import { runReplayCommand } from './replays/command';
import { forgetPlayerReplays } from './replays/forget';
import { deletePlayerSocial } from './social/delete-player';
import { type MirroredList, mirrorListing } from './social/mirror';

initializeApp();
setGlobalOptions({ region: REGION, maxInstances: 5 });

const db = () => getFirestore();

/**
 * The Realtime Database, for bans and presence - loaded on first use, like
 * the auth stack, which the other functions never need.
 */
const realtime = realtimeOf(async () => {
  const { getDatabaseWithUrl } = await import('firebase-admin/database');
  return getDatabaseWithUrl(RTDB_URL);
});

/**
 * The key of the ban tombstones (ADR 0012), in Secret Manager: only the
 * functions that name it in `secrets` can read it.
 */
const BAN_TOMBSTONE_KEY = defineSecret('BAN_TOMBSTONE_KEY');

/** The feature toggles in Remote Config, loaded on first use. */
const toggles = remoteTogglesOf(async () =>
  (await import('firebase-admin/remote-config')).getRemoteConfig()
);

/** True, and logged, for a retried event too old to act on. */
function givesUp(fn: string, id: string, time: string, now: number): boolean {
  const old = tooOldToRetry(Date.parse(time), now);
  if (old) {
    logger.error(
      `${fn} gave up on an event older than ${RETRY_FOR_MS / 60_000} minutes`,
      { id, time }
    );
  }
  return old;
}

/**
 * `replaySubmissions/{id}` into `replays/{id}` - see `acceptSubmission`.
 * Retried for an hour (`RETRY_FOR_MS`); then it gives up
 * (`giveUpSubmission`), which voids a ranked attempt rather than let a
 * failure of ours cost it. Each try runs at its own time: the limits count
 * by the hour they are in, and a ranked deadline by the submission's
 * `createdAt`.
 */
export const acceptReplay = onDocumentCreated(
  {
    document: 'replaySubmissions/{id}',
    memory: '256MiB',
    cpu: 'gcf_gen1',
    retry: true,
    secrets: [BAN_TOMBSTONE_KEY],
  },
  async (event) => {
    const data = event.data?.data();
    if (data === undefined) {
      return;
    }
    const id = event.params.id;
    const now = Date.now();
    if (givesUp('acceptReplay', id, event.time, now)) {
      await giveUpSubmission(db(), id, data, now);
      return;
    }
    if (typeof data['uid'] === 'string') {
      await checkLink(data['uid'], now);
    }
    await acceptSubmission(db(), id, data, now);
  }
);

/** A player's or the owner's command on a replay - see `runReplayCommand`. */
export const replayCommand = onDocumentCreatedWithAuthContext(
  // Up to the trigger's limit, on a whole vCPU and one command at a time:
  // `feature` may re-run up to six minutes of match first, which holds the
  // event loop.
  {
    document: 'replayCommands/{id}',
    memory: '512MiB',
    cpu: 1,
    concurrency: 1,
    timeoutSeconds: 540,
  },
  async (event) => {
    const data = event.data?.data();
    if (data !== undefined) {
      const result = await runReplayCommand(
        db(),
        event.params.id,
        data,
        event.authType === 'unauthenticated' ? undefined : event.authId,
        { isOwner }
      );
      if (result !== null && !result.ok) {
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

/**
 * A deleted account's replays forget it and stay, anonymised, for the
 * statistics until they expire (ADR 0012, owner's decision of 2026-10-26) -
 * see `forgetPlayerReplays`. The function keeps its old name, as a renamed
 * one would be deleted and deployed anew.
 */
export const deletePlayerReplays = v1
  .region(REGION)
  .auth.user()
  .onDelete(async (user) => {
    const counts = await forgetPlayerReplays(db(), user.uid, Date.now());
    logger.info('Replays of a deleted account', { uid: user.uid, ...counts });
  });

/**
 * A deleted account leaves its profile, progress, friends and the other
 * players' lists, the queue, its rooms and invites, and its presence (ADR
 * 0012, owner's decision of 2026-10-26) - see `deletePlayerSocial`.
 */
export const deletePlayerData = v1
  .region(REGION)
  .auth.user()
  .onDelete(async (user) => {
    const erased = await deletePlayerSocial(db(), realtime, user.uid);
    logger.info('Personal data of a deleted account', {
      uid: user.uid,
      ...erased,
    });
  });

/**
 * A deleted account leaves the boards, a banned Google account its
 * tombstone - see `deletePlayerBoards`.
 */
export const deletePlayerBoards = v1
  .region(REGION)
  .runWith({ secrets: [BAN_TOMBSTONE_KEY] })
  .auth.user()
  .onDelete(async (user) => {
    const deleted = await deleteAccount(
      db(),
      user.uid,
      { tombstone: tombstoneId(BAN_TOMBSTONE_KEY.value(), user), realtime },
      Date.now()
    );
    logger.info('Board data of a deleted account', { uid: user.uid, deleted });
  });

/**
 * A new account is counted, a Google sign-up checked - see `countAccount`.
 * An account already gone is left alone: its deletion may have run first,
 * and counting it would bring its board document back.
 */
export const countAccount = v1
  .region(REGION)
  .runWith({ secrets: [BAN_TOMBSTONE_KEY] })
  .auth.user()
  .onCreate(async (user) => {
    if ((await userRecord(user.uid)) === null) {
      return;
    }
    const created = user.metadata.creationTime;
    const banned = await countAccountOf(
      db(),
      realtime,
      user.uid,
      {
        createdAt: created ? Date.parse(created) : null,
        tombstone: tombstoneId(BAN_TOMBSTONE_KEY.value(), user),
      },
      Date.now()
    );
    if (banned) {
      logger.info('A new account met its ban tombstone', { uid: user.uid });
    }
  });

/**
 * The Auth user, read afresh - null for one that does not exist; other
 * failures throw.
 */
async function userRecord(uid: string): Promise<UserRecord | null> {
  // Loaded here only: the auth stack is heavy, and the other functions
  // never need it.
  const { getAuth } = await import('firebase-admin/auth');
  try {
    return await getAuth().getUser(uid);
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
}

/**
 * When an account was made and whether it signs in with Google - for the
 * online board's new-account cap and the order of verification.
 */
async function accountInfo(uid: string): Promise<AccountInfo> {
  const user = await userRecord(uid).catch(() => null);
  const created = user?.metadata.creationTime;
  return {
    createdAt: created ? Date.parse(created) : null,
    google: user !== null && googleProviderOf(user) !== undefined,
  };
}

const accountCreatedAt = async (uid: string) =>
  (await accountInfo(uid)).createdAt;

/**
 * Whether the uid is the owner now (`isOwnerRecord`), read afresh from
 * Auth: a revoked claim stops the next command.
 */
async function isOwner(uid: string): Promise<boolean> {
  const user = await userRecord(uid).catch(() => null);
  return user !== null && isOwnerRecord(user);
}

/**
 * The account's ban tombstone id (ADR 0012), read afresh from Auth - null
 * without a Google provider, or for an account that is gone. Any other
 * failure throws, so a ban never goes without its tombstone: the command
 * fails, and the owner sends it again.
 */
async function tombstoneOf(uid: string): Promise<string | null> {
  const user = await userRecord(uid);
  return user === null ? null : tombstoneId(BAN_TOMBSTONE_KEY.value(), user);
}

/** Every account's uid, a thousand a page - `stats.recount`. */
async function accountUids(): Promise<string[]> {
  const { getAuth } = await import('firebase-admin/auth');
  const uids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    uids.push(...page.users.map((user) => user.uid));
    pageToken = page.pageToken;
  } while (pageToken !== undefined);
  return uids;
}

/**
 * The one-time tombstone check after a guest links Google - see
 * `checkGoogleLink`. A failure is logged, not thrown: the check runs again
 * with the player's next write.
 */
async function checkLink(uid: string, now: number): Promise<void> {
  try {
    if (await checkGoogleLink(db(), realtime, uid, tombstoneOf, now)) {
      logger.info('A linked Google account met its ban tombstone', { uid });
    }
  } catch (error) {
    logger.error('Could not check a Google link', { uid, error });
  }
}

/** The owner's command (ADR 0012) - see `runAdminCommand`. */
export const adminCommand = onDocumentCreatedWithAuthContext(
  // Up to the trigger's limit: a ban walks every board entry of the
  // player and clears out what others meet them in.
  {
    document: 'adminCommands/{id}',
    memory: '256MiB',
    cpu: 'gcf_gen1',
    timeoutSeconds: 540,
    secrets: [BAN_TOMBSTONE_KEY],
  },
  async (event) => {
    const data = event.data?.data();
    if (data !== undefined) {
      const result = await runAdminCommand(
        db(),
        event.params.id,
        data,
        event.authType === 'unauthenticated' ? undefined : event.authId,
        { isOwner, realtime, tombstoneOf, accountUids, toggles }
      );
      logger.info('Admin command', { id: event.params.id, result });
    }
  }
);

/**
 * The XP board, from the player's stored progress (ADR 0012), after the
 * one-time tombstone check of a Google link.
 */
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
    await checkLink(event.params.uid, Date.now());
    await countProgress(db(), event.params.uid, after.data() ?? {}, createdAt);
  }
);

/**
 * The online board, once an online match turns `agreed`, and the daily and
 * endless boards, when a replay of a declared attempt comes (ADR 0012).
 * Retried for an hour (`RETRY_FOR_MS`). A delivery reads the replay as it
 * stands and leaves one that is gone or already answered (`rankedReason`,
 * which `rankOnline` writes with its marker, and the declared boards too);
 * each checks that again in its transaction. They decide at the event's
 * time: caps, the room's clock, a declaration's deadline and when a ban
 * ends. The ban documents are read at the delivery, so a ban placed after
 * the event still applies.
 */
export const rankReplay = onDocumentWritten(
  { document: 'replays/{id}', memory: '256MiB', cpu: 'gcf_gen1', retry: true },
  async (event) => {
    const id = event.params.id;
    const at = Date.parse(event.time);
    if (givesUp('rankReplay', id, event.time, Date.now())) {
      return;
    }
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const kind =
      after?.['kind'] === 'online' &&
      after['state'] === 'agreed' &&
      before?.['state'] !== 'agreed'
        ? 'online'
        : before === undefined &&
            (after?.['kind'] === 'daily' || after?.['kind'] === 'endless') &&
            after['attempt'] !== undefined
          ? (after['kind'] as 'daily' | 'endless')
          : null;
    if (kind === null) {
      return;
    }
    // The event's snapshot never shows what an earlier delivery wrote.
    const stored = await db().doc(`replays/${id}`).get();
    const replay = stored.data();
    if (replay === undefined || replay['rankedReason'] !== undefined) {
      logger.info('Replay gone or ranked already', { id, kind });
      return;
    }
    if (kind === 'online') {
      const reason = await rankOnline(db(), id, accountCreatedAt, at);
      logger.info('Online match ranked', { id, reason });
    } else if (kind === 'daily') {
      const reason = await rankDaily(db(), id, replay, at);
      logger.info('Daily attempt ranked', { id, reason });
    } else {
      const reason = await rankEndless(db(), id, replay, at);
      logger.info('Endless match ranked', { id, reason });
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
    // and the retry delivers it. Safe, as a rebuild reads the board afresh,
    // and kept up as long as it takes: a dropped event could leave a hidden
    // entry in the top document of a board nothing writes to any more.
    retry: true,
  },
  async (event) => {
    await rebuildTopOf(
      db(),
      event.params.boardId,
      event.params.entryId,
      event.data?.after.data(),
      event.data?.before.data()
    );
  }
);

/**
 * A player's entries and public replays follow their name, opt-ins and
 * preset - also when the profile is made or deleted (a deleted one shows
 * no name any more).
 */
export const boardProfileChanged = onDocumentWritten(
  { document: 'profiles/{uid}', memory: '256MiB', cpu: 'gcf_gen1' },
  async (event) => {
    const { uid } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    await Promise.all([
      relabelEntries(db(), uid, before, after),
      publicProfileChanged(db(), uid, before, after, Date.parse(event.time)),
    ]);
  }
);

/**
 * Every hour at minute 17 (UTC): cleans up ended bans, closes unreported
 * online matches and yesterday's daily board, checks daily entries for 25
 * minutes at most, then writes the statistics snapshot (ADR 0012). Off
 * with `HOURLY_ON`.
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
      },
      async () => {
        const result = await runHourly(db(), Date.now(), accountInfo, realtime);
        logger.info('Hourly run', result);
      }
    )
  : undefined;

/**
 * The gallery's daily pick for the UTC day before (ADR 0011): at 23:40
 * UTC, once the boards stopped verifying that day (`openDays` keeps it
 * open until 23:00), so the ranked attempts they verified are candidates.
 * Deployed only with `FEATURE_BEST_ON`.
 */
export const featureBest = FEATURE_BEST_ON
  ? onSchedule(
      {
        schedule: '40 23 * * *',
        timeZone: 'UTC',
        memory: '1GiB',
        timeoutSeconds: 1800,
        maxInstances: 1,
        retryCount: 0,
      },
      async () => {
        const result = await pickBest(db(), Date.now(), accountInfo);
        logger.info('Gallery pick', result);
      }
    )
  : undefined;

/**
 * The public replay pages (ADR 0011): `/replays`, `/replays/{id}`, their
 * JSON and the replays' sitemap, server-rendered and cached by Hosting.
 * Reads `publicReplays` only. Hosting's rewrites to it come in a release
 * after this function is deployed - a rewrite to a function that does not
 * exist fails the hosting deploy.
 */
export const publicSite = onRequest(
  { memory: '256MiB', maxInstances: 10 },
  async (req, res) => {
    try {
      const page = await handleSite(db(), req.method, req.path, req.query);
      // Express leaves the body out for HEAD itself, with GET's headers.
      res.status(page.status).set(page.headers).send(page.body);
    } catch (error) {
      logger.error('publicSite failed', { path: req.path, error });
      res.status(500).set('Cache-Control', 'no-store').send('');
    }
  }
);

/**
 * Mirrors a player's friend list, and the friend requests, into the
 * Realtime Database (`statusReaders`, `listedBy` - see `mirrorListing`).
 */
function mirrorOf(list: MirroredList) {
  return onDocumentWritten(
    {
      document: `players/{owner}/${list}/{other}`,
      memory: '256MiB',
      cpu: 'gcf_gen1',
    },
    async (event) => {
      await mirrorListing(
        db(),
        realtime,
        list,
        event.params.owner,
        event.params.other
      );
    }
  );
}

/** `players/{owner}/friends/{friend}` into `statusReaders` and `listedBy`. */
export const mirrorFriend = mirrorOf('friends');

/** `players/{owner}/requests/{from}` into `listedBy`. */
export const mirrorRequest = mirrorOf('requests');

/**
 * Every day at 03:41 UTC: deletes guest accounts unused for 90 days (ADR
 * 0012, owner's decision of 2026-10-26), their data first - see
 * `sweepGuests`. Off with `GUEST_CLEANUP_ON`.
 */
export const guestCleanup = GUEST_CLEANUP_ON
  ? onSchedule(
      {
        schedule: '41 3 * * *',
        timeZone: 'UTC',
        memory: '512MiB',
        timeoutSeconds: 1800,
        maxInstances: 1,
        retryCount: 0,
      },
      async () => {
        const { getAuth } = await import('firebase-admin/auth');
        const auth = getAuth();
        const now = Date.now();
        const result = await sweepGuests(
          {
            listUsers: (pageToken) => auth.listUsers(1000, pageToken),
            deleteUsers: (uids) => auth.deleteUsers([...uids]),
            // A guest has no Google provider, so no ban tombstone.
            erase: (uid) => erasePlayer(db(), realtime, uid, null, now),
            pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          },
          now
        );
        logger.info('Idle guests deleted', result);
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
