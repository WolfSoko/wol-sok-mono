import {
  type DocumentReference,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { deleteAll } from '../deletes';
import { anonymisePublic, takeDownPublic } from '../gallery/publish';
import {
  type ForgettableReplay,
  forgetChanges,
  stillRanking,
} from './forget-plan';

/** Replays taken out of a deleted account at once. */
const PARALLEL_REPLAYS = 10;

/** What became of one replay. */
export type ForgetOutcome =
  /** The player is out of it. */
  | 'forgotten'
  /** It is gone, or does not name the player. */
  | 'absent'
  /** The boards may still rank it: the player's `forget` waits. */
  | 'ranking'
  /** Another delivery of the same command took it out already. */
  | 'duplicate';

/**
 * Takes `uid` out of `replays/{replayId}` (`forget-plan.ts`) in one
 * transaction, its report under `reports/{uid}` too; the replay stays for
 * the statistics. For the player's own `forget` (`command`, its document):
 * waits while the boards may rank it, keeps it out of the gallery for good
 * (`galleryOut`), and claims the command in the same transaction, so a
 * second delivery of the event changes nothing.
 */
export async function forgetReplay(
  db: Firestore,
  replayId: string,
  uid: string,
  now: number,
  { command }: { command?: DocumentReference } = {}
): Promise<ForgetOutcome> {
  const ref = db.doc(`replays/${replayId}`);
  return db.runTransaction(async (tx) => {
    const [replay, claimed] = await Promise.all([
      tx.get(ref),
      command === undefined ? null : tx.get(command),
    ]);
    if (claimed?.get('claimed') === true) {
      return 'duplicate';
    }
    const data = replay.data();
    if (data === undefined) {
      return 'absent';
    }
    const createdAt: unknown = data['createdAt'];
    const forgettable: ForgettableReplay = {
      ...data,
      createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
    };
    const changes = forgetChanges(forgettable, uid, now);
    if (changes === null) {
      return 'absent';
    }
    if (command !== undefined && stillRanking(forgettable, now)) {
      return 'ranking';
    }
    const { expireAt, ...rest } = changes;
    tx.update(ref, {
      ...rest,
      ...(expireAt === undefined
        ? {}
        : { expireAt: Timestamp.fromMillis(expireAt) }),
      ...(command === undefined ? {} : { galleryOut: true }),
    });
    tx.delete(ref.collection('reports').doc(uid));
    if (command !== undefined) {
      tx.update(command, { claimed: true });
    }
    return 'forgotten';
  });
}

/**
 * The player's `forget` (ADR 0012, owner's decision of 2026-10-26): "Delete"
 * in "My matches" in the cloud. Takes the player out of the replay
 * (`forgetReplay`), so it leaves their `listMine`, and out of every public
 * copy of it: one still up is taken down, and each loses their uid and
 * shows their seat without a name (`anonymisePublic`). An online match the
 * other player saved keeps that player's seat. The public copies are gone
 * through also when the replay no longer names the player, so a command
 * sent again finishes what a failed one left. Null for a second delivery.
 */
export async function forgetForPlayer(
  db: Firestore,
  commandId: string,
  uid: string,
  replayId: string,
  now: number
): Promise<{ ok: boolean; reason?: string } | null> {
  const outcome = await forgetReplay(db, replayId, uid, now, {
    command: db.doc(`replayCommands/${commandId}`),
  });
  if (outcome === 'duplicate') {
    return null;
  }
  if (outcome === 'ranking') {
    return { ok: false, reason: 'ranking' };
  }
  const copies = (
    await db
      .collection('publicReplays')
      .where('uids', 'array-contains', uid)
      .get()
  ).docs.filter((doc) => doc.get('replayId') === replayId);
  for (const copy of copies) {
    if (copy.get('removedAt') === null) {
      await takeDownPublic(db, copy, now);
    }
  }
  if (copies.length > 0) {
    await anonymisePublic(db, uid, replayId);
  }
  return outcome === 'forgotten' || copies.length > 0
    ? { ok: true }
    : { ok: false, reason: 'not-found' };
}

/**
 * Takes a deleted account out of its replays (ADR 0011, changed by ADR
 * 0012 on 2026-10-26, owner's decision): every replay that names it -
 * in `players` or, for an online match only the other player reported, in
 * the seats - forgets it (`forgetReplay`) and stays, anonymised, for the
 * statistics until its `expireAt`; none is deleted. Its public replays stay
 * up without its uid and with the colour label for its name
 * (`anonymisePublic`). Its pending submissions and commands go first
 * (`withdrawPending`). Runs for banned accounts too: a deletion must erase
 * the player's data.
 */
export async function forgetPlayerReplays(
  db: Firestore,
  uid: string,
  now: number
): Promise<{ anonymised: number; public: number; pending: number }> {
  // Its submissions and commands not handled yet, before the replays are
  // looked for: `acceptReplay` stores none whose submission is gone.
  const pending = await withdrawPending(db, uid);
  // Its public replays at the same time: they hold no private replay.
  const anonymising = anonymisePublic(db, uid);
  const replays = db.collection('replays');
  // Each transaction reads its replay again: the queries need the ids only.
  const [played, seated] = await Promise.all([
    replays.where('players', 'array-contains', uid).select().get(),
    replays.where('seats', 'array-contains', uid).select().get(),
  ]);
  const ids = [
    ...new Set([...played.docs, ...seated.docs].map((doc) => doc.id)),
  ];
  const outcomes: ForgetOutcome[] = [];
  // A few at a time - each touches its own replay - so a player with
  // a thousand replays fits the trigger's minute.
  for (let i = 0; i < ids.length; i += PARALLEL_REPLAYS) {
    outcomes.push(
      ...(await Promise.all(
        ids
          .slice(i, i + PARALLEL_REPLAYS)
          .map((id) => forgetReplay(db, id, uid, now))
      ))
    );
  }
  return {
    anonymised: outcomes.filter((outcome) => outcome === 'forgotten').length,
    public: await anonymising,
    pending,
  };
}

/**
 * Deletes the player's `replaySubmissions` and `replayCommands` that no
 * trigger has handled yet. A submission whose `acceptReplay` runs later
 * finds itself gone and stores nothing (`withdrawn`); a command still runs
 * on its event's copy, finds the player in no replay, and has no document
 * to write its result on. The number of documents.
 */
async function withdrawPending(db: Firestore, uid: string): Promise<number> {
  const [submissions, commands] = await Promise.all(
    ['replaySubmissions', 'replayCommands'].map((name) =>
      deleteAll(db, db.collection(name).where('uid', '==', uid))
    )
  );
  return submissions + commands;
}
