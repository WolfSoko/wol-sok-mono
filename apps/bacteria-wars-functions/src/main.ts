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
} from 'firebase-functions/v2/firestore';
import * as v1 from 'firebase-functions/v1';
import { REGION } from './config';
import { acceptSubmission } from './replays/accept';
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

/** A deleted account leaves its replays. */
export const deletePlayerReplays = v1
  .region(REGION)
  .auth.user()
  .onDelete(async (user) => {
    const counts = await deleteReplaysOf(db(), user.uid);
    logger.info('Replays of a deleted account', { uid: user.uid, ...counts });
  });
