import { signal, type Signal } from '@angular/core';
import type {
  PersonId,
  TeamId,
  ClubId,
} from '@wolsok/feat-shared-basketball-data';
import type { ClubColors } from './club-colors';
import type { ClubColorsChoice } from './club-colors-choice';
import type { Selection } from './selection';
import {
  handOverChange,
  unfollowChange,
  unmarkChange,
  followChange,
  checkLimits,
  contentOf,
  markChange,
  nicknameChange,
  teamPlace,
  clubColorsChange,
  resetClubColorsChange,
  type SelectionChange,
} from './selection-changes';
import {
  readSelectionDocument,
  selectionDocumentWith,
  selectionFields,
  nextSince,
  type ReadDocument,
  type TeamPlace,
} from './selection-document';
import {
  everyList,
  EMPTY_SELECTION,
  type SelectionContent,
  type SelectionLists,
} from './selection-lists';
import { listSignals } from './list-signals';
import type { Child, MarkablePlayer } from './child';
import { isStorageFull } from '@wolsok/utils-browser-storage';
import { SelectionTooNewError } from './selection-errors';

/** The key of the `SelectionDocument` in the device's storage. */
export const SELECTION_KEY = 'korbjaeger-selection';

/** The part of the device's storage (`localStorage`) the adapter uses. */
export type DeviceStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Where the browser tells of changes other tabs made (`window`). */
export type WindowEvents = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

/**
 * The `Selection` on the device, for Elternteile without an account.
 * - It reads the stored `SelectionDocument` at start, whenever another tab
 *   changed it (the `storage` event on `events`, until `stop`), and
 *   again before each write, so two tabs keep each other's changes.
 * - A document that cannot be read or is none counts as empty; fields it
 *   does not know are kept on a write.
 * - A document of a newer version is left alone: no Team is followed, no
 *   Kind marked, and every change rejects with `SelectionTooNewError`.
 * - A change over a list's cap (`SELECTION_LIMITS`) rejects with
 *   `SelectionFullError`, nothing stored.
 * - Each change reads and writes at once, in the call: stored before it
 *   returns, so leaving the page right after keeps it.
 * - Where the storage is full, it has `makeRoom` free it (of the
 *   cached DBB answers) and tries once more. A change it still could not
 *   store (private mode, full, no storage) is kept as `pending`: applied on
 *   top of what is read (another tab's changes too) until a write takes
 *   it, so it lasts at least for this visit.
 */
export class LocalSelection implements Selection {
  public readonly teams: Signal<readonly TeamId[]>;
  public readonly children: Signal<readonly Child[]>;
  public readonly clubColors: Signal<readonly ClubColorsChoice[]>;
  /** The device's storage is always read, at worst as empty. */
  public readonly unreadable: Signal<boolean> = signal(false).asReadonly();
  /** The device's storage holds the choices, always this one. */
  public readonly source: Signal<unknown> = signal(this).asReadonly();

  private readonly content = signal<SelectionContent>(EMPTY_SELECTION);

  /** This visit's changes no write has stored yet, in their order. */
  private pending: readonly SelectionChange[] = [];

  private readonly onStorageChange = (event: Event): void => {
    if (
      event instanceof StorageEvent &&
      (event.key === null || event.key === SELECTION_KEY)
    ) {
      this.show(this.read());
    }
  };

  /**
   * @param makeRoom frees the device's storage of what may give way
   *   (the cached DBB answers) when it is full; the selection always wins.
   */
  public constructor(
    private readonly storage: DeviceStorage | undefined,
    private readonly events?: WindowEvents,
    private readonly makeRoom: () => void = () => undefined
  ) {
    // read at once, so `teams` and `children` are never undefined here
    this.show(this.read());
    const signals = listSignals((list) => this.content()[list]);
    this.teams = signals.teams;
    this.children = signals.children;
    this.clubColors = signals.clubColors;
    events?.addEventListener('storage', this.onStorageChange);
  }

  public follow(team: TeamId, place?: TeamPlace): Promise<void> {
    return this.change(followChange(team, place));
  }

  public unfollow(team: TeamId): Promise<TeamPlace | undefined> {
    return this.run(unfollowChange(team), (before) => teamPlace(before, team));
  }

  public mark(player: MarkablePlayer, nickname?: string): Promise<void> {
    return this.change(markChange(player, nickname));
  }

  public setNickname(
    person: PersonId,
    nickname: string | undefined
  ): Promise<void> {
    return this.change(nicknameChange(person, nickname));
  }

  public unmark(person: PersonId): Promise<void> {
    return this.change(unmarkChange(person));
  }

  public setClubColors(club: ClubId, colors: ClubColors): Promise<void> {
    return this.change(clubColorsChange(club, colors));
  }

  public resetClubColors(club: ClubId): Promise<void> {
    return this.change(resetClubColorsChange(club));
  }

  /**
   * Reads the stored selection now, not waiting for another tab's `storage`
   * event, with the changes still `pending`: what a sign-in takes over.
   */
  public reread(): SelectionContent {
    this.show(this.read());
    const content = this.content();
    return everyList<SelectionLists>((list) => content[list]);
  }

  /**
   * Takes `takenOver` off the device, once an account holds it, and
   * returns what stays: what joined since it was read (here or in another
   * tab) is left. One read and write, as every change is, which leaves an
   * empty document where nothing stays: it shrinks what is stored, so a
   * full storage takes it. Only a sign-in's takeover calls it.
   */
  public handOver(takenOver: SelectionContent): SelectionContent {
    this.changeNow(handOverChange(takenOver));
    return this.reread();
  }

  /** Stops listening to other tabs. */
  public stop(): void {
    this.events?.removeEventListener('storage', this.onStorageChange);
  }

  /** Runs `change` now (`changeNow`), its failure as the rejection. */
  private change(change: SelectionChange): Promise<void> {
    return this.run(change, () => undefined);
  }

  /**
   * Runs `change` now, resolving with `result` of the state it applied
   * to; its failure as the rejection.
   */
  private run<T>(
    change: SelectionChange,
    result: (before: SelectionContent) => T
  ): Promise<T> {
    try {
      return Promise.resolve(result(this.changeNow(change)));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Applies `change` to what is stored now, with the changes still
   * `pending`, and stores the result where it changed anything or something
   * was still to be stored. Returns the state it applied `change` to:
   * read from storage at once, so it has the `since` of every stored entry.
   */
  private changeNow(change: SelectionChange): SelectionContent {
    const read = this.read();
    if (read.kind === 'newer') {
      this.show(read);
      throw new SelectionTooNewError();
    }
    const stored = contentOf(read);
    const before = this.withPending(stored);
    const after = change(before);
    checkLimits(before, after);
    this.content.set(after);
    if (after === before && this.pending.length === 0) {
      return before;
    }
    const toStore = selectionDocumentWith(
      read,
      selectionFields(stored, after, nextSince(read))
    );
    this.pending = this.write(toStore) ? [] : [...this.pending, change];
    return before;
  }

  /**
   * Shows what `read` holds, with the changes still `pending`; a newer
   * version's document shows nothing, and those changes are dropped, as
   * they could never be stored over it.
   */
  private show(read: ReadDocument): void {
    if (read.kind === 'newer') {
      this.pending = [];
    }
    this.content.set(this.withPending(contentOf(read)));
  }

  /** `content` with the changes still `pending` applied, in their order. */
  private withPending(content: SelectionContent): SelectionContent {
    return this.pending.reduce((state, change) => change(state), content);
  }

  private read(): ReadDocument {
    try {
      const text = this.storage?.getItem(SELECTION_KEY);
      return readSelectionDocument(text ? JSON.parse(text) : undefined);
    } catch {
      return { kind: 'none' };
    }
  }

  /** Stores `toStore`; whether the device took it. */
  private write(toStore: unknown): boolean {
    if (this.storage === undefined) {
      return false;
    }
    const text = JSON.stringify(toStore);
    try {
      this.storage.setItem(SELECTION_KEY, text);
      return true;
    } catch (error) {
      // blocked: no room to make
      return isStorageFull(error) && this.writeAfterMakingRoom(text);
    }
  }

  /** Has the cached data give way, then tries once more. */
  private writeAfterMakingRoom(text: string): boolean {
    try {
      this.makeRoom();
      this.storage?.setItem(SELECTION_KEY, text);
      return true;
    } catch {
      return false;
    }
  }
}
