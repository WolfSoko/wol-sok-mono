import { filter, firstValueFrom, type Observable } from 'rxjs';
import { attemptExpireAt, parseAttemptId } from '../state/attempts';
import type { FirebaseConnection } from './firebase-connection';
import {
  DECLARE_TIMEOUT_MS,
  type DeclaredAttempt,
  type Declaration,
  type DeclarationMiss,
  type GameRanked,
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
    const { db, dbSdk } = this.connection;
    try {
      const uid = await this.signedIn();
      // A get each: a list would read every match of a deep run.
      const snapshots = await Promise.all(
        ids.map((id) =>
          dbSdk.getDoc(dbSdk.doc(db, 'players', uid, 'attempts', id))
        )
      );
      return snapshots.flatMap((snapshot) => {
        const at = millisOf(snapshot.get('at'));
        return snapshot.exists() && at !== null
          ? [{ id: snapshot.id, at, void: snapshot.get('void') === true }]
          : [];
      });
    } catch (error) {
      console.warn('Could not read the ranked attempts', error);
      return null;
    }
  }

  public async declare(
    attemptId: string
  ): Promise<Declaration | DeclarationMiss> {
    const { db, dbSdk } = this.connection;
    // Only a void daily attempt is declared again; a void endless match
    // counts as not played, and its run goes on with the next one.
    const redeclarable = parseAttemptId(attemptId)?.kind === 'daily';
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new TimedOut()), DECLARE_TIMEOUT_MS);
    });
    try {
      const uid = await Promise.race([this.signedIn(), timedOut]);
      const ref = dbSdk.doc(db, 'players', uid, 'attempts', attemptId);
      await Promise.race([
        dbSdk.runTransaction(db, async (transaction) => {
          const before = await transaction.get(ref);
          if (
            before.exists() &&
            !(redeclarable && before.get('void') === true)
          ) {
            throw new Taken();
          }
          // Whole, so a declaration again drops the void marks.
          transaction.set(ref, {
            at: dbSdk.serverTimestamp(),
            expireAt: dbSdk.Timestamp.fromMillis(attemptExpireAt(Date.now())),
          });
        }),
        timedOut,
      ]);
      const snapshot = await Promise.race([
        dbSdk.getDocFromServer(ref),
        timedOut,
      ]);
      const at = millisOf(snapshot.get('at'));
      return at === null ? 'failed' : { uid, at };
    } catch (error) {
      if (error instanceof Taken) {
        return 'taken';
      }
      console.warn(`Could not declare the ranked attempt ${attemptId}`, error);
      return 'failed';
    } finally {
      clearTimeout(timeout);
    }
  }

  private signedIn(): Promise<string> {
    return firstValueFrom(
      this.playerIds.pipe(filter((uid): uid is string => uid !== null))
    );
  }
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
