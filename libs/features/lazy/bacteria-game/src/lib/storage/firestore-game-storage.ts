import type { DocumentReference, DocumentSnapshot } from 'firebase/firestore';
import {
  catchError,
  EMPTY,
  filter,
  firstValueFrom,
  from,
  Observable,
  switchMap,
} from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import type { GameStorage } from './game-storage';
import { beforeRetry, errorCode } from './retry';
import { parseStoredJson } from './stored-json';

/**
 * Errors after which trying again cannot help: the rules refuse the write -
 * it belongs to a player no longer signed in - or the value is not one
 * Firestore takes.
 */
const FINAL_ERRORS = new Set(['permission-denied', 'invalid-argument']);

/**
 * The game's storage in Firestore, a document per player and key -
 * `players/{uid}/storage/{key}` - holding the value as JSON, so any plain
 * JSON value fits, nested arrays too. It answers for whoever plays
 * (`playerIds`): on a switch, `watch` moves on to the next player's value.
 *
 * Changes queue per key and run as transactions in turn, each on the latest
 * stored value, so a count lands exactly once. A change that fails offline
 * waits to be online and runs then; one queued as a player signs out is
 * refused by the rules and dropped. The queue lives as long as the page:
 * a change made offline is lost when the page closes before it is online
 * again.
 */
export class FirestoreGameStorage implements GameStorage {
  /** The JSON last seen under each document, to skip writes that change nothing. */
  private readonly seen = new Map<string, string | null>();
  private readonly queues = new Map<string, Promise<void>>();

  public constructor(
    private readonly connection: Promise<FirebaseConnection>,
    /** Whoever plays, null while nobody does. */
    private readonly playerIds: Observable<string | null>
  ) {}

  public watch(key: string): Observable<unknown> {
    return this.playerIds.pipe(
      switchMap((uid) =>
        uid === null
          ? EMPTY
          : from(this.connection).pipe(
              switchMap((connection) => this.snapshots(connection, uid, key)),
              // Without a connection, nothing is stored.
              catchError(() => EMPTY)
            )
      )
    );
  }

  public write(key: string, value: unknown): void {
    const json = JSON.stringify(value);
    this.enqueue(key, async ({ dbSdk }, ref) => {
      // The snapshot of the write itself, which comes at once, updates `seen`.
      if (json === undefined || this.seen.get(ref.path) === json) {
        return;
      }
      // Not awaited: offline, Firestore keeps the write and sends it later.
      dbSdk.setDoc(ref, stored(dbSdk, json)).catch((error: unknown) => {
        console.error(`Could not store ${key}`, error);
      });
    });
  }

  public update(key: string, change: (stored: unknown) => unknown): void {
    this.enqueue(key, async ({ db, dbSdk }, ref) => {
      for (let attempt = 0; ; attempt++) {
        try {
          await dbSdk.runTransaction(db, async (transaction) => {
            const before = jsonOf(await transaction.get(ref));
            const after = JSON.stringify(change(parseStoredJson(before)));
            if (after !== undefined && after !== before) {
              transaction.set(ref, stored(dbSdk, after));
            }
          });
          return;
        } catch (error) {
          if (FINAL_ERRORS.has(errorCode(error))) {
            console.error(`Could not store ${key}`, error);
            return;
          }
          await beforeRetry(attempt);
        }
      }
    });
  }

  /**
   * Runs `task` on the document of the key for the player playing now - or
   * the next one, when nobody does yet - after the tasks queued before it.
   */
  private enqueue(
    key: string,
    task: (
      connection: FirebaseConnection,
      ref: DocumentReference
    ) => Promise<void>
  ): void {
    // Nobody plays between a sign-out and the next guest: what is stored
    // meanwhile is the next guest's.
    const player = firstValueFrom(
      this.playerIds.pipe(filter((uid): uid is string => uid !== null))
    );
    const queued = (this.queues.get(key) ?? Promise.resolve())
      .then(async () => {
        const [connection, uid] = await Promise.all([this.connection, player]);
        await task(connection, documentOf(connection, uid, key));
      })
      .catch((error: unknown) =>
        console.error(`Could not store ${key}`, error)
      );
    this.queues.set(key, queued);
  }

  private snapshots(
    connection: FirebaseConnection,
    uid: string,
    key: string
  ): Observable<unknown> {
    const ref = documentOf(connection, uid, key);
    return new Observable((subscriber) =>
      connection.dbSdk.onSnapshot(
        ref,
        (snapshot) => {
          const json = jsonOf(snapshot);
          this.seen.set(ref.path, json);
          subscriber.next(parseStoredJson(json));
        },
        (error) => {
          console.error(`Could not read ${key}`, error);
          subscriber.next(null);
        }
      )
    );
  }
}

function documentOf(
  { db, dbSdk }: FirebaseConnection,
  uid: string,
  key: string
): DocumentReference {
  return dbSdk.doc(db, 'players', uid, 'storage', key);
}

/** The document as the rules expect it: the JSON and when it was written. */
function stored(dbSdk: FirebaseConnection['dbSdk'], json: string) {
  return { json, updatedAt: dbSdk.serverTimestamp() };
}

/** The JSON a document holds, null when there is none. */
function jsonOf(snapshot: DocumentSnapshot): string | null {
  const json: unknown = snapshot.get('json');
  return typeof json === 'string' ? json : null;
}
