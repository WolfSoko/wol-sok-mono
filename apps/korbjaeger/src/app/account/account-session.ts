import { computed, signal, type Signal } from '@angular/core';
import type {
  PersonId,
  TeamId,
  ClubId,
} from '@wolsok/feat-shared-basketball-data';
import {
  type ClubColors,
  type ClubColorsChoice,
  type Selection,
  type TeamPlace,
  EMPTY_SELECTION,
  selectionIsEmpty,
  selectionWithout,
  selectionJoined,
  listSignals,
  type Child,
  type MarkablePlayer,
  type LocalSelection,
  type NotTakenOver,
} from '@wolsok/feat-korbjaeger-selection';
import {
  AccountSwitched,
  AccountNotDeleted,
  NotAllSent,
  Offline,
  type AccountUser,
  type AccountSelection,
  type AccountService,
} from './account-service';
import { errorCode } from './error-code';

/**
 * Where the account stands, for the settings:
 * - `off`: this build offers no sign-in (`environment.signIn`).
 * - `signed-out`: Meine Teams and Kinder are on the device.
 * - `loading`: the account of an Elternteil signed in before is opening.
 * - `signed-in`: they are the account's, `name` from Google, in memory.
 * - `unreachable`: the account could not be opened or read.
 */
export type AccountState =
  | { readonly kind: 'off' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed-in'; readonly name: string | null }
  | { readonly kind: 'unreachable' };

/** A step of the session; one runs at a time (`running`). */
export type Step = 'sign-in' | 'sign-out' | 'delete' | 'take-over';

/** The last step that failed, and how, for whichever page shows it. */
export interface Failure {
  readonly kind: Step;
  readonly error: unknown;
}

/** What the last takeover into the account shown left on the device. */
export interface TakeoverHint {
  /** The device's Teams and Kinder that did not fit; they stay on it. */
  readonly leftOver: NotTakenOver;
  /**
   * Whether other choices of the device are not in the account yet: they
   * changed while it took them over, or it failed at a start. The next
   * start takes them over.
   */
  readonly kept: boolean;
}

const NOTHING: NotTakenOver = EMPTY_SELECTION;

/** Remembers on the device that an Elternteil is signed in. */
export interface SignInFlag {
  isSet(): boolean;
  set(): void;
  clear(): void;
  /** Whether a sign-out left Firestore's copy on the device to clear. */
  cleanUpPending(): boolean;
  /** Calls `callback` when another tab sets or clears it; returns how to stop. */
  watch(callback: () => void): () => void;
}

/** Firestore's code for a read the rules refuse: the account is gone here. */
const PERMISSION_DENIED = 'permission-denied';

/**
 * How often a sign-in takes the device's choices over again where they
 * changed while it did (the Elternteil, another tab).
 */
const MAX_TAKEOVERS = 3;

/**
 * The account of an Elternteil and the `Selection` that goes with it: the
 * device's (`LocalSelection`) signed out, the account's (`AccountSelection`)
 * signed in. Firebase is loaded (`load`) only to sign in (`prepare`,
 * once the settings open) or to open the account of an Elternteil signed
 * in before (`flag`), so a visitor without an account never contacts
 * Google. Every tab follows a sign-in or sign-out in another: through
 * Auth's state once Firebase is loaded, through the `flag` before.
 *
 * The device's choices leave it in one place only: a takeover into the
 * account, which takes off exactly what it wrote (`takeOver`), so what
 * joined meanwhile, in any tab, stays. Nothing else clears them, a sign-out neither (here or in
 * another tab, after a takeover that failed too), so choices a takeover
 * kept stay for the next.
 */
export class AccountSession {
  public readonly state: Signal<AccountState>;
  /** The screens' `Selection`: whichever holds Meine Teams and Kinder now. */
  public readonly selection: Selection;
  /**
   * Whether Firebase is loaded, so a click opens Google's popup at once:
   * the settings offer the sign-in only then.
   */
  public readonly ready: Signal<boolean>;
  /** What the last takeover into the account shown left on the device. */
  public readonly takeoverHint: Signal<TakeoverHint | undefined>;
  /** The step running in this tab, for whichever page shows it. */
  public readonly running: Signal<Step | undefined>;
  /** The last step that failed; cleared as the next starts. */
  public readonly failure: Signal<Failure | undefined>;

  private readonly currentState = signal<AccountState>({ kind: 'off' });
  private readonly loaded = signal(false);
  private readonly current = signal<Selection | undefined>(undefined);
  private readonly hint = signal<
    { readonly uid: string; readonly hint: TakeoverHint } | undefined
  >(undefined);
  /** The uid of the account shown. */
  private readonly accountUid = signal<string | undefined>(undefined);
  private readonly runningStep = signal<Step | undefined>(undefined);
  private readonly lastFailure = signal<Failure | undefined>(undefined);
  /** The uid whose account is shown or opening; none signed out. */
  private openedFor?: string;
  /** Counts the openings: only the latest shows its account. */
  private openingCount = 0;
  private service?: AccountService;
  private serviceLoading?: Promise<AccountService>;
  private account?: {
    readonly user: AccountUser;
    readonly selection: AccountSelection;
  };
  /**
   * The sign-in, sign-out or deletion running in this tab: one at a time,
   * a second call of the same joins it. Auth's news is this tab's own
   * while one runs.
   */
  private step?: { readonly kind: Step; readonly run: Promise<unknown> };

  /**
   * @param load loads Firebase; `undefined` where this build offers no
   *   sign-in.
   * @param isOnline whether the device has a network (`navigator.onLine`).
   */
  public constructor(
    private readonly local: LocalSelection,
    private readonly load: (() => Promise<AccountService>) | undefined,
    private readonly flag: SignInFlag,
    private readonly isOnline: () => boolean = () =>
      globalThis.navigator?.onLine ?? true
  ) {
    this.state = this.currentState.asReadonly();
    this.ready = this.loaded.asReadonly();
    this.takeoverHint = computed(() => {
      const hint = this.hint();
      return hint !== undefined && hint.uid === this.accountUid()
        ? hint.hint
        : undefined;
    });
    this.running = this.runningStep.asReadonly();
    this.failure = this.lastFailure.asReadonly();
    this.selection = new CurrentSelection(
      this.current,
      computed(() => this.currentState().kind === 'unreachable')
    );
  }

  /**
   * Opens the account of an Elternteil signed in before, or the device's;
   * from then on follows the `flag` other tabs set or clear.
   */
  public async start(): Promise<void> {
    if (this.load === undefined) {
      this.onDevice('off');
      return;
    }
    this.flag.watch(() => void this.flagChanged());
    if (!this.flag.isSet()) {
      this.onDevice('signed-out');
      if (this.flag.cleanUpPending()) {
        void this.cleanUp();
      }
      return;
    }
    await this.reopen();
  }

  /**
   * Clears Firestore's copy a sign-out left on the device, signed out as
   * the device is now; a failure leaves it for the next start.
   */
  private async cleanUp(): Promise<void> {
    try {
      await (await this.loadService()).clearCache();
    } catch {
      // the marker stays: the next start tries again
    }
  }

  /**
   * Loads Firebase ahead, so a click on "sign in" opens Google's popup at
   * once: browsers (Safari) block one opened after waiting for a download.
   */
  public async prepare(): Promise<void> {
    await this.loadService();
  }

  /**
   * Signs in with Google and takes the device's choices into the account,
   * then off the device; resolves with what did not fit under the caps.
   * Rejects with `SignInCancelled` when the popup was closed,
   * `PopupBlocked` when the browser refused it; where the choices could
   * not be taken over, it signs out again and rejects with that failure,
   * the device's choices kept.
   */
  public signIn(): Promise<NotTakenOver> {
    return this.oneAtATime('sign-in', async () => {
      const service = this.service ?? (await this.loadService());
      const user = await service.signInWithGoogle();
      let leftOver: NotTakenOver;
      try {
        leftOver = await this.takeOver(service, user);
      } catch (error) {
        // the failure to report is the takeover's, whatever signing out
        // does (`clearCache` never rejects); nothing the
        // takeover read of the account stays, the device's choices do
        await service.signOut().catch(() => undefined);
        await service.clearCache();
        throw error;
      }
      this.flag.set();
      await this.open(service, user);
      return leftOver;
    });
  }

  /**
   * Signs out: the account's choices leave the device, the device's start
   * empty. Where Auth does not sign out, nothing changes.
   */
  public signOut(): Promise<void> {
    return this.oneAtATime('sign-out', async () => {
      const { service, account } = this;
      if (service === undefined || account === undefined) {
        return;
      }
      // signing out clears the device's copy: a change not yet sent would go
      if (!(await service.allSent())) {
        throw new NotAllSent();
      }
      await service.signOut();
      await this.takeOffDevice(service);
    });
  }

  /**
   * Deletes the account: asks Google first (Auth deletes an account only
   * shortly after a sign-in), so nothing is deleted where the Elternteil
   * cancels; then its document, which only a server can confirm (refused
   * offline with `Offline`), then the account itself, both by the uid
   * Google was asked about (`AccountSwitched` where Auth's Elternteil is
   * another by then; `AccountNotDeleted` where Auth refuses the account
   * after its document went, so deleting again finishes it). Call it in the
   * click: the popup opens at once.
   */
  public deleteAccount(): Promise<void> {
    return this.oneAtATime('delete', async () => {
      const { service, account } = this;
      if (service === undefined || account === undefined) {
        return;
      }
      if (!this.isOnline()) {
        throw new Offline();
      }
      const { uid } = account.user;
      await service.reauthenticate();
      // another tab may have switched accounts while Google asked
      if (service.currentUser()?.uid !== uid) {
        throw new AccountSwitched();
      }
      await service.deleteSelection(uid);
      try {
        await service.deleteAuthUser(uid);
      } catch (error) {
        throw error instanceof AccountSwitched
          ? error
          : new AccountNotDeleted(error);
      }
      await this.takeOffDevice(service);
    });
  }

  /**
   * Runs `work` as this tab's one step: a call while the same step runs
   * joins it, one while another runs is refused. `work` starts at once, in
   * the click, as its popup must.
   */
  private oneAtATime<T>(kind: Step, work: () => Promise<T>): Promise<T> {
    if (this.step !== undefined) {
      return this.step.kind === kind
        ? (this.step.run as Promise<T>)
        : Promise.reject(new Error(`${this.step.kind} läuft noch.`));
    }
    this.lastFailure.set(undefined);
    this.runningStep.set(kind);
    const run = work()
      .catch((error: unknown) => {
        this.lastFailure.set({ kind, error });
        throw error;
      })
      .finally(() => {
        this.step = undefined;
        this.runningStep.set(undefined);
        // Auth's news while it ran was ignored: catch up with it now
        this.reconcile();
      });
    this.step = { kind, run };
    return run;
  }

  /**
   * Takes the device's choices into the account and then those the account
   * took off the device (`abgeben`, in one read and write); what did not
   * fit stays on the device, and what joined meanwhile, here or in another
   * tab, goes over in another round. Where something new still stays after
   * the last, the next start takes it over (`kept`). Tells the account
   * shown what it left (`takeover`).
   */
  private async takeOver(
    service: AccountService,
    user: AccountUser
  ): Promise<NotTakenOver> {
    let leftOver = NOTHING;
    let fresh = this.local.reread();
    for (let times = 0; times < MAX_TAKEOVERS; times++) {
      const doesNotFit = await service.takeOverDevice(user.uid, fresh);
      leftOver = selectionJoined(leftOver, doesNotFit);
      fresh = selectionWithout(
        this.local.handOver(selectionWithout(fresh, doesNotFit)),
        leftOver
      );
      if (selectionIsEmpty(fresh)) {
        break;
      }
    }
    this.setHint(user.uid, {
      leftOver,
      kept: !selectionIsEmpty(fresh),
    });
    return leftOver;
  }

  private setHint(uid: string, hint: TakeoverHint): void {
    this.hint.set({ uid, hint });
  }

  /**
   * Once a step of this tab ended: where Auth's Elternteil is no longer the
   * one shown (another tab signed out or in meanwhile), follows it.
   */
  private reconcile(): void {
    if (this.service !== undefined) {
      this.authChanged(this.service.currentUser());
    }
  }

  /**
   * Opens the account of the Elternteil signed in before; gives way where an
   * opening or a sign-out (another tab's) came meanwhile, leaving the marker
   * and the account it shows alone.
   */
  private async reopen(): Promise<void> {
    const number = this.openingCount;
    this.currentState.set({ kind: 'loading' });
    this.current.set(undefined);
    let user: AccountUser | null;
    try {
      const service = await this.loadService();
      user = await service.signedIn();
      if (number !== this.openingCount) {
        return;
      }
      if (user === null) {
        // the marker goes last: a start that fails before clears again
        await service.clearCache();
        if (number === this.openingCount) {
          this.flag.clear();
          this.onDevice('signed-out');
        }
        return;
      }
      await this.open(service, user);
    } catch {
      // the account's choices stay unshown rather than the device's
      if (number === this.openingCount) {
        this.currentState.set({ kind: 'unreachable' });
      }
      return;
    }
    if (this.account?.user.uid === user.uid) {
      await this.takeOverKept(this.account.user);
    }
  }

  /**
   * Takes over the choices a sign-in left on the device, as a step of its
   * own (no deletion runs meanwhile); where that fails, they stay for the
   * next start and the settings say so, the account open all the same.
   */
  private async takeOverKept(user: AccountUser): Promise<void> {
    const service = this.service;
    if (service === undefined || selectionIsEmpty(this.local.reread())) {
      return;
    }
    try {
      await this.oneAtATime('take-over', () => this.takeOver(service, user));
    } catch {
      this.setHint(user.uid, { leftOver: NOTHING, kept: true });
    }
  }

  private loadService(): Promise<AccountService> {
    if (this.load === undefined) {
      return Promise.reject(new Error('Diese Version bietet keine Anmeldung.'));
    }
    this.serviceLoading ??= this.load().then(
      (service) => {
        this.service = service;
        this.loaded.set(true);
        service.watch((user) => this.authChanged(user));
        return service;
      },
      (error: unknown) => {
        // a later attempt loads again
        this.serviceLoading = undefined;
        throw error;
      }
    );
    return this.serviceLoading;
  }

  /**
   * Auth's Elternteil changed: in another tab, or as the account went. Also
   * while an account opens: a newer opening or a sign-out supersedes it.
   */
  private authChanged(user: AccountUser | null): void {
    if (this.step !== undefined || this.service === undefined) {
      return;
    }
    if (user === null && this.openedFor !== undefined) {
      void this.takeOffDevice(this.service);
    } else if (user !== null && this.openedFor !== user.uid) {
      // another tab signed in and took this device's choices over; a
      // failure shows as `nicht-erreichbar`
      this.open(this.service, user).catch(() => undefined);
    }
  }

  /** Another tab set or cleared the `flag` (before Firebase is loaded here). */
  private async flagChanged(): Promise<void> {
    if (this.step !== undefined) {
      return;
    }
    if (this.flag.isSet() && this.openedFor === undefined) {
      await this.reopen();
    } else if (
      !this.flag.isSet() &&
      this.openedFor !== undefined &&
      this.service !== undefined
    ) {
      await this.takeOffDevice(this.service);
    }
  }

  /**
   * Shows the account of `user`; nothing of the one before while it
   * opens. Superseded by a later opening or a sign-out, or where Auth's
   * Elternteil changed meanwhile, it closes what it opened and shows nothing
   * (Auth's news, ignored during a step, is caught up with as it ends).
   */
  private async open(
    service: AccountService,
    user: AccountUser
  ): Promise<void> {
    const number = this.close();
    this.openedFor = user.uid;
    this.current.set(undefined);
    this.currentState.set({ kind: 'loading' });
    let selection: AccountSelection;
    try {
      selection = await service.selection(user.uid, (error) =>
        this.readFailed(error)
      );
    } catch (error) {
      if (number === this.openingCount) {
        // Auth's next word about this Elternteil opens it again
        this.openedFor = undefined;
        this.currentState.set({ kind: 'unreachable' });
      }
      throw error;
    }
    if (
      number !== this.openingCount ||
      service.currentUser()?.uid !== user.uid
    ) {
      selection.stop();
      if (number === this.openingCount) {
        this.reconcile();
      }
      return;
    }
    this.account = { user, selection };
    this.accountUid.set(user.uid);
    this.current.set(selection);
    this.currentState.set({ kind: 'signed-in', name: user.name });
  }

  /**
   * The account's selection cannot be read: where the rules refuse it, the
   * account was signed out or deleted elsewhere, so this device signs out
   * too; otherwise the settings say it cannot be read.
   */
  private readFailed(error: unknown): void {
    const service = this.service;
    if (service === undefined || this.account === undefined) {
      return;
    }
    if (errorCode(error) === PERMISSION_DENIED) {
      void service
        .signOut()
        .catch(() => undefined)
        .then(() => this.takeOffDevice(service));
    } else {
      this.currentState.set({ kind: 'unreachable' });
    }
  }

  /**
   * After signing out or deleting: nothing of the account stays; the
   * device's choices do, as only a takeover clears them.
   */
  private async takeOffDevice(service: AccountService): Promise<void> {
    this.close();
    this.flag.clear();
    this.onDevice('signed-out');
    await service.clearCache();
  }

  /**
   * Closes the account shown or opening, superseding any opening still
   * running; returns the number of the next opening.
   */
  private close(): number {
    this.account?.selection.stop();
    this.account = undefined;
    this.accountUid.set(undefined);
    this.openedFor = undefined;
    return ++this.openingCount;
  }

  private onDevice(kind: 'off' | 'signed-out'): void {
    this.current.set(this.local);
    this.currentState.set({ kind });
  }
}

/** The `Selection` that holds the choices now; nothing while none does yet. */
class CurrentSelection implements Selection {
  public readonly teams: Signal<readonly TeamId[] | undefined>;
  public readonly children: Signal<readonly Child[] | undefined>;
  public readonly clubColors: Signal<readonly ClubColorsChoice[] | undefined>;
  public readonly unreadable: Signal<boolean>;
  /** The store behind it: the device's, an account's, or none while it switches. */
  public readonly source: Signal<unknown>;

  /** @param accountUnreadable whether the account could not be opened at all. */
  public constructor(
    private readonly current: Signal<Selection | undefined>,
    accountUnreadable: Signal<boolean>
  ) {
    // an account that cannot be read shows none of what it read before
    const signals = listSignals<undefined>((list) =>
      accountUnreadable() ? undefined : current()?.[list]()
    );
    this.teams = signals.teams;
    this.children = signals.children;
    this.clubColors = signals.clubColors;
    this.unreadable = computed(
      () => accountUnreadable() || (current()?.unreadable() ?? false)
    );
    this.source = computed(() => current()?.source());
  }

  public follow(team: TeamId, place?: TeamPlace): Promise<void> {
    return this.withSelection((selection) => selection.follow(team, place));
  }

  public unfollow(team: TeamId): Promise<TeamPlace | undefined> {
    return this.withSelection((selection) => selection.unfollow(team));
  }

  public mark(player: MarkablePlayer, nickname?: string): Promise<void> {
    return this.withSelection((selection) => selection.mark(player, nickname));
  }

  public setNickname(
    person: PersonId,
    nickname: string | undefined
  ): Promise<void> {
    return this.withSelection((selection) =>
      selection.setNickname(person, nickname)
    );
  }

  public unmark(person: PersonId): Promise<void> {
    return this.withSelection((selection) => selection.unmark(person));
  }

  public setClubColors(club: ClubId, colors: ClubColors): Promise<void> {
    return this.withSelection((selection) =>
      selection.setClubColors(club, colors)
    );
  }

  public resetClubColors(club: ClubId): Promise<void> {
    return this.withSelection((selection) => selection.resetClubColors(club));
  }

  /** Changes only once `teams` is read, as `Selection` asks. */
  private withSelection<T>(
    change: (selection: Selection) => Promise<T>
  ): Promise<T> {
    const selection = this.current();
    return selection === undefined || this.teams() === undefined
      ? Promise.reject(new Error('Meine Teams sind nicht gelesen.'))
      : change(selection);
  }
}
