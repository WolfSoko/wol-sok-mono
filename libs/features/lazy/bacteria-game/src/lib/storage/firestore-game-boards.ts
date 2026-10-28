import { Observable } from 'rxjs';
import { VISIBLE_STATUSES } from '../state/boards';
import type { FirebaseConnection } from './firebase-connection';
import {
  type BoardCursor,
  type BoardMember,
  type BoardTop,
  type GameBoards,
  type OwnEntry,
  type PagedEntry,
  parseBoardEntry,
  parseBoardMember,
  parseBoardTop,
} from './game-boards';
import { errorCode } from './retry';

/**
 * The boards in Firestore (ADR 0012): `boards/{id}` holds the top 50
 * already ordered, `boards/{id}/entries` the rest. A list or a count of
 * entries keeps to the visible statuses, or the rules refuse it, and orders
 * by `sort` desc, `atHour` asc, so the one entries index serves it.
 */
export class FirestoreGameBoards implements GameBoards {
  public constructor(private readonly connection: FirebaseConnection) {}

  public watchTop(boardId: string): Observable<BoardTop | null> {
    const { db, dbSdk } = this.connection;
    return new Observable((subscriber) =>
      dbSdk.onSnapshot(
        dbSdk.doc(db, 'boards', boardId),
        (snapshot) =>
          subscriber.next(
            snapshot.exists() ? parseBoardTop(snapshot.data()) : null
          ),
        (error) => subscriber.error(error)
      )
    );
  }

  public async page(
    boardId: string,
    after: BoardCursor,
    limit: number
  ): Promise<PagedEntry[]> {
    const { dbSdk } = this.connection;
    const snapshot = await dbSdk.getDocs(
      dbSdk.query(
        this.entries(boardId),
        dbSdk.where('status', 'in', [...VISIBLE_STATUSES]),
        dbSdk.orderBy('sort', 'desc'),
        dbSdk.orderBy('atHour', 'asc'),
        dbSdk.orderBy(dbSdk.documentId(), 'asc'),
        dbSdk.startAfter(after.sort, after.atHour, after.entryId),
        dbSdk.limit(limit)
      )
    );
    return snapshot.docs.flatMap((doc) => {
      const entry = parseBoardEntry(doc.data());
      return entry === null ? [] : [{ ...entry, entryId: doc.id }];
    });
  }

  public async member(uid: string): Promise<BoardMember | null> {
    const { db, dbSdk } = this.connection;
    const snapshot = await dbSdk.getDoc(dbSdk.doc(db, 'boardMembers', uid));
    return snapshot.exists() ? parseBoardMember(snapshot.data()) : null;
  }

  public async entry(boardId: string, entryId: string): Promise<OwnEntry> {
    const { db, dbSdk } = this.connection;
    try {
      const snapshot = await dbSdk.getDoc(
        dbSdk.doc(db, 'boards', boardId, 'entries', entryId)
      );
      const entry = snapshot.exists() ? parseBoardEntry(snapshot.data()) : null;
      return entry === null
        ? { state: 'missing' }
        : entry.status === 'hidden'
          ? { state: 'hidden' }
          : { state: 'shown', entry };
    } catch (error) {
      // A hidden entry is not the player's to read; a missing one the
      // rules let through as not found, so a refusal means hidden.
      if (errorCode(error) === 'permission-denied') {
        return { state: 'hidden' };
      }
      throw error;
    }
  }

  public async countAbove(boardId: string, sort: number): Promise<number> {
    const { dbSdk } = this.connection;
    const snapshot = await dbSdk.getCountFromServer(
      dbSdk.query(
        this.entries(boardId),
        dbSdk.where('status', 'in', [...VISIBLE_STATUSES]),
        dbSdk.where('sort', '>', sort),
        dbSdk.orderBy('sort', 'desc'),
        dbSdk.orderBy('atHour', 'asc')
      )
    );
    return snapshot.data().count;
  }

  private entries(boardId: string) {
    const { db, dbSdk } = this.connection;
    return dbSdk.collection(db, 'boards', boardId, 'entries');
  }
}
