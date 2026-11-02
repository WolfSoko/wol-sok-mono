import type { Observable } from 'rxjs';
import { attemptExpireAt, attemptTaken } from '../state/attempts';
import type { FirebaseConnection } from './firebase-connection';
import { millisOf, signedIn } from './firestore-values';
import {
  DECLARE_TIMEOUT_MS,
  type DeclaredAttempt,
  type Declaration,
  type DeclarationMiss,
  type GameRanked,
  LOAD_TIMEOUT_MS,
} from './game-ranked';

/** Thrown inside the transaction for an attempt declared already. */
class Taken extends Error {}

/** Thrown when the declaration took too long. */
class TimedOut extends Error {}

/**
 * The declared attempts in Firestore (ADR 0012): what the rules'
 * `isDeclaration` wants - `at` and `expireAt` only, `at` the server's time,
 * `expireAt` 28 to 32 days ahead, taken from this device's clock plus 31
 * days (`attemptExpireAt`) - for an id `isTodaysDaily` or `isEndlessAttempt`
 * accepts, which the caller picks (`nextDailyAttemptId`, `nextRunId`).
 */
export class FirestoreGameRanked implements GameRanked {
  public constructor(
    private readonly connection: FirebaseConnection,
    /** Whoever plays, null while nobody does. */
    private readonly playerIds: Observable<string | null>
  ) {}

  public async declared(
    ids: readonly string[]
  ): Promise<DeclaredAttempt[] | null> {
    const { dbSdk } = this.connection;
    const read = async (): Promise<DeclaredAttempt[]> => {
      const uid = await signedIn(this.playerIds);
      // A get each: a list would read every match of a deep run.
      const snapshots = await Promise.all(
        ids.map((id) => dbSdk.getDoc(this.attempt(uid, id)))
      );
      return snapshots.flatMap((snapshot) => {
        const at = millisOf(snapshot.get('at'));
        return snapshot.exists() && at !== null
          ? [{ id: snapshot.id, at, void: snapshot.get('void') === true }]
          : [];
      });
    };
    try {
      // Offline a get may wait long: unknown then, not none declared.
      return await withDeadline(read(), LOAD_TIMEOUT_MS);
    } catch (error) {
      console.warn('Could not read the ranked attempts', error);
      return null;
    }
  }

  public async declare(
    attemptId: string
  ): Promise<Declaration | DeclarationMiss> {
    const { db, dbSdk } = this.connection;
    // Whose it is, once known - for the read after the deadline.
    const declaring: { uid?: string } = {};
    const declareNow = async (): Promise<Declaration | 'failed'> => {
      const uid = await signedIn(this.playerIds);
      declaring.uid = uid;
      const ref = this.attempt(uid, attemptId);
      await dbSdk.runTransaction(db, async (transaction) => {
        const before = await transaction.get(ref);
        if (
          before.exists() &&
          attemptTaken(attemptId, true, before.get('void') === true)
        ) {
          throw new Taken();
        }
        // Whole, so a declaration again drops the void marks.
        transaction.set(ref, {
          at: dbSdk.serverTimestamp(),
          expireAt: dbSdk.Timestamp.fromMillis(attemptExpireAt(Date.now())),
        });
      });
      const at = millisOf((await dbSdk.getDocFromServer(ref)).get('at'));
      return at === null ? 'failed' : { uid, at };
    };
    try {
      return await withDeadline(declareNow(), DECLARE_TIMEOUT_MS);
    } catch (error) {
      if (error instanceof Taken) {
        return 'taken';
      }
      if (error instanceof TimedOut && declaring.uid !== undefined) {
        const late = await this.readBack(declaring.uid, attemptId);
        if (late !== null) {
          return late;
        }
      }
      console.warn(`Could not declare the ranked attempt ${attemptId}`, error);
      return 'failed';
    }
  }

  /**
   * Once more from the server, after the deadline: the declaration, should
   * the transaction have committed - the attempt there with its `at`, and
   * not void (a declaration again drops that) - null else.
   */
  private async readBack(
    uid: string,
    attemptId: string
  ): Promise<Declaration | null> {
    try {
      const snapshot = await withDeadline(
        this.connection.dbSdk.getDocFromServer(this.attempt(uid, attemptId)),
        DECLARE_TIMEOUT_MS
      );
      const at = millisOf(snapshot.get('at'));
      return snapshot.exists() && at !== null && snapshot.get('void') !== true
        ? { uid, at }
        : null;
    } catch {
      return null;
    }
  }

  private attempt(uid: string, attemptId: string) {
    const { db, dbSdk } = this.connection;
    return dbSdk.doc(db, 'players', uid, 'attempts', attemptId);
  }
}

/** What `task` comes to - or a `TimedOut` rejection after `ms`. */
async function withDeadline<T>(task: Promise<T>, ms: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new TimedOut()), ms);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
