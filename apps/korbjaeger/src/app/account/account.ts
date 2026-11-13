import { DestroyRef, DOCUMENT, inject, InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';
import { LocalSelection } from '@wolsok/feat-korbjaeger-selection';
import {
  deviceStorage,
  KeyValueStorage,
  StorageEventTarget,
  watchStored,
} from '@wolsok/utils-browser-storage';
import {
  SIGNED_IN_KEY,
  isFlagSet,
  setFlag,
  FREE_STORAGE,
  CLEAR_CACHE_KEY,
} from '../device-storage';
import type { AccountService } from './account-service';
import { AccountSession, type SignInFlag } from './account-session';

export { SIGNED_IN_KEY } from '../device-storage';

/**
 * Loads Firebase for the account: its own chunk, fetched only to sign in
 * or to open the account of an Elternteil signed in before.
 */
function loadAccountService(): Promise<AccountService> {
  return import('./firebase-account-service').then(
    ({ firebaseAccountService }) => firebaseAccountService(environment)
  );
}

/**
 * Remembers the sign-in in the device's storage, where it may; hears of
 * other tabs' through `browserWindow`'s `storage` event.
 */
export function deviceFlag(
  storage: KeyValueStorage | undefined,
  browserWindow?: StorageEventTarget
): SignInFlag {
  return {
    // blocked: the sign-in lasts for this visit, as Auth's session may
    isSet: () => isFlagSet(storage, SIGNED_IN_KEY),
    cleanUpPending: () => isFlagSet(storage, CLEAR_CACHE_KEY),
    set: () => setFlag(storage, SIGNED_IN_KEY, true),
    clear: () => setFlag(storage, SIGNED_IN_KEY, false),
    watch: (callback) => watchStored(SIGNED_IN_KEY, callback, browserWindow),
  };
}

/** The Elternteil's account, and with it the `Selection` the screens use (`SELECTION`). */
export const ACCOUNT_SESSION = new InjectionToken<AccountSession>(
  'KontoSitzung',
  {
    providedIn: 'root',
    factory: () => {
      const storage = deviceStorage();
      const browserWindow = inject(DOCUMENT).defaultView ?? undefined;
      const local = new LocalSelection(
        storage,
        browserWindow,
        inject(FREE_STORAGE)
      );
      inject(DestroyRef).onDestroy(() => local.stop());
      const session = new AccountSession(
        local,
        environment.signIn ? loadAccountService : undefined,
        deviceFlag(storage, browserWindow)
      );
      void session.start();
      return session;
    },
  }
);
