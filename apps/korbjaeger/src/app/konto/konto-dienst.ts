import type { Auswahl } from '../auswahl/auswahl';
import type { AuswahlInhalt } from '../auswahl/auswahl-dokument';

/** The signed-in Elternteil, as Firebase Auth tells: kept in memory only. */
export interface Benutzer {
  readonly uid: string;
  /** The name of the Google account, where it gives one. */
  readonly name: string | null;
}

/** An account's `Auswahl` (`FirestoreAuswahl`), open until `beenden`. */
export interface KontoAuswahl extends Auswahl {
  /** Resolves once the account's selection was read the first time. */
  geladen(): Promise<void>;
  beenden(): void;
}

/**
 * What the account needs of Firebase (Auth with Google, Firestore), behind
 * a port: `FirebaseKontoDienst` (`firebase-konto-dienst.ts`) is loaded only
 * once an Elternteil signs in, or was signed in before.
 */
export interface KontoDienst {
  /** The Elternteil Auth restored from the device, or `null`. */
  angemeldet(): Promise<Benutzer | null>;
  /** Signs in with Google's popup; `AnmeldungAbgebrochen` when closed. */
  mitGoogleAnmelden(): Promise<Benutzer>;
  /** Asks Google again, as Auth wants before a deletion; as above. */
  erneutAnmelden(): Promise<void>;
  abmelden(): Promise<void>;
  /** Deletes the account; `ErneuteAnmeldungNoetig` when Auth wants a fresh sign-in first. */
  benutzerLoeschen(): Promise<void>;
  /** The account's selection, its document `auswahl/{uid}`. */
  auswahl(uid: string): KontoAuswahl;
  /** Joins the device's choices into the account (`geraetUebernehmen`). */
  geraetUebernehmen(uid: string, geraet: AuswahlInhalt): Promise<void>;
  /** Deletes the account's document. */
  auswahlLoeschen(uid: string): Promise<void>;
  /** Stops Firestore and clears its copy of the account's data on the device. */
  zwischenspeicherLeeren(): Promise<void>;
}

/** The Elternteil closed Google's popup: no error to show. */
export class AnmeldungAbgebrochen extends Error {
  public constructor() {
    super('Anmeldung abgebrochen');
    this.name = 'AnmeldungAbgebrochen';
  }
}

/** Auth deletes an account only shortly after a sign-in. */
export class ErneuteAnmeldungNoetig extends Error {
  public constructor() {
    super('Erneute Anmeldung nötig');
    this.name = 'ErneuteAnmeldungNoetig';
  }
}
