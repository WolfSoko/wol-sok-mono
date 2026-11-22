import { signal } from '@angular/core';
import type { User, UserCredential } from 'firebase/auth';
import { map, Observable, ReplaySubject } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import { isOwnerToken } from './owner-token';
import { beforeRetry, errorCode } from './retry';
import type {
  GameAccount,
  PlayerProfile,
  PlayerSwitch,
  SignInOutcome,
} from './game-account';
import type { PlayGamesToken } from './game-play-games';
import {
  type PendingAdoption,
  releasePlayOnlyAccount,
  writePlayGamesAdoption,
} from './play-games-adoption';

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
 * signed in to without asking - until they sign in with Google, or the
 * Android app hands over their Play Games player (a custom token, #3175).
 * Linking the guest to Google keeps its uid, so the progress stays where
 * it is.
 */
export class FirebaseGameAccount implements GameAccount {
  public readonly cloud = true;
  private readonly profileState = signal<PlayerProfile | null>(null);
  public readonly profile = this.profileState.asReadonly();
  private readonly ownerState = signal(false);
  public readonly owner = this.ownerState.asReadonly();
  /** Counts the tokens seen, so a late answer for an older one is dropped. */
  private tokens = 0;
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
  /**
   * Set while a Play-only account, released for it, signs in to a Google
   * account that played elsewhere: its Play Games link moves along once
   * its progress landed (#3187).
   */
  private pendingAdoption: PendingAdoption | null = null;

  public constructor(private readonly connection: FirebaseConnection) {
    const { auth, authSdk } = connection;
    authSdk.onAuthStateChanged(auth, (user) => {
      this.profileState.set(user === null ? null : profileOf(user));
      // Nobody before the first guest is no switch: the visit has just
      // started. Nobody after a player is - the one signed out is gone.
      const playerId = user?.uid ?? null;
      if (playerId !== this.playerId) {
        this.playerId = playerId;
        this.switchTo(playerId);
      }
      this.adoptingGuest = false;
      this.pendingAdoption = null;
      if (user === null) {
        void this.signInAsGuest();
      }
    });
    authSdk.onIdTokenChanged(auth, (user) => void this.checkOwner(user));
  }

  public async signIn(): Promise<SignInOutcome> {
    const { auth, authSdk } = this.connection;
    const provider = new authSdk.GoogleAuthProvider();
    // Given here, not set up with Auth: it loads Google's sign-in frame.
    const popups = authSdk.browserPopupRedirectResolver;
    const user = auth.currentUser;
    let error: unknown;
    try {
      // A guest, or an account of a Play Games player, has no provider:
      // Google joins it, under its uid.
      const credential: UserCredential =
        user !== null && user.providerData.length === 0
          ? await authSdk.linkWithPopup(user, provider, popups)
          : await authSdk.signInWithPopup(auth, provider, popups);
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
    // guest, and the guest's progress joins it. A Play-only account
    // releases itself first, so its Play Games link can follow.
    this.pendingAdoption =
      user !== null && isPlayOnly(user)
        ? await releasePlayOnlyAccount(this.connection, user.uid)
        : null;
    this.adoptingGuest = true;
    try {
      await authSdk.signInWithCredential(auth, google);
      return 'signed-in';
    } catch (signInError) {
      this.adoptingGuest = false;
      this.pendingAdoption = null;
      console.error('Could not sign in with Google', signInError);
      return 'failed';
    }
  }

  public async signInWithToken(
    { value, uid }: PlayGamesToken,
    writer: string
  ): Promise<boolean> {
    const { auth, authSdk } = this.connection;
    const user = auth.currentUser;
    // Another player plays since the sign-in was sent - or one already
    // signed in to this account, whose session needs no new token.
    if (user?.uid !== writer || (uid === writer && !user.isAnonymous)) {
      return false;
    }
    // Another account takes over from the guest, as a Google account that
    // played elsewhere does; the same account only gets a new session.
    this.adoptingGuest = uid !== writer;
    try {
      const credential = await authSdk.signInWithCustomToken(auth, value);
      // The same uid is no auth state change, so the profile is told here.
      this.profileState.set(profileOf(credential.user));
      return true;
    } catch (error) {
      this.adoptingGuest = false;
      console.error('Could not sign in with Play Games', error);
      return false;
    }
  }

  public async signOut(): Promise<void> {
    const { auth, authSdk } = this.connection;
    await authSdk.signOut(auth);
  }

  /**
   * Tells the switch to `playerId`. With a pending adoption, every player
   * document reports its landing while it hears of the switch, and the
   * adoption is written only once all of them landed: a link never moves
   * ahead of the progress.
   */
  private switchTo(playerId: string | null): void {
    const pending =
      this.adoptingGuest && playerId !== null ? this.pendingAdoption : null;
    const landings: Promise<boolean>[] = [];
    this.switches.next({
      playerId,
      adoptsGuest: this.adoptingGuest,
      ...(pending === null
        ? {}
        : {
            adoption: {
              id: pending.nonce,
              landed: (stored: Promise<boolean>) => landings.push(stored),
            },
          }),
    });
    if (pending !== null && playerId !== null) {
      void this.handOverLink(playerId, pending, landings);
    }
  }

  /** Writes the adoption once every landing stored its value. */
  private async handOverLink(
    writer: string,
    pending: PendingAdoption,
    landings: readonly Promise<boolean>[]
  ): Promise<void> {
    let landed: boolean[];
    try {
      landed = await Promise.all(landings);
    } catch (error) {
      console.warn('Could not adopt the Play Games account', error);
      return;
    }
    if (landed.every(Boolean)) {
      await writePlayGamesAdoption(this.connection, writer, pending);
    }
  }

  /**
   * Whether `user` is the owner, from the token they hold - not refreshed:
   * a claim granted meanwhile shows with the next token, within the hour or
   * after signing in again.
   */
  private async checkOwner(user: User | null): Promise<void> {
    const token = ++this.tokens;
    if (user === null || user.isAnonymous) {
      this.ownerState.set(false);
      return;
    }
    let owner = false;
    try {
      owner = isOwnerToken(
        await this.connection.authSdk.getIdTokenResult(user)
      );
    } catch (error) {
      console.warn('Could not read the sign-in token', error);
    }
    if (token === this.tokens) {
      this.ownerState.set(owner);
    }
  }

  /**
   * Signs in a new guest - once online, when the device is not. Until then
   * nobody plays: the storage answers nothing and holds back what is played
   * for the guest to come. A project that refuses guests - anonymous sign-in
   * switched off - is not tried again.
   */
  private async signInAsGuest(): Promise<void> {
    const { auth, authSdk } = this.connection;
    for (let attempt = 0; auth.currentUser === null; attempt++) {
      try {
        await authSdk.signInAnonymously(auth);
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

/** An account of a Play Games player alone: a custom token, no provider. */
function isPlayOnly(user: User): boolean {
  return !user.isAnonymous && user.providerData.length === 0;
}

function profileOf(user: User): PlayerProfile {
  if (user.isAnonymous) {
    return { guest: true, name: null };
  }
  // A linked guest keeps its empty profile; the Google profile has the
  // name. An account of a Play Games player has no provider: its name is
  // the account's, the Play Games one the functions gave it.
  const google = user.providerData.find(
    (profile) => profile.providerId === 'google.com'
  );
  const photoUrl = user.photoURL ?? google?.photoURL ?? null;
  return {
    guest: false,
    name: user.displayName ?? google?.displayName ?? user.email,
    ...(photoUrl === null ? {} : { photoUrl }),
  };
}
