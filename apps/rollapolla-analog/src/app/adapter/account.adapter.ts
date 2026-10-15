import { isPlatformServer } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
  Auth,
  AuthError,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut,
  user,
  User,
} from '@angular/fire/auth';
import { map, merge, Observable, of, shareReplay, Subject } from 'rxjs';
import { Account } from '../../shared/account';
import { AccountPort, SignInCancelled } from '../ports/account.port';

const CANCELLED_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

@Injectable()
export class AccountAdapter extends AccountPort {
  private readonly auth: Auth = inject(Auth);
  /** Linking keeps the uid, so the auth listeners may not fire for it. */
  private readonly linked$ = new Subject<void>();

  public readonly account$: Observable<Account | null> = isPlatformServer(
    inject(PLATFORM_ID)
  )
    ? of(null)
    : merge(user(this.auth), this.linked$).pipe(
        map(() => toAccount(this.auth.currentUser)),
        // one auth listener for all consumers (header, chat)
        shareReplay({ bufferSize: 1, refCount: true })
      );

  public async signInWithGoogle(): Promise<void> {
    await this.auth.authStateReady();
    const provider = new GoogleAuthProvider();
    const current = this.auth.currentUser;
    try {
      if (current?.isAnonymous) {
        await this.linkOrSwitch(current, provider);
      } else {
        await signInWithPopup(this.auth, provider);
      }
    } catch (error) {
      if (CANCELLED_CODES.has((error as AuthError).code)) {
        throw new SignInCancelled();
      }
      throw error;
    }
    this.linked$.next();
  }

  public async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  private async linkOrSwitch(
    anonymous: User,
    provider: GoogleAuthProvider
  ): Promise<void> {
    try {
      await linkWithPopup(anonymous, provider);
    } catch (error) {
      const credential =
        (error as AuthError).code === 'auth/credential-already-in-use'
          ? GoogleAuthProvider.credentialFromError(error as AuthError)
          : null;
      if (!credential) {
        throw error;
      }
      // the Google account is already in use elsewhere: switch to it
      await signInWithCredential(this.auth, credential);
    }
  }
}

function toAccount(user: User | null): Account | null {
  if (!user) {
    return null;
  }
  const google = user.providerData.find(
    (profile) => profile.providerId === GoogleAuthProvider.PROVIDER_ID
  );
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    displayName: user.displayName ?? google?.displayName ?? null,
    photoUrl: user.photoURL ?? google?.photoURL ?? null,
  };
}
