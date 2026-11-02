import { filter, firstValueFrom, Observable } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import { GameRooms, JoinedRoom, OpenRoom, roomCode } from './game-rooms';
import { errorCode } from './retry';

/** How long a room lasts: Firestore's TTL policy on `expireAt` deletes it. */
const ROOM_TTL_MS = 60 * 60 * 1000;
/**
 * How long a room's stub lasts after the room was opened - the most the
 * rules allow. A match reported later is kept for its players only.
 */
export const STUB_TTL_SECONDS = 6 * 60 * 60;
/** Codes tried before giving up - one taken already is tried again. */
const CODE_ATTEMPTS = 4;

/**
 * The rooms in Firestore, a document per code - `rooms/{code}` = `{ host,
 * offer, createdAt, expireAt }`, to which the guest adds `guest` and
 * `answer`. Once connected, the host replaces it with its stub `{ host,
 * guest, createdAt, expireAt, taken: true }`. The rules let anyone signed
 * in read a room by its code, never list them, only one guest answer it
 * and only its host swap it for the stub.
 */
export class FirestoreGameRooms implements GameRooms {
  public constructor(
    private readonly connection: FirebaseConnection,
    /** Whoever plays, null while nobody does. */
    private readonly playerIds: Observable<string | null>
  ) {}

  public async open(offer: string): Promise<OpenRoom> {
    const { db, dbSdk } = this.connection;
    const host = await this.signedIn();
    for (let attempt = 1; ; attempt++) {
      const code = roomCode();
      const ref = dbSdk.doc(db, 'rooms', code);
      try {
        // Refused by the rules when the code is taken: a write over a room
        // is an update, and only a guest's answer may update one.
        await dbSdk.setDoc(ref, {
          host,
          offer,
          createdAt: dbSdk.serverTimestamp(),
          expireAt: dbSdk.Timestamp.fromMillis(Date.now() + ROOM_TTL_MS),
        });
      } catch (error) {
        if (
          errorCode(error) === 'permission-denied' &&
          attempt < CODE_ATTEMPTS
        ) {
          continue;
        }
        throw error;
      }
      let stop: () => void = () => undefined;
      const answer = new Promise<string>((resolve, reject) => {
        stop = dbSdk.onSnapshot(
          ref,
          (snapshot) => {
            if (!snapshot.exists()) {
              stop();
              reject(new Error('The room is gone.'));
              return;
            }
            const value: unknown = snapshot.get('answer');
            if (typeof value === 'string') {
              stop();
              resolve(value);
            }
          },
          reject
        );
      });
      return {
        code,
        answer,
        close: () => {
          stop();
          // A room nobody joined is no use to anyone; the TTL takes the rest.
          dbSdk.deleteDoc(ref).catch(() => undefined);
        },
        take: async () => {
          stop();
          // From the server: the rules want the stored `createdAt` back
          // unchanged, and the guest as it answered.
          const room = await dbSdk.getDocFromServer(ref);
          const createdAt: unknown = room.get('createdAt');
          const guest: unknown = room.get('guest');
          if (
            !(createdAt instanceof dbSdk.Timestamp) ||
            typeof guest !== 'string'
          ) {
            throw new Error('The room has no guest to take it.');
          }
          // A whole new document: the offer and answer must go.
          await dbSdk.setDoc(ref, {
            host,
            guest,
            createdAt,
            expireAt: new dbSdk.Timestamp(
              createdAt.seconds + STUB_TTL_SECONDS,
              createdAt.nanoseconds
            ),
            taken: true,
          });
        },
      };
    }
  }

  public async join(code: string): Promise<JoinedRoom | null> {
    const { db, dbSdk } = this.connection;
    const guest = await this.signedIn();
    const ref = dbSdk.doc(db, 'rooms', code);
    // From the server: a room cached on this device may be long taken.
    const snapshot = await dbSdk.getDocFromServer(ref);
    const offer: unknown = snapshot.get('offer');
    if (
      !snapshot.exists() ||
      typeof offer !== 'string' ||
      snapshot.get('answer') != null
    ) {
      return null;
    }
    return {
      offer,
      answer: async (answer) => {
        await dbSdk.updateDoc(ref, { guest, answer });
      },
    };
  }

  /** The uid of whoever plays, once somebody does. */
  private signedIn(): Promise<string> {
    return firstValueFrom(
      this.playerIds.pipe(filter((uid): uid is string => uid !== null))
    );
  }
}
