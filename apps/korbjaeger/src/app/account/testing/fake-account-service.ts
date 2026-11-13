import { signal } from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import {
  EMPTY_SELECTION,
  type SelectionContent,
  type NotTakenOver,
} from '@wolsok/feat-korbjaeger-selection';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';
import {
  SignInCancelled,
  AccountSwitched,
  type AccountUser,
  type AccountSelection,
  type AccountService,
} from '../account-service';
import type { SignInFlag } from '../account-session';

/** An invented account. */
export const MIMI_PARENT: AccountUser = {
  uid: 'uid-1',
  name: 'Familie Muster',
};

/**
 * A `AccountService` for specs: it logs its calls in order (`calls`) and has
 * switches for its faults; the account's selection is a `fakeSelection`, and
 * `authReports` plays Auth telling of another tab's sign-in or sign-out.
 */
export class FakeAccountService implements AccountService {
  public readonly calls: string[] = [];
  public restored: AccountUser | null = null;
  /** The popup is closed by the Elternteil. */
  public cancelled = false;
  /** The popup fails with this. */
  public popupError?: Error;
  public takeoverFails = false;
  public signOutFails = false;
  /** Holds the server's confirmation of the deleted document back until it resolves. */
  public deletionConfirmed?: Promise<void>;
  public leftOver: NotTakenOver = EMPTY_SELECTION;
  /** Opening an account's selection fails. */
  public selectionFails = false;
  /** Auth refuses to delete the account (an old sign-in). */
  public deleteAuthUserFails = false;
  /** Holds `clearCache` back until it resolves. */
  public cacheReady?: Promise<void>;
  /** Changes on the device not yet sent to the account (offline). */
  public notSent = false;
  /** Runs while the takeover runs, as an Elternteil changing the device meanwhile. */
  public duringTakeover?: () => Promise<void>;
  /** Runs during every takeover, not just the next. */
  public onEveryTakeover?: () => Promise<void>;
  /** Runs while a popup is open, as another tab acting meanwhile. */
  public duringPopup?: () => void;
  /** Holds `selection` back until it resolves. */
  public selectionReady?: Promise<void>;
  public takenOver?: SelectionContent;
  /** What the account's selection told of its failure (`selection`'s `onFailure`). */
  public readError?: (error: unknown) => void;
  /** The selection of `MIMI_PARENT`'s account; others get their own (`selectionOf`). */
  public readonly accountSelection: AccountSelection = this.newSelection();
  private readonly selections = new Map<string, AccountSelection>([
    [MIMI_PARENT.uid, this.accountSelection],
  ]);
  private readonly listeners: Array<(user: AccountUser | null) => void> = [];

  /** Auth's Elternteil changes, as when another tab signs in or out. */
  public authReports(user: AccountUser | null): void {
    this.restored = user;
    this.listeners.forEach((callback) => callback(user));
  }

  public async signedIn(): Promise<AccountUser | null> {
    this.calls.push('signedIn');
    return this.restored;
  }

  public currentUser(): AccountUser | null {
    return this.restored;
  }

  public watch(callback: (user: AccountUser | null) => void): () => void {
    this.listeners.push(callback);
    return () => undefined;
  }

  public async signInWithGoogle(): Promise<AccountUser> {
    this.calls.push('signInWithGoogle');
    this.checkPopup();
    this.restored = MIMI_PARENT;
    return MIMI_PARENT;
  }

  public async reauthenticate(): Promise<void> {
    this.calls.push('reauthenticate');
    this.checkPopup();
  }

  public async signOut(): Promise<void> {
    this.calls.push('signOut');
    if (this.signOutFails) {
      throw new Error('Auth unreachable');
    }
    this.restored = null;
  }

  public async deleteAuthUser(uid: string): Promise<void> {
    this.calls.push(`deleteAuthUser ${uid}`);
    if (this.deleteAuthUserFails) {
      throw new Error('auth/requires-recent-login');
    }
    if (this.restored?.uid !== uid) {
      throw new AccountSwitched();
    }
    this.restored = null;
  }

  /** The selection of the account `uid`, its own for each account. */
  public selectionOf(uid: string): AccountSelection {
    const selection = this.selections.get(uid) ?? this.newSelection();
    this.selections.set(uid, selection);
    return selection;
  }

  public async selection(
    uid: string,
    onFailure: (error: unknown) => void
  ): Promise<AccountSelection> {
    this.calls.push(`selection ${uid}`);
    await this.selectionReady;
    if (this.selectionFails) {
      throw new Error('unavailable');
    }
    this.readError = onFailure;
    return this.selectionOf(uid);
  }

  public async takeOverDevice(
    uid: string,
    device: SelectionContent
  ): Promise<NotTakenOver> {
    this.calls.push(`takeOverDevice ${uid}`);
    if (this.takeoverFails) {
      throw new Error('offline');
    }
    const during = this.duringTakeover;
    this.duringTakeover = undefined;
    await during?.();
    await this.onEveryTakeover?.();
    this.takenOver = device;
    return this.leftOver;
  }

  public async deleteSelection(uid: string): Promise<void> {
    this.calls.push(`deleteSelection ${uid}`);
    await this.deletionConfirmed;
  }

  public async allSent(): Promise<boolean> {
    this.calls.push('allSent');
    return !this.notSent;
  }

  public async clearCache(): Promise<void> {
    this.calls.push('clearCache');
    await this.cacheReady;
  }

  /** An account's selection: Teams followed stay; the rest as `fakeSelection`. */
  private newSelection(): AccountSelection {
    const teams = signal<readonly TeamId[]>([]);
    return {
      ...fakeSelection({
        teams,
        follow: async (team) => teams.update((all) => [...all, team]),
      }),
      unreadable: signal(false),
      loaded: () => Promise.resolve(),
      stop: () => this.calls.push('stop'),
    };
  }

  private checkPopup(): void {
    this.duringPopup?.();
    if (this.cancelled) {
      throw new SignInCancelled();
    }
    if (this.popupError) {
      throw this.popupError;
    }
  }
}

/** An `SignInFlag` in memory; `fromAnotherTab` plays another tab's change. */
export class FlagInSpec implements SignInFlag {
  private readonly listeners: Array<() => void> = [];
  /** A sign-out left Firestore's copy on the device to clear. */
  public cleanUp = false;

  public constructor(public signedIn = false) {}

  public cleanUpPending(): boolean {
    return this.cleanUp;
  }

  public isSet(): boolean {
    return this.signedIn;
  }
  public set(): void {
    this.signedIn = true;
  }
  public clear(): void {
    this.signedIn = false;
  }

  public watch(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => undefined;
  }

  public fromAnotherTab(signedIn: boolean): void {
    this.signedIn = signedIn;
    this.listeners.forEach((callback) => callback());
  }
}
