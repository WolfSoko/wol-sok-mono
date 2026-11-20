import {
  parseRelayCredentials,
  RELAY_COLLECTION,
  RELAY_DOC_ID,
  type RelayCredentials,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import type { FirebaseConnection } from './firebase-connection';
import { millisOf } from './firestore-values';
import type { GameRelay, RelayServer } from './game-relay';

/**
 * The longest wait for `relay/turn` before a device connects without the
 * relay: a match should not wait on it.
 */
export const RELAY_READ_TIMEOUT_MS = 2000;

/**
 * Credentials read are used again while they last more than this - the
 * functions refresh them every 30 minutes, an hour each, so a read after
 * this is sure to find newer ones.
 */
export const RELAY_KEEP_MS = 20 * 60_000;

/**
 * How far past their expiry, by this device's clock, credentials are still
 * handed on: a phone whose clock runs ahead would else never use the
 * relay. Credentials that really expired are refused by Cloudflare, and the
 * devices connect without the relay, as they would without them.
 */
export const CLOCK_SLACK_MS = 60 * 60_000;

/**
 * The relay's credentials from `relay/turn` (ADR 0020), which only the
 * functions write and which the rules let any signed-in player who is not
 * banned read. Read when the game connects, kept while they last more
 * than {@link RELAY_KEEP_MS}.
 */
export class FirestoreGameRelay implements GameRelay {
  private kept: RelayCredentials | null = null;

  public constructor(
    private readonly connection: FirebaseConnection,
    private readonly now: () => number = Date.now
  ) {}

  public async servers(): Promise<readonly RelayServer[]> {
    if (
      this.kept === null ||
      this.kept.expireAt - this.now() <= RELAY_KEEP_MS
    ) {
      // A failed read keeps what this device has, while it may still work.
      this.kept = (await this.read()) ?? this.kept;
    }
    const kept = this.kept;
    if (kept === null || kept.expireAt + CLOCK_SLACK_MS <= this.now()) {
      return [];
    }
    const { urls, username, credential } = kept;
    return [{ urls, username, credential }];
  }

  /** The stored credentials - null for none, a refusal or a slow read. */
  private async read(): Promise<RelayCredentials | null> {
    const { db, dbSdk } = this.connection;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const givenUp = new Promise<null>((resolve) => {
      timeout = setTimeout(() => resolve(null), RELAY_READ_TIMEOUT_MS);
    });
    try {
      const snapshot = await Promise.race([
        dbSdk.getDoc(dbSdk.doc(db, RELAY_COLLECTION, RELAY_DOC_ID)),
        givenUp,
      ]);
      return snapshot === null
        ? null
        : parseRelayCredentials(snapshot.data(), (value) => millisOf(value));
    } catch (error) {
      console.warn('The relay credentials could not be read', error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
