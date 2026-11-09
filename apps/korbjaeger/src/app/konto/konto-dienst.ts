import type { Auswahl } from '../auswahl/auswahl';
import type { AuswahlInhalt } from '../auswahl/auswahl-dokument';
import type { NichtUebernommen } from '../auswahl/zusammenfuehren';

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
 * to sign in, or for an Elternteil signed in before.
 */
export interface KontoDienst {
  /** The Elternteil Auth restored from the device, or `null`. */
  angemeldet(): Promise<Benutzer | null>;
  /**
   * Calls `rueckruf` with the Elternteil whenever Auth's changes, also by
   * another tab of the app; returns how to stop.
   */
  beobachten(rueckruf: (benutzer: Benutzer | null) => void): () => void;
  /**
   * Signs in with Google's popup, which the browser opens only in the
   * click: call it without waiting for anything before. Rejects with
   * `AnmeldungAbgebrochen` when it was closed, `PopupBlockiert` when the
   * browser refused it.
   */
  mitGoogleAnmelden(): Promise<Benutzer>;
  /** Asks Google again, as Auth wants before a deletion; as above. */
  erneutAnmelden(): Promise<void>;
  abmelden(): Promise<void>;
  /** Deletes the account, which Auth allows shortly after a sign-in. */
  benutzerLoeschen(): Promise<void>;
  /**
   * The account's selection, its document `auswahl/{uid}`; `beiFehler`
   * hears where it cannot be read.
   */
  auswahl(
    uid: string,
    beiFehler: (fehler: unknown) => void
  ): Promise<KontoAuswahl>;
  /** Joins the device's choices into the account (`geraetUebernehmen`). */
  geraetUebernehmen(
    uid: string,
    geraet: AuswahlInhalt
  ): Promise<NichtUebernommen>;
  /**
   * Deletes the account's document, resolving once the server confirmed
   * it; rejects with `OhneInternet` where it does not in time.
   */
  auswahlLoeschen(uid: string): Promise<void>;
  /**
   * Stops Firestore and clears its copy of the account's data on the
   * device. Never rejects: where another tab still holds that copy, it is
   * cleared when the app opens next.
   */
  zwischenspeicherLeeren(): Promise<void>;
}

/** The Elternteil closed Google's popup: no error to show while signing in. */
export class AnmeldungAbgebrochen extends Error {
  public constructor() {
    super('Anmeldung abgebrochen');
    this.name = 'AnmeldungAbgebrochen';
  }
}

/** The browser refused to open Google's popup. */
export class PopupBlockiert extends Error {
  public constructor() {
    super('Popup blockiert');
    this.name = 'PopupBlockiert';
  }
}

/** A step the server must confirm (deleting the account) found no network. */
export class OhneInternet extends Error {
  public constructor() {
    super('Ohne Internet');
    this.name = 'OhneInternet';
  }
}
