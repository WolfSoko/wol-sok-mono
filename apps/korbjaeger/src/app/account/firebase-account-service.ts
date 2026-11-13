import { type FirebaseApp, initializeApp } from 'firebase/app';
import {
  type Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  deleteUser,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  deleteDoc,
  type Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  waitForPendingWrites,
} from 'firebase/firestore';
import type { Environment } from '../../environments/environment.type';
import {
  type SelectionContent,
  selectionDocumentOf,
  FirestoreSelection,
  takeOverDevice,
  type NotTakenOver,
} from '@wolsok/feat-korbjaeger-selection';
import { deviceStorage } from '@wolsok/utils-browser-storage';
import { isFlagSet, setFlag, CLEAR_CACHE_KEY } from '../device-storage';
import {
  SignInCancelled,
  AccountSwitched,
  PopupBlocked,
  type AccountUser,
  type AccountSelection,
  type AccountService,
} from './account-service';
import { errorCode } from './error-code';
import { withTimeout } from './timeout';

/** Auth's codes for a popup the Elternteil closed or a second one superseded. */
const CANCELLED = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

/** The Firebase app's name: the app's own, apart from any default one. */
const APP_NAME = 'korbjaeger';

export { CLEAR_CACHE_KEY } from '../device-storage';

/** How long signing out waits for the device's changes to be sent. */
const SEND_WAIT_MS = 5000;

/** The `AccountService` on Firebase, for `environment` (its project or emulators). */
export function firebaseAccountService(
  environment: Environment
): AccountService {
  return new FirebaseAccountService(environment);
}

/**
 * Firebase Auth (Google's popup, the session kept on the device) and
 * Firestore with its cache on the device, so the account's choices show
 * offline too. Firestore is started anew after each sign-out, whose
 * `terminate` ends it. Auth's popup machinery is set up when this is built
 * (on Safari and mobile Firebase does so at once), so a click opens the
 * popup without waiting.
 */
class FirebaseAccountService implements AccountService {
  private readonly app: FirebaseApp;
  private readonly auth: Auth;
  private firestore?: Promise<Firestore>;

  public constructor(private readonly environment: Environment) {
    const { emulators } = environment;
    this.app = initializeApp(
      emulators
        ? { ...environment.firebase, projectId: emulators.projectId }
        : environment.firebase,
      APP_NAME
    );
    this.auth = initializeAuth(this.app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    if (emulators) {
      connectAuthEmulator(this.auth, emulators.authUrl, {
        disableWarnings: true,
      });
    }
  }

  public async signedIn(): Promise<AccountUser | null> {
    await this.auth.authStateReady();
    return userOf(this.auth.currentUser);
  }

  public currentUser(): AccountUser | null {
    return userOf(this.auth.currentUser);
  }

  public watch(callback: (user: AccountUser | null) => void): () => void {
    return onAuthStateChanged(this.auth, (user) => callback(userOf(user)));
  }

  public async signInWithGoogle(): Promise<AccountUser> {
    const { user } = await withPopup(() =>
      signInWithPopup(this.auth, new GoogleAuthProvider())
    );
    return userOf(user) as AccountUser;
  }

  public async reauthenticate(): Promise<void> {
    const user = this.signedInUser();
    await withPopup(() =>
      reauthenticateWithPopup(user, new GoogleAuthProvider())
    );
  }

  public signOut(): Promise<void> {
    return signOut(this.auth);
  }

  public deleteAuthUser(uid: string): Promise<void> {
    const user = this.signedInUser();
    return user.uid === uid
      ? deleteUser(user)
      : Promise.reject(new AccountSwitched());
  }

  public async selection(
    uid: string,
    onFailure: (error: unknown) => void
  ): Promise<AccountSelection> {
    // the cache shows the account at once, offline too
    return new FirestoreSelection(await this.db(), uid, { onError: onFailure });
  }

  public async takeOverDevice(
    uid: string,
    device: SelectionContent
  ): Promise<NotTakenOver> {
    return takeOverDevice(await this.db(), uid, device);
  }

  /**
   * Resolves once the server confirmed the deletion of the account's
   * document, however long that takes: once queued, Firestore deletes it
   * even where this gave up, so giving up would leave the account without
   * its choices.
   */
  public async deleteSelection(uid: string): Promise<void> {
    await deleteDoc(selectionDocumentOf(await this.db(), uid));
  }

  public async allSent(): Promise<boolean> {
    if (this.firestore === undefined) {
      return true;
    }
    const firestore = await this.firestore;
    return withTimeout(
      waitForPendingWrites(firestore).then(() => true),
      SEND_WAIT_MS,
      () => false
    );
  }

  public async clearCache(): Promise<void> {
    try {
      // a Firestore that never started still clears what an earlier visit kept
      const firestore = await this.db();
      this.firestore = undefined;
      await terminate(firestore);
      await this.clearStorage(firestore);
    } catch (error) {
      // the next start clears it before reading
      console.warn('Korbjäger: Firestore cache not cleared', error);
      setClearPending(true);
    }
  }

  private db(): Promise<Firestore> {
    this.firestore ??= this.startFirestore();
    return this.firestore;
  }

  /** Starts Firestore, first clearing what a sign-out could not. */
  private async startFirestore(): Promise<Firestore> {
    if (clearPending()) {
      const old = this.newFirestore();
      await this.clearStorage(old);
      await terminate(old);
    }
    return this.newFirestore();
  }

  /**
   * Clears Firestore's copy on the device; where another tab holds it,
   * leaves that for the next start (`CLEAR_CACHE_KEY`).
   */
  private async clearStorage(firestore: Firestore): Promise<void> {
    try {
      await clearIndexedDbPersistence(firestore);
      setClearPending(false);
    } catch {
      setClearPending(true);
    }
  }

  private newFirestore(): Firestore {
    const firestore = initializeFirestore(this.app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    const { emulators } = this.environment;
    if (emulators) {
      connectFirestoreEmulator(
        firestore,
        emulators.firestore.host,
        emulators.firestore.port
      );
    }
    return firestore;
  }

  private signedInUser(): User {
    const user = this.auth.currentUser;
    if (user === null) {
      throw new Error('Niemand ist angemeldet.');
    }
    return user;
  }
}

/**
 * Runs a popup of Auth: a closed one rejects with `SignInCancelled`,
 * one the browser refused with `PopupBlocked`.
 */
async function withPopup<T>(popup: () => Promise<T>): Promise<T> {
  try {
    return await popup();
  } catch (error) {
    const code = errorCode(error) ?? '';
    if (CANCELLED.has(code)) {
      throw new SignInCancelled();
    }
    throw code === 'auth/popup-blocked' ? new PopupBlocked() : error;
  }
}

/** Whether a sign-out left Firestore's copy on the device to clear. */
function clearPending(): boolean {
  return isFlagSet(deviceStorage(), CLEAR_CACHE_KEY);
}

/** Marks the copy as left to clear, or cleared; blocked: the next sign-out tries again. */
function setClearPending(isPending: boolean): void {
  setFlag(deviceStorage(), CLEAR_CACHE_KEY, isPending);
}

function userOf(user: User | null): AccountUser | null {
  return user && { uid: user.uid, name: user.displayName };
}
