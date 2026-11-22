import {
  PLAY_GAMES_ADOPTIONS,
  PLAY_GAMES_NONCE_LENGTH,
  PLAY_GAMES_RELEASES,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import { firstValueFrom, from, timeout } from 'rxjs';
import { commandEnvelope } from './command-envelope';
import type { FirebaseConnection } from './firebase-connection';

/** How long the release may take before the switch goes on without it. */
export const RELEASE_MS = 10_000;

/**
 * A Google account adopting a Play-only account (#3187): the Play-only
 * session releases itself right before the switch, and the Google account
 * names it once its progress landed, both with the same nonce, which only
 * this tab knows. `playGamesAdoption` then moves the Play Games links.
 */
export interface PendingAdoption {
  /** The Play-only account adopted. */
  from: string;
  /** The release's nonce, also the id the progress is adopted under. */
  nonce: string;
}

/**
 * Releases the Play-only account `uid` for an adoption: writes
 * `playGamesReleases/{uid}` with a fresh nonce and answers it - null when
 * the write failed (the rules refuse an account without a Play Games link)
 * or took longer than {@link RELEASE_MS}, so no adoption follows.
 */
export async function releasePlayOnlyAccount(
  { db, dbSdk }: FirebaseConnection,
  uid: string
): Promise<PendingAdoption | null> {
  const nonce = randomNonce();
  try {
    await firstValueFrom(
      from(
        dbSdk.setDoc(dbSdk.doc(db, PLAY_GAMES_RELEASES, uid), {
          ...commandEnvelope(dbSdk, uid, Date.now()),
          nonce,
        })
      ).pipe(timeout(RELEASE_MS))
    );
    return { from: uid, nonce };
  } catch (error) {
    console.warn('Could not release the Play Games account', error);
    return null;
  }
}

/**
 * Writes the adoption of `adoption.from` by `writer`, the Google account
 * that holds its progress now. Not awaited by anyone: should it fail, the
 * Play Games player keeps its old link, as before.
 */
export async function writePlayGamesAdoption(
  { db, dbSdk }: FirebaseConnection,
  writer: string,
  { from: adopted, nonce }: PendingAdoption
): Promise<void> {
  try {
    await dbSdk.setDoc(dbSdk.doc(dbSdk.collection(db, PLAY_GAMES_ADOPTIONS)), {
      ...commandEnvelope(dbSdk, writer, Date.now()),
      from: adopted,
      nonce,
    });
  } catch (error) {
    console.warn('Could not hand over the Play Games link', error);
  }
}

/** 128 random bits as lower-case hex. */
function randomNonce(): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(PLAY_GAMES_NONCE_LENGTH / 2)
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}
