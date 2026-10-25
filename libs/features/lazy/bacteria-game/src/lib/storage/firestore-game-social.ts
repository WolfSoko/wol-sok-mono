import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Query,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import type { Profile } from '../social/profile';
import type { FirebaseConnection } from './firebase-connection';
import type { MatchLevelPick, PickedMatchLevel } from '../state/match-level';
import type { Challenge, GameSocial, QueueEntry, Waiting } from './game-social';

/** How long an invitation link works. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** How long a challenge stands - the room it names lasts no longer. */
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
/** How long a queue entry lasts unless it is refreshed. */
const QUEUE_TTL_MS = 10 * 60 * 1000;
/** The letters of an invitation token - 32, so a byte maps to one evenly. */
const TOKEN_LETTERS = 'abcdefghijkmnpqrstuvwxyz23456789';
const TOKEN_LENGTH = 20;
/** What the rules take as a queue entry's level. */
const QUEUE_LEVEL = /^[a-z0-9-]{1,40}$/;
const PICKS: readonly MatchLevelPick[] = ['waiting', 'claimer', 'random'];

/**
 * The social data in Firestore - see ADR 0010 for the documents and
 * `apps/bacteria-game-remote/firestore.rules` for who may write what.
 */
export class FirestoreGameSocial implements GameSocial {
  public constructor(private readonly connection: FirebaseConnection) {}

  public watchProfile(uid: string): Observable<unknown> {
    return this.watchDoc(this.doc('profiles', uid), (snapshot) =>
      snapshot.exists() ? snapshot.data() : null
    );
  }

  /**
   * Writes every field the profile has, each whole - an avatar replaces the
   * last one rather than merging into it, which the rules would refuse -
   * and leaves any other field of the document as it is.
   */
  public async saveProfile(uid: string, profile: Profile): Promise<void> {
    const { dbSdk } = this.connection;
    const data = {
      name: profile.name,
      motto: profile.motto,
      avatar: { ...profile.avatar },
      shareStatus: profile.shareStatus,
      publicName: profile.publicName,
      boardOptOut: profile.boardOptOut,
      galleryOptOut: profile.galleryOptOut,
      updatedAt: dbSdk.serverTimestamp(),
    };
    await dbSdk.setDoc(this.doc('profiles', uid), data, {
      mergeFields: Object.keys(data),
    });
  }

  public watchFriends(uid: string): Observable<string[]> {
    return this.watchIds(this.collection('players', uid, 'friends'));
  }

  public watchListedBy(of: string, me: string): Observable<boolean> {
    return this.watchDoc(this.doc('players', of, 'friends', me), (snapshot) =>
      snapshot.exists()
    );
  }

  public watchRequests(uid: string): Observable<string[]> {
    return this.watchIds(this.collection('players', uid, 'requests'));
  }

  public async sendRequest(me: string, to: string): Promise<void> {
    const { db, dbSdk } = this.connection;
    const batch = dbSdk.writeBatch(db);
    batch.set(this.doc('players', me, 'friends', to), {
      since: dbSdk.serverTimestamp(),
    });
    batch.set(this.doc('players', to, 'requests', me), {
      at: dbSdk.serverTimestamp(),
    });
    await batch.commit();
  }

  public async acceptRequest(me: string, from: string): Promise<void> {
    const { db, dbSdk } = this.connection;
    const batch = dbSdk.writeBatch(db);
    batch.set(this.doc('players', me, 'friends', from), {
      since: dbSdk.serverTimestamp(),
    });
    batch.delete(this.doc('players', me, 'requests', from));
    await batch.commit();
  }

  public async declineRequest(me: string, from: string): Promise<void> {
    await this.connection.dbSdk.deleteDoc(
      this.doc('players', me, 'requests', from)
    );
  }

  public async removeFriend(me: string, friend: string): Promise<void> {
    const { db, dbSdk } = this.connection;
    const batch = dbSdk.writeBatch(db);
    batch.delete(this.doc('players', me, 'friends', friend));
    batch.delete(this.doc('players', friend, 'friends', me));
    await batch.commit();
  }

  public async createInvite(me: string): Promise<string> {
    const { dbSdk } = this.connection;
    const token = inviteToken();
    await dbSdk.setDoc(this.doc('invites', token), {
      from: me,
      at: dbSdk.serverTimestamp(),
      expireAt: dbSdk.Timestamp.fromMillis(Date.now() + INVITE_TTL_MS),
    });
    return token;
  }

  public async readInvite(token: string): Promise<string | null> {
    const { dbSdk } = this.connection;
    if (!/^[a-z2-9]{20}$/.test(token)) {
      return null;
    }
    const snapshot = await dbSdk.getDoc(this.doc('invites', token));
    const from: unknown = snapshot.get('from');
    const expireAt: unknown = snapshot.get('expireAt');
    const expired =
      expireAt instanceof dbSdk.Timestamp && expireAt.toMillis() < Date.now();
    return typeof from === 'string' && !expired ? from : null;
  }

  public async acceptInvite(
    me: string,
    token: string,
    from: string
  ): Promise<void> {
    const { db, dbSdk } = this.connection;
    const batch = dbSdk.writeBatch(db);
    batch.set(this.doc('players', me, 'friends', from), {
      since: dbSdk.serverTimestamp(),
    });
    // On the inviter's list by the invitation, which the rules check.
    batch.set(this.doc('players', from, 'friends', me), {
      since: dbSdk.serverTimestamp(),
      invite: token,
    });
    await batch.commit();
  }

  public async challenge(
    me: string,
    friend: string,
    code: string
  ): Promise<void> {
    const { dbSdk } = this.connection;
    await dbSdk.setDoc(this.doc('players', friend, 'challenges', me), {
      code,
      at: dbSdk.serverTimestamp(),
      expireAt: dbSdk.Timestamp.fromMillis(Date.now() + CHALLENGE_TTL_MS),
    });
  }

  public watchChallenges(uid: string): Observable<Challenge[]> {
    const { dbSdk } = this.connection;
    const query = dbSdk.query(
      this.collection('players', uid, 'challenges'),
      dbSdk.orderBy('at')
    );
    return this.watchQuery(query, (docs) =>
      docs.flatMap((doc) => {
        const code: unknown = doc.get('code');
        const expireAt: unknown = doc.get('expireAt');
        const expired =
          expireAt instanceof dbSdk.Timestamp &&
          expireAt.toMillis() < Date.now();
        return typeof code === 'string' && !expired
          ? [{ from: doc.id, code }]
          : [];
      })
    );
  }

  public async clearChallenge(to: string, from: string): Promise<void> {
    await this.connection.dbSdk.deleteDoc(
      this.doc('players', to, 'challenges', from)
    );
  }

  public async enqueue(uid: string, level: string | null): Promise<void> {
    const { dbSdk } = this.connection;
    // A fresh entry: the rules let an existing one change only `seen` and
    // `level`.
    await dbSdk.deleteDoc(this.doc('queue', uid));
    await dbSdk.setDoc(this.doc('queue', uid), {
      since: dbSdk.serverTimestamp(),
      seen: dbSdk.serverTimestamp(),
      expireAt: dbSdk.Timestamp.fromMillis(Date.now() + QUEUE_TTL_MS),
      level: readLevel(level),
      claim: null,
    });
  }

  public async setQueueLevel(uid: string, level: string | null): Promise<void> {
    const { dbSdk } = this.connection;
    // With `seen` and `expireAt`, as the rules want it.
    await dbSdk.updateDoc(this.doc('queue', uid), {
      level: readLevel(level),
      seen: dbSdk.serverTimestamp(),
      expireAt: dbSdk.Timestamp.fromMillis(Date.now() + QUEUE_TTL_MS),
    });
  }

  public async stillWaiting(uid: string): Promise<void> {
    const { dbSdk } = this.connection;
    await dbSdk.updateDoc(this.doc('queue', uid), {
      seen: dbSdk.serverTimestamp(),
      expireAt: dbSdk.Timestamp.fromMillis(Date.now() + QUEUE_TTL_MS),
    });
  }

  public async leaveQueue(uid: string): Promise<void> {
    await this.connection.dbSdk.deleteDoc(this.doc('queue', uid));
  }

  public watchQueueEntry(uid: string): Observable<QueueEntry | null> {
    return this.watchDoc(this.doc('queue', uid), (snapshot) =>
      snapshot.exists() ? this.queueEntry(snapshot) : null
    );
  }

  public async waiting(limit: number, seenSince: number): Promise<Waiting[]> {
    const { dbSdk } = this.connection;
    // Only entries refreshed lately, so players who left never fill the
    // page; the oldest of them first. One inequality, no composite index.
    const snapshot = await dbSdk.getDocs(
      dbSdk.query(
        this.collection('queue'),
        dbSdk.where('seen', '>=', dbSdk.Timestamp.fromMillis(seenSince)),
        dbSdk.limit(limit)
      )
    );
    return snapshot.docs
      .map((doc) => ({ uid: doc.id, ...this.queueEntry(doc) }))
      .sort((a, b) => (a.since ?? 0) - (b.since ?? 0));
  }

  public async claim(
    uid: string,
    by: string,
    code: string,
    pick: (level: string | null) => PickedMatchLevel
  ): Promise<PickedMatchLevel | null> {
    const { db, dbSdk } = this.connection;
    const ref = this.doc('queue', uid);
    return dbSdk.runTransaction(db, async (transaction) => {
      const entry = await transaction.get(ref);
      if (!entry.exists() || entry.get('claim') !== null) {
        return null;
      }
      // Their choice as it stands at the claim.
      const picked = pick(readLevel(entry.get('level')));
      transaction.update(ref, {
        claim: { by, code, level: picked.levelId, pick: picked.pick },
      });
      return picked;
    });
  }

  private queueEntry(snapshot: DocumentSnapshot): QueueEntry {
    const claim: unknown = snapshot.get('claim');
    const { code, level, pick } = (claim ?? {}) as {
      code?: unknown;
      level?: unknown;
      pick?: unknown;
    };
    return {
      since: this.millis(snapshot, 'since'),
      seen: this.millis(snapshot, 'seen'),
      level: readLevel(snapshot.get('level')),
      claim: typeof code === 'string' ? code : null,
      picked:
        typeof code === 'string' &&
        typeof level === 'string' &&
        PICKS.includes(pick as MatchLevelPick)
          ? { levelId: level, pick: pick as MatchLevelPick }
          : null,
    };
  }

  /** A timestamp field in ms - its estimate while the write is pending. */
  private millis(snapshot: DocumentSnapshot, field: string): number | null {
    const value: unknown = snapshot.get(field, {
      serverTimestamps: 'estimate',
    });
    return value instanceof this.connection.dbSdk.Timestamp
      ? value.toMillis()
      : null;
  }

  private doc(...path: [string, ...string[]]): DocumentReference {
    const { db, dbSdk } = this.connection;
    return dbSdk.doc(db, path.join('/'));
  }

  private collection(...path: [string, ...string[]]) {
    const { db, dbSdk } = this.connection;
    return dbSdk.collection(db, path.join('/'));
  }

  private watchDoc<T>(
    ref: DocumentReference,
    read: (snapshot: DocumentSnapshot) => T
  ): Observable<T> {
    const { dbSdk } = this.connection;
    return new Observable((subscriber) =>
      dbSdk.onSnapshot(
        ref,
        (snapshot) => subscriber.next(read(snapshot)),
        (error) => console.error(`Could not read ${ref.path}`, error)
      )
    );
  }

  private watchQuery<T>(
    query: Query<DocumentData>,
    read: (docs: DocumentSnapshot[]) => T
  ): Observable<T> {
    const { dbSdk } = this.connection;
    return new Observable((subscriber) =>
      dbSdk.onSnapshot(
        query,
        (snapshot) => subscriber.next(read(snapshot.docs)),
        (error) => console.error('Could not read a list', error)
      )
    );
  }

  private watchIds(query: Query<DocumentData>): Observable<string[]> {
    return this.watchQuery(query, (docs) => docs.map((doc) => doc.id));
  }
}

/**
 * A queue entry's level - null for any, and for what the rules would not
 * take as one.
 */
function readLevel(value: unknown): string | null {
  return typeof value === 'string' && QUEUE_LEVEL.test(value) ? value : null;
}

/** A fresh invitation token - a letter per random byte, none favoured. */
export function inviteToken(
  bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH))
): string {
  return Array.from(
    bytes.subarray(0, TOKEN_LENGTH),
    (byte) => TOKEN_LETTERS[byte % TOKEN_LETTERS.length]
  ).join('');
}
