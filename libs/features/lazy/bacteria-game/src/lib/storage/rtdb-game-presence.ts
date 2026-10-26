import { Observable } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import type { GamePresence, PresenceState } from './game-social';

type Rtdb = NonNullable<FirebaseConnection['rtdb']>;

/**
 * How often a refused status is asked for again, the n-th time after n
 * times {@link REFUSED_RETRY_MS}: the rules let a player read only the
 * status of a friend who lists them (ADR 0012), whose mirror the functions
 * write a few seconds after the friend entry.
 */
export const REFUSED_TRIES = 5;
export const REFUSED_RETRY_MS = 5_000;

/**
 * Who is online, in the Realtime Database: `status/{uid}` = `{ state, at }`
 * while the player shares it. The database removes the entry itself the
 * moment the connection drops (`onDisconnect`), and this device writes it
 * again when the connection comes back.
 */
export class RtdbGamePresence implements GamePresence {
  /** What this device shares, and for whom - null while it shares nothing. */
  private shared: { uid: string; state: PresenceState } | null = null;
  private connected = false;

  public constructor(
    private readonly connection: FirebaseConnection,
    private readonly rtdb: Rtdb
  ) {
    const { rtdbSdk } = connection;
    rtdbSdk.onValue(rtdbSdk.ref(rtdb, '.info/connected'), (snapshot) => {
      this.connected = snapshot.val() === true;
      if (this.connected) {
        void this.write();
      }
    });
  }

  /**
   * The player's status, null while they share none or it may not be
   * read. A refused read ends the database's listener, so it is listened
   * to again, at most {@link REFUSED_TRIES} times in a row.
   */
  public watch(uid: string): Observable<PresenceState | null> {
    const { rtdbSdk } = this.connection;
    const ref = rtdbSdk.ref(this.rtdb, `status/${uid}`);
    return new Observable<PresenceState | null>((subscriber) => {
      let refused = 0;
      let retry: ReturnType<typeof setTimeout> | undefined;
      let stop = (): void => undefined;
      const listen = (): void => {
        stop = rtdbSdk.onValue(
          ref,
          (snapshot) => {
            refused = 0;
            const state: unknown = snapshot.child('state').val();
            subscriber.next(
              state === 'online' || state === 'playing' ? state : null
            );
          },
          () => {
            subscriber.next(null);
            // Not for a subscriber that let go on that null.
            if (!subscriber.closed && ++refused <= REFUSED_TRIES) {
              retry = setTimeout(listen, refused * REFUSED_RETRY_MS);
            }
          }
        );
      };
      listen();
      return () => {
        clearTimeout(retry);
        stop();
      };
    });
  }

  public set(uid: string, state: PresenceState | null): void {
    const before = this.shared;
    if (before?.uid === uid && before.state === state) {
      return;
    }
    this.shared = state === null ? null : { uid, state };
    // Another player on this device, or none: the last one goes.
    if (before !== null && before.uid !== uid) {
      void this.clear(before.uid);
    }
    if (state === null) {
      if (before?.uid === uid) {
        void this.clear(uid);
      }
      return;
    }
    void this.write();
  }

  private async write(): Promise<void> {
    const shared = this.shared;
    if (shared === null || !this.connected) {
      return;
    }
    const { rtdbSdk } = this.connection;
    const ref = rtdbSdk.ref(this.rtdb, `status/${shared.uid}`);
    try {
      // Armed first, so a connection that drops right after the write
      // still clears it.
      await rtdbSdk.onDisconnect(ref).remove();
      await rtdbSdk.set(ref, {
        state: shared.state,
        at: rtdbSdk.serverTimestamp(),
      });
    } catch (error) {
      console.warn('Could not share the online status', error);
    }
  }

  private async clear(uid: string): Promise<void> {
    const { rtdbSdk } = this.connection;
    const ref = rtdbSdk.ref(this.rtdb, `status/${uid}`);
    try {
      // Removed first: if that fails, the disconnect still clears it.
      await rtdbSdk.remove(ref);
      await rtdbSdk.onDisconnect(ref).cancel();
    } catch (error) {
      console.warn('Could not take the online status back', error);
    }
  }
}
