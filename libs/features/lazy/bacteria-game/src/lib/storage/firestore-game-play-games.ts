import {
  parseCommandResult,
  PLAY_GAMES_SIGN_INS,
  PLAY_GAMES_TOKEN_KEY,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import type { DocumentSnapshot } from 'firebase/firestore';
import { filter, firstValueFrom, Observable, take, timeout } from 'rxjs';
import { commandEnvelope } from './command-envelope';
import type { FirebaseConnection } from './firebase-connection';
import type { GamePlayGames, PlayGamesAnswer } from './game-play-games';

/**
 * How long the sign-in waits for the functions: a cold start, Google's
 * exchange and a transaction fit well within it.
 */
export const PLAY_GAMES_ANSWER_MS = 30_000;

/** How long it waits for the first player - a guest is signed in to first. */
const PLAYER_MS = 30_000;

/**
 * {@link GamePlayGames} on Firestore: a command document
 * `playGamesSignIns/{id}` in the first player's name, read back until the
 * functions wrote its result, then deleted - it holds a sign-in token.
 */
export class FirestoreGamePlayGames implements GamePlayGames {
  public constructor(
    private readonly connection: FirebaseConnection,
    private readonly playerIds: Observable<string | null>
  ) {}

  public async signIn(code: string): Promise<PlayGamesAnswer | null> {
    const { db, dbSdk } = this.connection;
    try {
      const uid = await firstValueFrom(
        this.playerIds.pipe(
          filter((id): id is string => id !== null),
          timeout(PLAYER_MS)
        )
      );
      const ref = dbSdk.doc(dbSdk.collection(db, PLAY_GAMES_SIGN_INS));
      // Awaited: the rules let the writer read it only once it exists.
      await dbSdk.setDoc(ref, {
        ...commandEnvelope(dbSdk, uid, Date.now()),
        code,
      });
      const answer = await firstValueFrom(
        snapshotsOf((next, error) => dbSdk.onSnapshot(ref, next, error)).pipe(
          filter((snapshot) => snapshot.get('result') !== undefined),
          take(1),
          timeout(PLAY_GAMES_ANSWER_MS)
        )
      );
      await dbSdk.deleteDoc(ref).catch((error: unknown) => {
        console.warn('The Play Games sign-in could not be deleted', error);
      });
      return answerOf(answer);
    } catch (error) {
      console.warn('The Play Games sign-in got no answer', error);
      return null;
    }
  }
}

/** The snapshots a listener started by `listen` tells, until unsubscribed. */
function snapshotsOf(
  listen: (
    next: (snapshot: DocumentSnapshot) => void,
    error: (error: unknown) => void
  ) => () => void
): Observable<DocumentSnapshot> {
  return new Observable<DocumentSnapshot>((subscriber) =>
    listen(
      (snapshot) => subscriber.next(snapshot),
      (error) => subscriber.error(error)
    )
  );
}

function answerOf(snapshot: DocumentSnapshot): PlayGamesAnswer | null {
  const result = parseCommandResult(snapshot.get('result'));
  if (result === null) {
    return null;
  }
  const token: unknown = snapshot.get(PLAY_GAMES_TOKEN_KEY);
  return { ...result, token: typeof token === 'string' ? token : null };
}
