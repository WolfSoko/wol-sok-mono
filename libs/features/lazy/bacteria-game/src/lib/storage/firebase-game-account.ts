import { signal } from '@angular/core';
import type { User, UserCredential } from 'firebase/auth';
import { Observable, ReplaySubject } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import { beforeRetry } from './retry';
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

/**
 * The player as Firebase Auth knows them: a guest - an anonymous account,
 * signed in to without asking - until they sign in with Google. Linking
 * the guest to Google keeps its uid, so the progress stays where it is.
 */
export class FirebaseGameAccount implements GameAccount {
  public readonly cloud = true;
  private readonly profileState = signal<PlayerProfile | null>(null);
  public readonly profile = this.profileState.asReadonly();
  private readonly ids = new ReplaySubject<string>(1);
  private readonly switches = new ReplaySubject<PlayerSwitch>(1);
  private playerId: string | null = null;
  public readonly players: Observable<PlayerSwitch> =
    this.switches.asObservable();
  /**
   * The uid of whoever plays, again on every switch - told before
   * `players`, so a service that hears of a switch and stores right away
   * stores for the next player, not the one before.
   */
  public readonly playerIds: Observable<string> = this.ids.asObservable();
  /** Set while this tab signs in to a Google account that played elsewhere. */
  private adoptingGuest = false;

  public constructor(private readonly connection: Promise<FirebaseConnection>) {
    connection.then(
      ({ auth, authSdk }) =>
        authSdk.onAuthStateChanged(auth, (user) => {
          if (user === null) {
            this.profileState.set(null);
            void this.signInAsGuest();
            return;
          }
          this.profileState.set(profileOf(user));
          if (user.uid !== this.playerId) {
            this.playerId = user.uid;
            this.ids.next(user.uid);
            this.switches.next({
              playerId: user.uid,
              adoptsGuest: this.adoptingGuest,
            });
          }
          this.adoptingGuest = false;
        }),
      (error: unknown) =>
        console.error('Could not connect to the game cloud', error)
    );
  }

  public async signIn(): Promise<SignInOutcome> {
    const { auth, authSdk } = await this.connection;
    const provider = new authSdk.GoogleAuthProvider();
    const user = auth.currentUser;
    try {
      const credential: UserCredential = user?.isAnonymous
        ? await authSdk.linkWithPopup(user, provider)
        : await authSdk.signInWithPopup(auth, provider);
      // Linking keeps the user, so no auth state change tells the profile.
      this.profileState.set(profileOf(credential.user));
      return 'signed-in';
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
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
        await authSdk.signInWithCredential(auth, google);
        return 'signed-in';
      } catch (signInError) {
        this.adoptingGuest = false;
        console.error('Could not sign in with Google', signInError);
        return 'failed';
      }
    }
  }

  public async signOut(): Promise<void> {
    const { auth, authSdk } = await this.connection;
    await authSdk.signOut(auth);
  }

  /**
   * Signs in a new guest - once online, when the device is not. Until then
   * nobody plays: the storage answers nothing and keeps what is played.
   */
  private async signInAsGuest(): Promise<void> {
    const { auth, authSdk } = await this.connection;
    for (let attempt = 0; auth.currentUser === null; attempt++) {
      try {
        await authSdk.signInAnonymously(auth);
      } catch (error) {
        console.warn('Could not sign in as a guest', error);
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
