import type { DocumentReference, DocumentSnapshot } from 'firebase/firestore';
import {
  catchError,
  EMPTY,
  filter,
  firstValueFrom,
  map,
  Observable,
} from 'rxjs';
import { replayToBytes, MAX_PACKED_BYTES } from '../state/replay-pack';
import type { EndReason } from '../state/win-conditions';
import type { FirebaseConnection } from './firebase-connection';
import type { GameReplays } from './game-replays';
import {
  ARRIVAL_REASONS,
  type ArrivalReason,
  ONLINE_REASONS,
  type OnlineReason,
} from '../state/replay-reasons';
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
/**
 * How often a document the rules refuse - one that does not exist yet - is
 * asked again before the watch gives up.
 */
const REFUSED_TRIES = 8;

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
  public readonly cloud = true;

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
    // Until the replay exists the rules refuse to read it - they read its
    // players - so a refusal means "not yet". Given up, it completes.
    return this.snapshotsOf(dbSdk.doc(db, 'replays', id)).pipe(
      map((snapshot) => snapshot?.exists() ?? false),
      catchError(() => EMPTY)
    );
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
        .map((doc) => listingOf(doc, uid))
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
    // A command still on its way to the server is refused like a replay
    // not yet stored; a watch that gives up errors.
    return this.snapshotsOf(dbSdk.doc(db, 'replayCommands', commandId)).pipe(
      map((snapshot) =>
        snapshot === null ? null : parseCommandResult(snapshot.get('result'))
      )
    );
  }

  /**
   * The snapshots of `ref`, null for each time the rules refused it - they
   * refuse a document that does not exist yet - after which it is listened
   * to again, at most {@link REFUSED_TRIES} times. Then, or on any other
   * error, it errors.
   */
  private snapshotsOf(
    ref: DocumentReference
  ): Observable<DocumentSnapshot | null> {
    const { dbSdk } = this.connection;
    return new Observable<DocumentSnapshot | null>((subscriber) => {
      let stop: (() => void) | null = null;
      let closed = false;
      const listen = (attempt: number) => {
        stop = dbSdk.onSnapshot(
          ref,
          (snapshot) => subscriber.next(snapshot),
          (error) => {
            subscriber.next(null);
            if (
              attempt >= REFUSED_TRIES ||
              errorCode(error) !== 'permission-denied'
            ) {
              subscriber.error(error);
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

  private signedIn(): Promise<string> {
    return firstValueFrom(
      this.playerIds.pipe(filter((uid): uid is string => uid !== null))
    );
  }
}

/**
 * A `replays/{id}` document as the player `uid` sees it in their list -
 * null for one it cannot read. The fields are the functions' (ADR 0011,
 * 0012): `acceptReplay`'s record and state, online the room's `seats`
 * (host, guest) and its stub, and the boards' `rankedReason` once they
 * decided. Anything it does not know is left out rather than guessed.
 */
export function listingOf(
  doc: Pick<DocumentSnapshot, 'id' | 'data'>,
  uid: string
): ReplayListing | null {
  const data = doc.data();
  if (data === undefined) {
    return null;
  }
  const millis = millisOf(data['createdAt']);
  const { kind, levelId, balanceVersion, replayVersion, ticks, endedBy } = data;
  const { winnerSeat, hint, state, score, seats } = data;
  if (
    !KINDS.includes(kind) ||
    typeof levelId !== 'string' ||
    typeof balanceVersion !== 'number' ||
    typeof replayVersion !== 'number' ||
    millis === null ||
    typeof ticks !== 'number' ||
    typeof endedBy !== 'string' ||
    (winnerSeat !== null && typeof winnerSeat !== 'number') ||
    typeof hint !== 'number' ||
    !STATES.includes(state)
  ) {
    return null;
  }
  const rankedReason = reasonOf(kind, data['rankedReason']);
  const publicId = data['publicId'];
  const optOut = data['optOut'];
  // Online the host played seat 0 and the guest seat 1; a seat the player
  // is not in (a deleted account's, say) reads as theirs being the first.
  const seat =
    kind === 'online' && Array.isArray(seats) && seats.indexOf(uid) > 0
      ? seats.indexOf(uid)
      : 0;
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
    seat,
    ...(typeof score === 'number' ? { score } : {}),
    ...(rankedReason === null ? {} : { rankedReason }),
    ...(data['galleryOut'] === true ||
    (Array.isArray(optOut) && optOut.includes(uid))
      ? { galleryOut: true }
      : {}),
    ...(typeof publicId === 'string' ? { publicId } : {}),
  };
}

/** A Firestore timestamp in ms - null for anything else. */
function millisOf(value: unknown): number | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    const millis: unknown = value.toMillis();
    return typeof millis === 'number' ? millis : null;
  }
  return null;
}

/** The reason of the board the kind ranks on - null for none it knows. */
function reasonOf(
  kind: ReplayKind,
  value: unknown
): ArrivalReason | OnlineReason | null {
  const known: readonly string[] =
    kind === 'online' ? ONLINE_REASONS : ARRIVAL_REASONS;
  return typeof value === 'string' && known.includes(value)
    ? (value as ArrivalReason | OnlineReason)
    : null;
}
