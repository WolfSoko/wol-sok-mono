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
} from 'firebase/firestore';
import type { Environment } from '../../environments/environment.type';
import type { AuswahlInhalt } from '../auswahl/auswahl-dokument';
import {
  auswahlDokumentVon,
  FirestoreAuswahl,
} from '../auswahl/firestore-auswahl';
import { geraetUebernehmen } from '../auswahl/geraet-uebernehmen';
import {
  AnmeldungAbgebrochen,
  ErneuteAnmeldungNoetig,
  type Benutzer,
  type KontoAuswahl,
  type KontoDienst,
} from './konto-dienst';

/** Auth's codes for a popup the Elternteil closed or a second one superseded. */
const ABGEBROCHEN = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

/** The Firebase app's name: the app's own, apart from any default one. */
const APP_NAME = 'korbjaeger';

/** The `KontoDienst` on Firebase, for `environment` (its project or emulators). */
export function firebaseKontoDienst(environment: Environment): KontoDienst {
  return new FirebaseKontoDienst(environment);
}

/**
 * Firebase Auth (Google's popup, the session kept on the device) and
 * Firestore with its cache on the device, so the account's choices show
 * offline too. Firestore is started anew after each sign-out, whose
 * `terminate` ends it.
 */
class FirebaseKontoDienst implements KontoDienst {
  private readonly app: FirebaseApp;
  private readonly auth: Auth;
  private firestore?: Firestore;

  public constructor(private readonly environment: Environment) {
    const { emulatoren } = environment;
    this.app = initializeApp(
      emulatoren
        ? { ...environment.firebase, projectId: emulatoren.projektId }
        : environment.firebase,
      APP_NAME
    );
    this.auth = initializeAuth(this.app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    if (emulatoren) {
      connectAuthEmulator(this.auth, emulatoren.authUrl, {
        disableWarnings: true,
      });
    }
  }

  public async angemeldet(): Promise<Benutzer | null> {
    await this.auth.authStateReady();
    return benutzerAus(this.auth.currentUser);
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

  public async benutzerLoeschen(): Promise<void> {
    try {
      await deleteUser(this.angemeldeterBenutzer());
    } catch (fehler) {
      if (codeVon(fehler) === 'auth/requires-recent-login') {
        throw new ErneuteAnmeldungNoetig();
      }
      throw fehler;
    }
  }

  public auswahl(uid: string): KontoAuswahl {
    return new FirestoreAuswahl(this.db(), uid);
  }

  public geraetUebernehmen(uid: string, geraet: AuswahlInhalt): Promise<void> {
    return geraetUebernehmen(this.db(), uid, geraet);
  }

  public auswahlLoeschen(uid: string): Promise<void> {
    return deleteDoc(auswahlDokumentVon(this.db(), uid));
  }

  public async zwischenspeicherLeeren(): Promise<void> {
    // a Firestore that never started still clears what an earlier visit kept
    const firestore = this.db();
    this.firestore = undefined;
    await terminate(firestore);
    await clearIndexedDbPersistence(firestore);
  }

  private db(): Firestore {
    this.firestore ??= this.firestoreStarten();
    return this.firestore;
  }

  private firestoreStarten(): Firestore {
    const firestore = initializeFirestore(this.app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    const { emulatoren } = this.environment;
    if (emulatoren) {
      connectFirestoreEmulator(
        firestore,
        emulatoren.firestore.host,
        emulatoren.firestore.port
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

/** Runs a popup of Auth; a closed one rejects with `AnmeldungAbgebrochen`. */
async function mitPopup<T>(popup: () => Promise<T>): Promise<T> {
  try {
    return await popup();
  } catch (fehler) {
    throw ABGEBROCHEN.has(codeVon(fehler) ?? '')
      ? new AnmeldungAbgebrochen()
      : fehler;
  }
}

function codeVon(fehler: unknown): string | undefined {
  return typeof fehler === 'object' && fehler !== null && 'code' in fehler
    ? String(fehler.code)
    : undefined;
}

function benutzerAus(user: User | null): Benutzer | null {
  return user && { uid: user.uid, name: user.displayName };
}
