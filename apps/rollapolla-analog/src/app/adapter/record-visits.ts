import { isPlatformServer } from '@angular/common';
import {
  DestroyRef,
  EnvironmentProviders,
  inject,
  PLATFORM_ID,
  provideEnvironmentInitializer,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth } from '@angular/fire/auth';
import {
  doc,
  Firestore,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { distinctUntilChanged, filter, switchMap } from 'rxjs';
import { Account, isGoogleAccount } from '../../shared/account';
import { AccountPort } from '../ports/account.port';

/**
 * Keeps `users/{uid}` up to date for every visitor signed in with Google, so
 * admins can list them: Firebase Auth cannot list users from the browser.
 * Anonymous visitors are not recorded. Writes once per account and session.
 */
export function provideVisitRecording(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    if (isPlatformServer(inject(PLATFORM_ID))) {
      return;
    }
    const fs = inject(Firestore);
    const auth = inject(Auth);
    inject(AccountPort)
      .account$.pipe(
        filter((account): account is Account => isGoogleAccount(account)),
        distinctUntilChanged(
          (a, b) =>
            a.uid === b.uid &&
            a.displayName === b.displayName &&
            a.photoUrl === b.photoUrl
        ),
        // the rules compare name and photo with the token's, which can lag
        // behind the profile, so they come from there
        switchMap(async ({ uid }) => {
          const user = auth.currentUser;
          try {
            return user?.uid === uid
              ? { uid, claims: (await user.getIdTokenResult()).claims }
              : null;
          } catch (error) {
            console.warn('Could not record the visit', error);
            return null;
          }
        }),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe((visit) => {
        if (!visit) {
          return;
        }
        const { uid, claims } = visit;
        setDoc(doc(fs, 'users', uid), {
          displayName:
            typeof claims['name'] === 'string' ? claims['name'] : null,
          photoUrl:
            typeof claims['picture'] === 'string' ? claims['picture'] : null,
          lastSeenAt: serverTimestamp(),
        }).catch((error) =>
          // only the admin page misses it
          console.warn('Could not record the visit', error)
        );
      });
  });
}
