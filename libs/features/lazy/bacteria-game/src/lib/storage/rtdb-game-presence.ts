import { Observable } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import type { GamePresence, PresenceState } from './game-social';

type Rtdb = NonNullable<FirebaseConnection['rtdb']>;

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

  public watch(uid: string): Observable<PresenceState | null> {
    const { rtdbSdk } = this.connection;
    return new Observable((subscriber) =>
      rtdbSdk.onValue(
        rtdbSdk.ref(this.rtdb, `status/${uid}`),
        (snapshot) => {
          const state: unknown = snapshot.child('state').val();
          subscriber.next(
            state === 'online' || state === 'playing' ? state : null
          );
        },
        () => subscriber.next(null)
      )
    );
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
      await rtdbSdk.onDisconnect(ref).cancel();
      await rtdbSdk.remove(ref);
    } catch (error) {
      console.warn('Could not take the online status back', error);
    }
  }
}
