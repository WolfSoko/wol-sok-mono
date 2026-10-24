import type { DocumentSnapshot } from 'firebase/firestore';
import { filter, firstValueFrom, Observable } from 'rxjs';
import { replayToBytes, MAX_PACKED_BYTES } from '../state/replay-pack';
import type { EndReason } from '../state/win-conditions';
import type { FirebaseConnection } from './firebase-connection';
import type { GameReplays } from './game-replays';
import {
  hintOf,
  MAX_REPLAY_LIST,
  onlineIdOf,
  parseCommandResult,
  ReplayCommandResult,
  ReplayCommandType,
  ReplayKind,
  ReplayListing,
  ReplayState,
  ReplaySubmission,
} from './replay-records';
import { beforeRetry, errorCode } from './retry';

/**
 * How long a command document lasts: the rules want `expireAt` a day after
 * the write, and TTL removes what a failed function left behind.
 */
export const COMMAND_TTL_MS = 24 * 60 * 60 * 1000;
/** How often {@link FirestoreGameReplays.watchSaved} asks again before it gives up. */
const SAVED_TRIES = 8;

const KINDS: readonly ReplayKind[] = ['online', 'computer', 'daily', 'endless'];
const STATES: readonly ReplayState[] = [
  'submitted',
  'waiting',
  'agreed',
  'disputed',
  'verified',
  'unverified',
  'balance-mismatch',
];

/**
 * The replays in Firestore (ADR 0011). The client never writes `replays`:
 * it writes a command document - `replaySubmissions/{auto}` = `{ uid,
 * bytes, hint, createdAt, expireAt, attempt? }` - which the functions turn
 * into `replays/{id}` and delete, and reads its own `replays` back.
 */
export class FirestoreGameReplays implements GameReplays {
  public constructor(
    private readonly connection: FirebaseConnection,
    /** Whoever plays, null while nobody does. */
    private readonly playerIds: Observable<string | null>
  ) {}

  public async submit({
    replay,
    hint,
    attempt,
  }: ReplaySubmission): Promise<string | null> {
    const { db, dbSdk } = this.connection;
    const bytes = await replayToBytes(replay);
    if (bytes.length > MAX_PACKED_BYTES) {
      return null;
    }
    const uid = await this.signedIn();
    const ref = dbSdk.doc(dbSdk.collection(db, 'replaySubmissions'));
    // Not awaited: offline, the write waits for the network, and the
    // match is long over by then. `watchSaved` tells once it landed.
    dbSdk
      .setDoc(ref, {
        uid,
        bytes: dbSdk.Bytes.fromUint8Array(bytes),
        hint: hintOf(hint),
        createdAt: dbSdk.serverTimestamp(),
        expireAt: dbSdk.Timestamp.fromMillis(Date.now() + COMMAND_TTL_MS),
        ...(attempt === undefined ? {} : { attempt }),
      })
      .catch((error: unknown) =>
        console.warn('The replay could not be submitted', error)
      );
    // The server's id: online the match's own, else `l_` and the
    // submission's.
    return onlineIdOf(replay) ?? `l_${ref.id}`;
  }

  public watchSaved(id: string): Observable<boolean> {
    const { db, dbSdk } = this.connection;
    const ref = dbSdk.doc(db, 'replays', id);
    // Until the replay exists the rules refuse to read it - they read its
    // players - so a refusal means "not yet" and is asked again later.
    return new Observable<boolean>((subscriber) => {
      let stop: (() => void) | null = null;
      let closed = false;
      const listen = (attempt: number) => {
        stop = dbSdk.onSnapshot(
          ref,
          (snapshot) => subscriber.next(snapshot.exists()),
          (error) => {
            subscriber.next(false);
            if (
              attempt >= SAVED_TRIES ||
              errorCode(error) !== 'permission-denied'
            ) {
              subscriber.complete();
              return;
            }
            void beforeRetry(attempt).then(() => {
              if (!closed) {
                listen(attempt + 1);
              }
            });
          }
        );
      };
      listen(0);
      return () => {
        closed = true;
        stop?.();
      };
    });
  }

  public async listMine(limit = MAX_REPLAY_LIST): Promise<ReplayListing[]> {
    const { db, dbSdk } = this.connection;
    try {
      const uid = await this.signedIn();
      const snapshot = await dbSdk.getDocs(
        dbSdk.query(
          dbSdk.collection(db, 'replays'),
          dbSdk.where('players', 'array-contains', uid),
          dbSdk.orderBy('createdAt', 'desc'),
          dbSdk.limit(Math.max(1, Math.min(MAX_REPLAY_LIST, limit)))
        )
      );
      return snapshot.docs
        .map((doc) => listingOf(doc))
        .filter((listing) => listing !== null);
    } catch (error) {
      console.warn('Could not list the replays', error);
      return [];
    }
  }

  public async replayBytes(
    id: string
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    const { db, dbSdk } = this.connection;
    try {
      const snapshot = await dbSdk.getDoc(
        dbSdk.doc(db, 'replays', id, 'blob', 'data')
      );
      const bytes: unknown = snapshot.get('bytes');
      return bytes instanceof dbSdk.Bytes
        ? new Uint8Array(bytes.toUint8Array())
        : null;
    } catch (error) {
      console.warn(`Could not read the replay ${id}`, error);
      return null;
    }
  }

  public async sendCommand(
    type: ReplayCommandType,
    replayId: string
  ): Promise<string | null> {
    const { db, dbSdk } = this.connection;
    const uid = await this.signedIn();
    const ref = dbSdk.doc(dbSdk.collection(db, 'replayCommands'));
    dbSdk
      .setDoc(ref, {
        uid,
        type,
        replayId,
        createdAt: dbSdk.serverTimestamp(),
        expireAt: dbSdk.Timestamp.fromMillis(Date.now() + COMMAND_TTL_MS),
      })
      .catch((error: unknown) =>
        console.warn('The replay command could not be sent', error)
      );
    return ref.id;
  }

  public watchCommand(
    commandId: string
  ): Observable<ReplayCommandResult | null> {
    const { db, dbSdk } = this.connection;
    const ref = dbSdk.doc(db, 'replayCommands', commandId);
    return new Observable((subscriber) =>
      dbSdk.onSnapshot(
        ref,
        (snapshot) =>
          subscriber.next(parseCommandResult(snapshot.get('result'))),
        (error) => console.error(`Could not read ${ref.path}`, error)
      )
    );
  }

  private signedIn(): Promise<string> {
    return firstValueFrom(
      this.playerIds.pipe(filter((uid): uid is string => uid !== null))
    );
  }
}

/** A `replays` document as a listing - null for one it cannot read. */
function listingOf(doc: DocumentSnapshot): ReplayListing | null {
  const data = doc.data();
  if (data === undefined) {
    return null;
  }
  const createdAt: unknown = data['createdAt'];
  const millis =
    typeof createdAt === 'object' &&
    createdAt !== null &&
    'toMillis' in createdAt &&
    typeof createdAt.toMillis === 'function'
      ? (createdAt.toMillis() as unknown)
      : null;
  const { kind, levelId, balanceVersion, replayVersion, ticks, endedBy } = data;
  const { winnerSeat, hint, state, score } = data;
  if (
    !KINDS.includes(kind) ||
    typeof levelId !== 'string' ||
    typeof balanceVersion !== 'number' ||
    typeof replayVersion !== 'number' ||
    typeof millis !== 'number' ||
    typeof ticks !== 'number' ||
    typeof endedBy !== 'string' ||
    (winnerSeat !== null && typeof winnerSeat !== 'number') ||
    typeof hint !== 'number' ||
    !STATES.includes(state)
  ) {
    return null;
  }
  return {
    id: doc.id,
    kind,
    levelId,
    balanceVersion,
    replayVersion,
    createdAt: millis,
    ticks,
    endedBy: endedBy as EndReason,
    winnerSeat,
    hint,
    state,
    ...(typeof score === 'number' ? { score } : {}),
  };
}
