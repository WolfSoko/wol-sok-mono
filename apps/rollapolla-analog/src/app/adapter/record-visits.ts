import { isPlatformServer } from '@angular/common';
import {
  DestroyRef,
  EnvironmentProviders,
  inject,
  PLATFORM_ID,
  provideEnvironmentInitializer,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  doc,
  Firestore,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { distinctUntilChanged, filter } from 'rxjs';
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
    inject(AccountPort)
      .account$.pipe(
        filter((account): account is Account => isGoogleAccount(account)),
        distinctUntilChanged(
          (a, b) =>
            a.uid === b.uid &&
            a.displayName === b.displayName &&
            a.photoUrl === b.photoUrl
        ),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe(({ uid, displayName, photoUrl }) => {
        setDoc(doc(fs, 'users', uid), {
          displayName,
          photoUrl,
          lastSeenAt: serverTimestamp(),
        }).catch((error) =>
          // only the admin page misses it
          console.warn('Could not record the visit', error)
        );
      });
  });
}
