import {
  catchError,
  distinctUntilChanged,
  EMPTY,
  filter,
  firstValueFrom,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import {
  type GameModeration,
  holdingBans,
  parseBan,
  parseMirroredBan,
  parseNotice,
  type PlayerBan,
  type PlayerNotice,
} from './game-moderation';

/**
 * The player's ban and notices (ADR 0012): `bans/{uid}` in Firestore, which
 * the rules let the player `get`, with its mirror in the Realtime Database
 * (`bans/{uid}`, the end in ms, `0` for good), which only they read - the
 * value the database's own rules check `status` writes against. Either one
 * holding is a ban: the functions write the stored ban first and lift it
 * last, so the two part only for the moment between. The notices are
 * `players/{uid}/notices`, read and deleted by the player.
 */
export class FirestoreGameModeration implements GameModeration {
  private readonly bans: Observable<PlayerBan | null>;

  public constructor(
    private readonly connection: FirebaseConnection,
    /** Whoever plays, null while nobody does. */
    private readonly playerIds: Observable<string | null>
  ) {
    this.bans = playerIds.pipe(
      distinctUntilChanged(),
      switchMap((uid) =>
        uid === null
          ? EMPTY
          : holdingBans(this.storedBan(uid), this.mirroredBan(uid))
      ),
      // One listener each for the storage, the replays and the game.
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  public ban(): Observable<PlayerBan | null> {
    return this.bans;
  }

  public notices(): Observable<PlayerNotice[]> {
    const { db, dbSdk } = this.connection;
    return this.playerIds.pipe(
      distinctUntilChanged(),
      switchMap((uid) =>
        uid === null
          ? of([])
          : new Observable<PlayerNotice[]>((subscriber) =>
              dbSdk.onSnapshot(
                dbSdk.collection(db, 'players', uid, 'notices'),
                (snapshot) =>
                  subscriber.next(
                    snapshot.docs
                      .map((doc) => parseNotice(doc.id, doc.data()))
                      .filter((notice) => notice !== null)
                      .sort((a, b) => a.at - b.at)
                  ),
                (error) => {
                  console.warn('Could not read the notices', error);
                  subscriber.next([]);
                }
              )
            )
      )
    );
  }

  public async dismiss(id: string): Promise<void> {
    const { db, dbSdk } = this.connection;
    const uid = await firstValueFrom(
      this.playerIds.pipe(filter((each): each is string => each !== null))
    );
    try {
      await dbSdk.deleteDoc(dbSdk.doc(db, 'players', uid, 'notices', id));
    } catch (error) {
      console.warn('Could not dismiss the notice', error);
    }
  }

  /** `bans/{uid}` live - a miss the cache tells counts: it is no ban either. */
  private storedBan(uid: string): Observable<PlayerBan | null> {
    const { db, dbSdk } = this.connection;
    return new Observable<PlayerBan | null>((subscriber) =>
      dbSdk.onSnapshot(
        dbSdk.doc(db, 'bans', uid),
        (snapshot) =>
          subscriber.next(snapshot.exists() ? parseBan(snapshot.data()) : null),
        (error) => {
          console.warn('Could not read the ban', error);
          subscriber.next(null);
        }
      )
    );
  }

  /**
   * The mirror live - none until the database answers, which it does only
   * online, so it never holds the stored ban's answer back.
   */
  private mirroredBan(uid: string): Observable<PlayerBan | null> {
    const { rtdb, rtdbSdk } = this.connection;
    if (rtdb == null) {
      return of(null);
    }
    return new Observable<PlayerBan | null>((subscriber) =>
      rtdbSdk.onValue(
        rtdbSdk.ref(rtdb, `bans/${uid}`),
        (snapshot) => subscriber.next(parseMirroredBan(snapshot.val())),
        () => subscriber.next(null)
      )
    ).pipe(
      startWith(null),
      catchError(() => of(null))
    );
  }
}
