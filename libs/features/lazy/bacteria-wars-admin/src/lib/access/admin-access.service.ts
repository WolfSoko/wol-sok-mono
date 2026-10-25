import { inject, Injectable, signal } from '@angular/core';
import { GameCloud } from '@wolsok/feat-lazy-bac-game/admin-kit';

/** Where the visitor stands with the admin area. */
export type AdminAccess =
  | 'checking'
  /** No project in this build: nothing to administer. */
  | 'no-project'
  /** Nobody, or a guest, is signed in. */
  | 'signed-out'
  /** Signed in, but not as the owner. */
  | 'no-access'
  | 'granted';

/** How recent a sign-in the rules want for destructive commands. */
export const RECENT_SIGN_IN_MS = 3_600_000;

/**
 * Whether the signed-in user is the owner (ADR 0012): the `admin` claim, a
 * verified email and a Google sign-in, read from a freshly fetched token,
 * the same three facts the rules' `isAdmin()` checks. A courtesy: the
 * rules and the functions are the lock.
 */
@Injectable({ providedIn: 'root' })
export class AdminAccessService {
  private readonly cloud = inject(GameCloud);
  private readonly state = signal<AdminAccess>('checking');
  /** When the owner last signed in, ms since the epoch. */
  private readonly signedInAt = signal<number | null>(null);

  public readonly access = this.state.asReadonly();

  /** The owner's uid once access is granted. */
  public uid(): string | null {
    return this.state() === 'granted'
      ? (this.cloud.firebase()?.auth.currentUser?.uid ?? null)
      : null;
  }

  /** Whether the sign-in is recent enough for a destructive command. */
  public signedInLately(now: number = Date.now()): boolean {
    const at = this.signedInAt();
    return at !== null && now - at < RECENT_SIGN_IN_MS;
  }

  /** Checks the signed-in user again, with a fresh token. */
  public async check(): Promise<AdminAccess> {
    const connection = this.cloud.firebase();
    if (connection === null) {
      return this.settle('no-project');
    }
    const { auth, authSdk } = connection;
    await auth.authStateReady();
    const user = auth.currentUser;
    if (user === null || user.isAnonymous) {
      return this.settle('signed-out');
    }
    try {
      const token = await authSdk.getIdTokenResult(user, true);
      const owner =
        token.claims['admin'] === true &&
        token.claims['email_verified'] === true &&
        token.signInProvider === 'google.com';
      this.signedInAt.set(Date.parse(token.authTime));
      return this.settle(owner ? 'granted' : 'no-access');
    } catch (error) {
      console.error('Could not read the admin token', error);
      return this.settle('no-access');
    }
  }

  /** Signs in with Google (again), then checks. False when it failed. */
  public async signIn(): Promise<boolean> {
    const connection = this.cloud.firebase();
    if (connection === null) {
      return false;
    }
    const { auth, authSdk } = connection;
    try {
      await authSdk.signInWithPopup(
        auth,
        new authSdk.GoogleAuthProvider(),
        // Given here: Auth was set up without it, to keep Google's frame
        // off the game's start.
        authSdk.browserPopupRedirectResolver
      );
    } catch (error) {
      console.error('Could not sign in with Google', error);
      return false;
    }
    await this.check();
    return true;
  }

  public async signOut(): Promise<void> {
    const connection = this.cloud.firebase();
    if (connection !== null) {
      await connection.authSdk.signOut(connection.auth);
    }
    this.signedInAt.set(null);
    this.state.set('signed-out');
  }

  private settle(access: AdminAccess): AdminAccess {
    this.state.set(access);
    return access;
  }
}
