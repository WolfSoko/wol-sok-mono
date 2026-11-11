import { inject, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ignoreElements,
  map,
  merge as mergeStreams,
  Observable,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { GameAccount, PlayerSwitch } from './game-account';
import { DeviceStorage, GameStorage } from './game-storage';
import {
  parseUnsaved,
  storedUnsaved,
  UnsavedChanges,
  unsavedEntry,
  unsavedKey,
  unsavedOf,
  withoutUnchanged,
  withoutUnsaved,
  withUnsaved,
} from './unsaved-changes';

/** What a document of the player's data is made of. */
export interface PlayerDocumentOptions<T> {
  /** The key it is kept under, in `GameStorage` and in `DeviceStorage`. */
  key: string;
  /** Reads a stored value - whatever it is - as the document's. */
  parse: (stored: unknown) => T;
  /** What a player holds before the storage told anything. */
  empty: T;
  /** What is held once the storage told a value: never less than either. */
  merge: (held: T, stored: T) => T;
  /** The stored value with data from elsewhere - a guest's, the device's - added, once. */
  adopt: (stored: T, guest: T) => T;
  /** True for the same value: it changes nothing held, and an empty one is not adopted. */
  equal?: (a: T, b: T) => boolean;
  /** Called as another player takes over, after the document started over. */
  onSwitch?: () => void;
  /**
   * Called with what is held after each value the storage told, with the
   * document's `apply` - the storage may answer while it is being created.
   */
  onStored?: (value: T, apply: PlayerDocument<T>['apply']) => void;
}

/** The player's data under a key, following whoever plays. */
export interface PlayerDocument<T> {
  /** What is held here: the stored value merged with what changed since. */
  readonly value: Signal<T>;
  /** True once the storage has answered for the player - before, nothing is known yet. */
  readonly loaded: Signal<boolean>;
  /**
   * Holds `value` here and writes `write` of the stored value - applied to
   * the latest one, so what another tab or device stored is not lost.
   */
  apply(value: T, write: (stored: T) => T): void;
}

/**
 * Keeps the player's data under a key of the game storage and follows the
 * player (`GameAccount.players`): on a switch it starts over from the next
 * player's, unless a guest signed in to an account that played elsewhere -
 * then the guest's data joins the account's, once. The first player of a
 * visit with the cloud also gets what this device kept under the key before
 * the cloud, once: the device's copy goes only once the cloud stored it.
 *
 * With the cloud, what the page holds after a change also stays on the
 * device (`unsaved-changes.ts`) until the cloud stored the change: a page
 * closed before that leaves it for the player's next visit here, which
 * merges it in. `merge` can only gain, so landing it twice changes nothing.
 *
 * Call it in an injection context, a service's field initialiser; it stops
 * with that context.
 */
export function playerDocument<T>(
  options: PlayerDocumentOptions<T>
): PlayerDocument<T> {
  const { key, parse, empty, merge, adopt, onSwitch, onStored } = options;
  const equal = options.equal ?? Object.is;
  const storage = inject(GameStorage);
  const account = inject(GameAccount);
  const device = inject(DeviceStorage);
  const value = signal(empty, { equal });
  const loaded = signal(false);
  const unsaved = unsavedChanges(device, key, account.cloud, merge);
  /** Whoever plays, null between a sign-out and the next guest. */
  let player: string | null = null;

  const store = (next: T, write: (stored: T) => T): void => {
    const settled = storage.update(key, (stored) => write(parse(stored)));
    if (player !== null) {
      void unsaved.keep(player, next, settled);
    }
  };

  const apply = (next: T, write: (stored: T) => T): void => {
    value.set(next);
    store(next, write);
  };

  const adoptOnce = (guest: T): Promise<boolean> => {
    if (equal(guest, empty)) {
      return Promise.resolve(true);
    }
    return storage.update(key, (stored) => adopt(parse(stored), guest));
  };

  const switchTo = ({ adoptsGuest }: PlayerSwitch): void => {
    const guest = value();
    loaded.set(false);
    value.set(empty);
    onSwitch?.();
    if (adoptsGuest) {
      void adoptOnce(guest);
    }
  };

  /**
   * Hands the device's copy to the player, once: kept as an unsaved change
   * first, then taken off the device, so a second page never adopts it too
   * and a page closed before the cloud has it leaves it for the next visit.
   */
  const deviceCopy = (): Observable<never> =>
    device.watch(key).pipe(
      take(1),
      tap((stored) => {
        if (stored === null) {
          return;
        }
        const copy = parse(stored);
        const kept =
          player === null
            ? Promise.resolve()
            : unsaved.keep(player, copy, adoptOnce(copy));
        void kept.then(() => device.write(key, null));
      }),
      ignoreElements()
    );

  /** Applies what earlier pages left unsaved for the player, as a change of this one. */
  const replayUnsaved = (owner: string): Observable<never> =>
    unsaved.of(owner).pipe(
      tap((read) => {
        const values = Object.values(read).map(({ value }) => parse(value));
        if (values.length === 0) {
          return;
        }
        const left = values.reduce(merge, empty);
        const next = merge(value(), left);
        value.set(next);
        store(next, (stored) => merge(stored, left));
        unsaved.drop(read);
      }),
      ignoreElements()
    );

  account.players
    .pipe(
      switchMap((playerSwitch, index) => {
        if (index > 0) {
          switchTo(playerSwitch);
        }
        player = playerSwitch.playerId;
        const stored = storage.watch(key);
        if (!account.cloud) {
          return stored;
        }
        const handOver = [
          ...(index === 0 ? [deviceCopy()] : []),
          ...(player === null ? [] : [replayUnsaved(player)]),
        ];
        return mergeStreams(...handOver, stored);
      }),
      map(parse),
      takeUntilDestroyed()
    )
    .subscribe((stored) => {
      value.set(merge(value(), stored));
      loaded.set(true);
      onStored?.(value(), apply);
    });

  return { value: value.asReadonly(), loaded: loaded.asReadonly(), apply };
}

/** The unsaved changes of a document on this device, as this page keeps them. */
interface UnsavedJournal<T> {
  /**
   * Keeps what the page holds for the player, merged into what it kept
   * before, until `settled` says it is stored and no later change waits.
   * Resolves once it is on the device.
   */
  keep(player: string, value: T, settled: Promise<boolean>): Promise<void>;
  /** The changes other pages left for the player on the device, read once. */
  of(player: string): Observable<UnsavedChanges>;
  /** Removes the changes read, unless another page wrote them again since. */
  drop(read: UnsavedChanges): void;
}

/** A journal of a key's unsaved changes in the device storage; none without the cloud. */
function unsavedChanges<T>(
  device: GameStorage,
  key: string,
  cloud: boolean,
  merge: (held: T, other: T) => T
): UnsavedJournal<T> {
  const page = pageId();
  const journalKey = unsavedKey(key);
  /** What this page kept per player since the last change stored. */
  const kept = new Map<string, { value: T; latest: number }>();
  const change = (
    edit: (changes: UnsavedChanges) => UnsavedChanges
  ): Promise<boolean> =>
    device.update(journalKey, (stored) =>
      storedUnsaved(edit(parseUnsaved(stored)))
    );

  return {
    keep(player, value, settled) {
      if (!cloud) {
        return Promise.resolve();
      }
      const entry = unsavedEntry(page, player);
      const before = kept.get(player);
      const held = {
        value: before === undefined ? value : merge(before.value, value),
        latest: (before?.latest ?? 0) + 1,
      };
      kept.set(player, held);
      void settled.then((stored) => {
        // A change dropped for good stays, for the player's next start here.
        if (stored && kept.get(player) === held) {
          kept.delete(player);
          void change((changes) => withoutUnsaved(changes, [entry]));
        }
      });
      return change((changes) =>
        withUnsaved(changes, entry, { player, value: held.value })
      ).then(() => undefined);
    },
    of(player) {
      const own = unsavedEntry(page, player);
      return device.watch(journalKey).pipe(
        take(1),
        // This page's own entry is the change it is making now.
        map((stored) =>
          withoutUnsaved(unsavedOf(parseUnsaved(stored), player), [own])
        )
      );
    },
    drop(read) {
      void change((changes) => withoutUnchanged(changes, read));
    },
  };
}

/** Names this page apart from every other page of the device. */
function pageId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}
