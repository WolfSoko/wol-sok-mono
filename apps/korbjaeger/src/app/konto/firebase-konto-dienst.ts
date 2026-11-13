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
  AnmeldungAbgebrochen,
  KontoGewechselt,
  PopupBlockiert,
  type Benutzer,
  type KontoAuswahl,
  type KontoDienst,
} from './konto-dienst';
import { fehlerCode } from './fehler-code';
import { mitZeitlimit } from './zeitlimit';

/** Auth's codes for a popup the Elternteil closed or a second one superseded. */
const ABGEBROCHEN = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

/** The Firebase app's name: the app's own, apart from any default one. */
const APP_NAME = 'korbjaeger';

export { CLEAR_CACHE_KEY } from '../device-storage';

/** How long signing out waits for the device's changes to be sent. */
const SENDEN_WARTEN_MS = 5000;

/** The `KontoDienst` on Firebase, for `environment` (its project or emulators). */
export function firebaseKontoDienst(environment: Environment): KontoDienst {
  return new FirebaseKontoDienst(environment);
}

/**
 * Firebase Auth (Google's popup, the session kept on the device) and
 * Firestore with its cache on the device, so the account's choices show
 * offline too. Firestore is started anew after each sign-out, whose
 * `terminate` ends it. Auth's popup machinery is set up when this is built
 * (on Safari and mobile Firebase does so at once), so a click opens the
 * popup without waiting.
 */
class FirebaseKontoDienst implements KontoDienst {
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

  public async angemeldet(): Promise<Benutzer | null> {
    await this.auth.authStateReady();
    return benutzerAus(this.auth.currentUser);
  }

  public jetzt(): Benutzer | null {
    return benutzerAus(this.auth.currentUser);
  }

  public beobachten(rueckruf: (benutzer: Benutzer | null) => void): () => void {
    return onAuthStateChanged(this.auth, (user) => rueckruf(benutzerAus(user)));
  }

  public async mitGoogleAnmelden(): Promise<Benutzer> {
    const { user } = await mitPopup(() =>
      signInWithPopup(this.auth, new GoogleAuthProvider())
    );
    return benutzerAus(user) as Benutzer;
  }

  public async erneutAnmelden(): Promise<void> {
    const user = this.angemeldeterBenutzer();
    await mitPopup(() =>
      reauthenticateWithPopup(user, new GoogleAuthProvider())
    );
  }

  public abmelden(): Promise<void> {
    return signOut(this.auth);
  }

  public benutzerLoeschen(uid: string): Promise<void> {
    const user = this.angemeldeterBenutzer();
    return user.uid === uid
      ? deleteUser(user)
      : Promise.reject(new KontoGewechselt());
  }

  public async auswahl(
    uid: string,
    beiFehler: (fehler: unknown) => void
  ): Promise<KontoAuswahl> {
    // the cache shows the account at once, offline too
    return new FirestoreSelection(await this.db(), uid, { onError: beiFehler });
  }

  public async geraetUebernehmen(
    uid: string,
    geraet: SelectionContent
  ): Promise<NotTakenOver> {
    return takeOverDevice(await this.db(), uid, geraet);
  }

  /**
   * Resolves once the server confirmed the deletion of the account's
   * document, however long that takes: once queued, Firestore deletes it
   * even where this gave up, so giving up would leave the account without
   * its choices.
   */
  public async auswahlLoeschen(uid: string): Promise<void> {
    await deleteDoc(selectionDocumentOf(await this.db(), uid));
  }

  public async allesGesendet(): Promise<boolean> {
    if (this.firestore === undefined) {
      return true;
    }
    const firestore = await this.firestore;
    return mitZeitlimit(
      waitForPendingWrites(firestore).then(() => true),
      SENDEN_WARTEN_MS,
      () => false
    );
  }

  public async zwischenspeicherLeeren(): Promise<void> {
    try {
      // a Firestore that never started still clears what an earlier visit kept
      const firestore = await this.db();
      this.firestore = undefined;
      await terminate(firestore);
      await this.speicherLeeren(firestore);
    } catch (fehler) {
      // the next start clears it before reading
      console.warn('Korbjäger: Firestore cache not cleared', fehler);
      leerenAusstehendSetzen(true);
    }
  }

  private db(): Promise<Firestore> {
    this.firestore ??= this.firestoreStarten();
    return this.firestore;
  }

  /** Starts Firestore, first clearing what a sign-out could not. */
  private async firestoreStarten(): Promise<Firestore> {
    if (leerenAusstehend()) {
      const alt = this.neuesFirestore();
      await this.speicherLeeren(alt);
      await terminate(alt);
    }
    return this.neuesFirestore();
  }

  /**
   * Clears Firestore's copy on the device; where another tab holds it,
   * leaves that for the next start (`CLEAR_CACHE_KEY`).
   */
  private async speicherLeeren(firestore: Firestore): Promise<void> {
    try {
      await clearIndexedDbPersistence(firestore);
      leerenAusstehendSetzen(false);
    } catch {
      leerenAusstehendSetzen(true);
    }
  }

  private neuesFirestore(): Firestore {
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

  private angemeldeterBenutzer(): User {
    const user = this.auth.currentUser;
    if (user === null) {
      throw new Error('Niemand ist angemeldet.');
    }
    return user;
  }
}

/**
 * Runs a popup of Auth: a closed one rejects with `AnmeldungAbgebrochen`,
 * one the browser refused with `PopupBlockiert`.
 */
async function mitPopup<T>(popup: () => Promise<T>): Promise<T> {
  try {
    return await popup();
  } catch (fehler) {
    const code = fehlerCode(fehler) ?? '';
    if (ABGEBROCHEN.has(code)) {
      throw new AnmeldungAbgebrochen();
    }
    throw code === 'auth/popup-blocked' ? new PopupBlockiert() : fehler;
  }
}

/** Whether a sign-out left Firestore's copy on the device to clear. */
function leerenAusstehend(): boolean {
  return isFlagSet(deviceStorage(), CLEAR_CACHE_KEY);
}

/** Marks the copy as left to clear, or cleared; blocked: the next sign-out tries again. */
function leerenAusstehendSetzen(offen: boolean): void {
  setFlag(deviceStorage(), CLEAR_CACHE_KEY, offen);
}

function benutzerAus(user: User | null): Benutzer | null {
  return user && { uid: user.uid, name: user.displayName };
}
