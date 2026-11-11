import type {
  Selection,
  SelectionContent,
  NotTakenOver,
} from '@wolsok/feat-korbjaeger-selection';

/** The signed-in Elternteil, as Firebase Auth tells: kept in memory only. */
export interface Benutzer {
  readonly uid: string;
  /** The name of the Google account, where it gives one. */
  readonly name: string | null;
}

/** An account's `Selection` (`FirestoreSelection`), open until `stop`. */
export interface KontoAuswahl extends Selection {
  /** Resolves once the account's selection was read the first time. */
  loaded(): Promise<void>;
  stop(): void;
}

/**
 * What the account needs of Firebase (Auth with Google, Firestore), behind
 * a port: `FirebaseKontoDienst` (`firebase-konto-dienst.ts`) is loaded only
 * to sign in, or for an Elternteil signed in before.
 */
export interface KontoDienst {
  /** The Elternteil Auth restored from the device, or `null`. */
  angemeldet(): Promise<Benutzer | null>;
  /** The Elternteil Auth holds now, in this tab; `null` for none. */
  jetzt(): Benutzer | null;
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
  /**
   * Deletes the account `uid`, which Auth allows shortly after a sign-in;
   * rejects with `KontoGewechselt` where Auth's Elternteil is another now.
   */
  benutzerLoeschen(uid: string): Promise<void>;
  /**
   * The account's selection, its document `auswahl/{uid}`; `beiFehler`
   * hears where it cannot be read.
   */
  auswahl(
    uid: string,
    beiFehler: (fehler: unknown) => void
  ): Promise<KontoAuswahl>;
  /**
   * Joins the device's choices into the account (`geraetUebernehmen`);
   * resolves with those that did not fit under the caps.
   */
  geraetUebernehmen(
    uid: string,
    geraet: SelectionContent
  ): Promise<NotTakenOver>;
  /**
   * Deletes the account's document, resolving once the server confirmed
   * it, however long that takes: once queued, the deletion runs anyway.
   */
  auswahlLoeschen(uid: string): Promise<void>;
  /**
   * Whether every change made on the device reached the account: waits a
   * few seconds for Firestore to send them, false where it could not.
   */
  allesGesendet(): Promise<boolean>;
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

/** Signing out would discard changes not yet sent to the account. */
export class NichtAllesGesendet extends Error {
  public constructor() {
    super('Nicht alles gesendet');
    this.name = 'NichtAllesGesendet';
  }
}

/** Auth's Elternteil changed while the account was being deleted: nothing more is. */
export class KontoGewechselt extends Error {
  public constructor() {
    super('Konto gewechselt');
    this.name = 'KontoGewechselt';
  }
}

/**
 * The account's document is deleted, the account itself is not (Auth
 * refused, as the question to Google lay too long back): deleting again
 * finishes it.
 */
export class KontoNichtGeloescht extends Error {
  public constructor(public readonly grund: unknown) {
    super('Konto nicht gelöscht');
    this.name = 'KontoNichtGeloescht';
  }
}

/** A step the server must confirm (deleting the account) found no network. */
export class OhneInternet extends Error {
  public constructor() {
    super('Ohne Internet');
    this.name = 'OhneInternet';
  }
}
