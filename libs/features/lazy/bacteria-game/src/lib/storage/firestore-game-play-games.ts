import {
  parseCommandResult,
  PLAY_GAMES_SIGN_INS,
  PLAY_GAMES_TOKEN_KEY,
  PLAY_GAMES_TOKEN_UID_KEY,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import type { DocumentSnapshot } from 'firebase/firestore';
import { filter, firstValueFrom, from, Observable, take, timeout } from 'rxjs';
import { commandEnvelope } from './command-envelope';
import type { FirebaseConnection } from './firebase-connection';
import { signedIn } from './firestore-values';
import type { GamePlayGames, PlayGamesAnswer } from './game-play-games';

/**
 * How long each step of the sign-in waits - the first player, the write
 * and the functions' answer: a cold start, Google's exchange and a
 * transaction fit well within it.
 */
export const PLAY_GAMES_ANSWER_MS = 30_000;

/**
 * {@link GamePlayGames} on Firestore: a command document
 * `playGamesSignIns/{id}` in the first player's name, read back until the
 * functions wrote its result, then deleted, answered or not - it holds the
 * code and maybe a sign-in token.
 */
export class FirestoreGamePlayGames implements GamePlayGames {
  public constructor(
    private readonly connection: FirebaseConnection,
    private readonly playerIds: Observable<string | null>
  ) {}

  public async signIn(code: string): Promise<PlayGamesAnswer | null> {
    const { db, dbSdk } = this.connection;
    try {
      const uid = await signedIn(this.playerIds, PLAY_GAMES_ANSWER_MS);
      const ref = dbSdk.doc(dbSdk.collection(db, PLAY_GAMES_SIGN_INS));
      // Awaited: the rules let the writer read it only once it exists. An
      // offline device holds the write until it is back, so the wait has
      // an end; the write still goes once online, and TTL takes it then.
      await firstValueFrom(
        from(
          dbSdk.setDoc(ref, {
            ...commandEnvelope(dbSdk, uid, Date.now()),
            code,
          })
        ).pipe(timeout(PLAY_GAMES_ANSWER_MS))
      );
      try {
        const answered = await firstValueFrom(
          new Observable<DocumentSnapshot>((subscriber) =>
            dbSdk.onSnapshot(
              ref,
              (snapshot) => subscriber.next(snapshot),
              (error) => subscriber.error(error)
            )
          ).pipe(
            filter((snapshot) => snapshot.get('result') !== undefined),
            take(1),
            timeout(PLAY_GAMES_ANSWER_MS)
          )
        );
        return answerOf(answered, uid);
      } finally {
        // Answered or not, it holds a code and maybe a token: gone now, and
        // TTL takes it should this delete fail. Not awaited: offline, the
        // delete waits for the network, the answer must not.
        dbSdk.deleteDoc(ref).catch((error: unknown) => {
          console.warn('The Play Games sign-in could not be deleted', error);
        });
      }
    } catch (error) {
      console.warn('The Play Games sign-in got no answer', error);
      return null;
    }
  }
}

function answerOf(
  snapshot: DocumentSnapshot,
  writer: string
): PlayGamesAnswer | null {
  const result = parseCommandResult(snapshot.get('result'));
  if (result === null) {
    return null;
  }
  const value: unknown = snapshot.get(PLAY_GAMES_TOKEN_KEY);
  const uid: unknown = snapshot.get(PLAY_GAMES_TOKEN_UID_KEY);
  const token =
    typeof value === 'string' && typeof uid === 'string'
      ? { value, uid }
      : null;
  return { ...result, token, writer };
}
