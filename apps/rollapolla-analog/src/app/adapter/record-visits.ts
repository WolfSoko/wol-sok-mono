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
import { tokenProfile } from './ensure-signed-in';

/** "Last seen" is precise to a day: one write per account and day at most. */
const RECORD_EVERY_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps `users/{uid}` up to date for every visitor signed in with Google, so
 * admins can list them: Firebase Auth cannot list users from the browser.
 * Anonymous visitors are not recorded.
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
        switchMap(async (account) => {
          const user = auth.currentUser;
          if (user?.uid !== account.uid || recentlyRecorded(account)) {
            return;
          }
          try {
            const { name, picture } = await tokenProfile(user);
            await setDoc(doc(fs, 'users', account.uid), {
              displayName: name,
              photoUrl: picture,
              lastSeenAt: serverTimestamp(),
            });
            remember(account);
          } catch (error) {
            // only the admin page misses it
            console.warn('Could not record the visit', error);
          }
        }),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe();
  });
}

/** The account as last recorded from this browser; a new name records again. */
function recordKey({ uid, displayName, photoUrl }: Account): string {
  return `rap-visit:${uid}:${displayName}:${photoUrl}`;
}

function recentlyRecorded(account: Account): boolean {
  try {
    const at = Number(localStorage.getItem(recordKey(account)));
    return Date.now() - at < RECORD_EVERY_MS;
  } catch {
    return false;
  }
}

function remember(account: Account): void {
  try {
    localStorage.setItem(recordKey(account), String(Date.now()));
  } catch {
    // storage blocked: recording again next time costs one write
  }
}
