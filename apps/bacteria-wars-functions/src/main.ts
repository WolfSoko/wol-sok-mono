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
  onDocumentUpdated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import * as v1 from 'firebase-functions/v1';
import { boardProfileChanged as relabelEntries } from './boards/profile-changed';
import { rankOnline } from './boards/rank-online';
import {
  PROGRESS_KEY,
  rankProgress as countProgress,
} from './boards/rank-progress';
import { rebuildTop as rebuildTopOf } from './boards/rebuild-top';
import { REGION } from './config';
import { acceptSubmission } from './replays/accept';
import { deleteReplayChildren } from './replays/cleanup';
import { runReplayCommand } from './replays/command';
import { deletePlayerReplays as deleteReplaysOf } from './replays/delete-player';

initializeApp();
setGlobalOptions({ region: REGION, maxInstances: 5 });

const db = () => getFirestore();

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

/** When an account was made - for the online board's new-account cap. */
async function accountCreatedAt(uid: string): Promise<number | null> {
  // Loaded here only: the auth stack is heavy, and the other functions
  // never need it.
  const { getAuth } = await import('firebase-admin/auth');
  try {
    const created = (await getAuth().getUser(uid)).metadata.creationTime;
    return created ? Date.parse(created) : null;
  } catch {
    return null;
  }
}

/** The XP board, from the player's stored progress (ADR 0012). */
export const rankProgress = onDocumentWritten(
  {
    document: 'players/{uid}/storage/{key}',
    memory: '256MiB',
    cpu: 'gcf_gen1',
  },
  async (event) => {
    // Settings and other keys share the collection; only progress counts.
    const after = event.data?.after;
    if (event.params.key !== PROGRESS_KEY || after?.exists !== true) {
      return;
    }
    const createdAt = after.createTime?.toMillis() ?? Date.now();
    await countProgress(db(), event.params.uid, after.data() ?? {}, createdAt);
  }
);

/** The online board, once an online match turns `agreed` (ADR 0012). */
export const rankReplay = onDocumentWritten(
  { document: 'replays/{id}', memory: '256MiB', cpu: 'gcf_gen1' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (
      after === undefined ||
      after['kind'] !== 'online' ||
      after['state'] !== 'agreed' ||
      before?.['state'] === 'agreed'
    ) {
      return;
    }
    const reason = await rankOnline(
      db(),
      event.params.id,
      after,
      accountCreatedAt
    );
    logger.info('Online match ranked', { id: event.params.id, reason });
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

/** A player's entries follow their name, opt-ins and preset. */
export const boardProfileChanged = onDocumentUpdated(
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
