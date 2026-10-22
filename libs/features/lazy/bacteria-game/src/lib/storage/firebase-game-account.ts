import { signal } from '@angular/core';
import type { User, UserCredential } from '@angular/fire/auth';
import { map, Observable, ReplaySubject } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import { beforeRetry, errorCode } from './retry';
import type {
  GameAccount,
  PlayerProfile,
  PlayerSwitch,
  SignInOutcome,
} from './game-account';

/** Sign-in errors that mean the player closed the popup or started another. */
const CANCELLED = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

/** The sign-in error of a device that is offline - the one worth retrying. */
const NETWORK_ERROR = 'auth/network-request-failed';

/**
 * The player as Firebase Auth knows them: a guest - an anonymous account,
 * signed in to without asking - until they sign in with Google. Linking
 * the guest to Google keeps its uid, so the progress stays where it is.
 */
export class FirebaseGameAccount implements GameAccount {
  public readonly cloud = true;
  private readonly profileState = signal<PlayerProfile | null>(null);
  public readonly profile = this.profileState.asReadonly();
  private readonly switches = new ReplaySubject<PlayerSwitch>(1);
  private playerId: string | null = null;
  public readonly players: Observable<PlayerSwitch> =
    this.switches.asObservable();
  /**
   * The uid of whoever plays, null between a sign-out and the next guest.
   * A service that hears of a switch and stores right away stores for the
   * next player: the subject keeps the switch before it tells anyone.
   */
  public readonly playerIds: Observable<string | null> = this.players.pipe(
    map(({ playerId }) => playerId)
  );
  /** Set while this tab signs in to a Google account that played elsewhere. */
  private adoptingGuest = false;

  public constructor(private readonly connection: FirebaseConnection) {
    const { auth, authSdk, run } = connection;
    run(() =>
      authSdk.onAuthStateChanged(auth, (user) => {
        this.profileState.set(user === null ? null : profileOf(user));
        // Nobody before the first guest is no switch: the visit has just
        // started. Nobody after a player is - the one signed out is gone.
        const playerId = user?.uid ?? null;
        if (playerId !== this.playerId) {
          this.playerId = playerId;
          this.switches.next({ playerId, adoptsGuest: this.adoptingGuest });
        }
        this.adoptingGuest = false;
        if (user === null) {
          void this.signInAsGuest();
        }
      })
    );
  }

  public async signIn(): Promise<SignInOutcome> {
    const { auth, authSdk, run } = this.connection;
    const provider = new authSdk.GoogleAuthProvider();
    const user = auth.currentUser;
    let error: unknown;
    try {
      const credential: UserCredential = await run(() =>
        user?.isAnonymous
          ? authSdk.linkWithPopup(user, provider)
          : authSdk.signInWithPopup(auth, provider)
      );
      // Linking keeps the user, so no auth state change tells the profile.
      this.profileState.set(profileOf(credential.user));
      return 'signed-in';
    } catch (linkError) {
      error = linkError;
    }
    const code = errorCode(error);
    if (CANCELLED.has(code)) {
      return 'cancelled';
    }
    const google =
      code === 'auth/credential-already-in-use'
        ? authSdk.GoogleAuthProvider.credentialFromError(
            error as Parameters<
              typeof authSdk.GoogleAuthProvider.credentialFromError
            >[0]
          )
        : null;
    if (google === null) {
      console.error('Could not sign in with Google', error);
      return 'failed';
    }
    // The Google account has played elsewhere: it takes over from the
    // guest, and the guest's progress joins it.
    this.adoptingGuest = true;
    try {
      await run(() => authSdk.signInWithCredential(auth, google));
      return 'signed-in';
    } catch (signInError) {
      this.adoptingGuest = false;
      console.error('Could not sign in with Google', signInError);
      return 'failed';
    }
  }

  public async signOut(): Promise<void> {
    const { auth, authSdk, run } = this.connection;
    await run(() => authSdk.signOut(auth));
  }

  /**
   * Signs in a new guest - once online, when the device is not. Until then
   * nobody plays: the storage answers nothing and holds back what is played
   * for the guest to come. A project that refuses guests - anonymous sign-in
   * switched off - is not tried again.
   */
  private async signInAsGuest(): Promise<void> {
    const { auth, authSdk, run } = this.connection;
    for (let attempt = 0; auth.currentUser === null; attempt++) {
      try {
        await run(() => authSdk.signInAnonymously(auth));
      } catch (error) {
        if (errorCode(error) !== NETWORK_ERROR) {
          console.error('Could not sign in as a guest', error);
          return;
        }
        await beforeRetry(attempt);
      }
    }
  }
}

function profileOf(user: User): PlayerProfile {
  if (user.isAnonymous) {
    return { guest: true, name: null };
  }
  // A linked guest keeps its empty profile; the Google profile has the name.
  const google = user.providerData.find(
    (profile) => profile.providerId === 'google.com'
  );
  return {
    guest: false,
    name: user.displayName ?? google?.displayName ?? user.email,
  };
}
