import type {
  Selection,
  SelectionContent,
  NotTakenOver,
} from '@wolsok/feat-korbjaeger-selection';

/** The signed-in Elternteil, as Firebase Auth tells: kept in memory only. */
export interface AccountUser {
  readonly uid: string;
  /** The name of the Google account, where it gives one. */
  readonly name: string | null;
}

/** An account's `Selection` (`FirestoreSelection`), open until `stop`. */
export interface AccountSelection extends Selection {
  /** Resolves once the account's selection was read the first time. */
  loaded(): Promise<void>;
  stop(): void;
}

/**
 * What the account needs of Firebase (Auth with Google, Firestore), behind
 * a port: `FirebaseAccountService` (`firebase-account-service.ts`) is loaded only
 * to sign in, or for an Elternteil signed in before.
 */
export interface AccountService {
  /** The Elternteil Auth restored from the device, or `null`. */
  signedIn(): Promise<AccountUser | null>;
  /** The Elternteil Auth holds now, in this tab; `null` for none. */
  currentUser(): AccountUser | null;
  /**
   * Calls `callback` with the Elternteil whenever Auth's changes, also by
   * another tab of the app; returns how to stop.
   */
  watch(callback: (user: AccountUser | null) => void): () => void;
  /**
   * Signs in with Google's popup, which the browser opens only in the
   * click: call it without waiting for anything before. Rejects with
   * `SignInCancelledError` when it was closed, `PopupBlockedError` when the
   * browser refused it.
   */
  signInWithGoogle(): Promise<AccountUser>;
  /** Asks Google again, as Auth wants before a deletion; as above. */
  reauthenticate(): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Deletes the account `uid`, which Auth allows shortly after a sign-in;
   * rejects with `AccountSwitchedError` where Auth's Elternteil is another now.
   */
  deleteAuthUser(uid: string): Promise<void>;
  /**
   * The account's selection, its document `selections/{uid}`; `onFailure`
   * hears where it cannot be read.
   */
  selection(
    uid: string,
    onFailure: (error: unknown) => void
  ): Promise<AccountSelection>;
  /**
   * Joins the device's choices into the account (`takeOverDevice`);
   * resolves with those that did not fit under the caps.
   */
  takeOverDevice(uid: string, device: SelectionContent): Promise<NotTakenOver>;
  /**
   * Deletes the account's document, resolving once the server confirmed
   * it, however long that takes: once queued, the deletion runs anyway.
   */
  deleteAccountSelection(uid: string): Promise<void>;
  /**
   * Whether every change made on the device reached the account: waits a
   * few seconds for Firestore to send them, false where it could not.
   */
  allSent(): Promise<boolean>;
  /**
   * Stops Firestore and clears its copy of the account's data on the
   * device. Never rejects: where another tab still holds that copy, it is
   * cleared when the app opens next.
   */
  clearCache(): Promise<void>;
}

/** The Elternteil closed Google's popup: no error to show while signing in. */
export class SignInCancelledError extends Error {
  public constructor() {
    super('Sign-in cancelled');
    this.name = 'SignInCancelledError';
  }
}

/** The browser refused to open Google's popup. */
export class PopupBlockedError extends Error {
  public constructor() {
    super('Popup blocked');
    this.name = 'PopupBlockedError';
  }
}

/** Signing out would discard changes not yet sent to the account. */
export class NotAllSentError extends Error {
  public constructor() {
    super('Not all sent');
    this.name = 'NotAllSentError';
  }
}

/** Auth's Elternteil changed while the account was being deleted: nothing more is. */
export class AccountSwitchedError extends Error {
  public constructor() {
    super('Account switched');
    this.name = 'AccountSwitchedError';
  }
}

/**
 * The account's document is deleted, the account itself is not (Auth
 * refused, as the question to Google lay too long back): deleting again
 * finishes it.
 */
export class AccountNotDeletedError extends Error {
  public constructor(public readonly reason: unknown) {
    super('Account not deleted');
    this.name = 'AccountNotDeletedError';
  }
}

/** A step the server must confirm (deleting the account) found no network. */
export class NoInternetToDeleteError extends Error {
  public constructor() {
    super('Offline');
    this.name = 'NoInternetToDeleteError';
  }
}
