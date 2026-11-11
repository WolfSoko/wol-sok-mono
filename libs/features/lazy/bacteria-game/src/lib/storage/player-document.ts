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
 * the cloud, once.
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

  const apply = (next: T, write: (stored: T) => T): void => {
    value.set(next);
    void storage.update(key, (stored) => write(parse(stored)));
  };

  const adoptOnce = (guest: T): void => {
    if (equal(guest, empty)) {
      return;
    }
    void storage.update(key, (stored) => adopt(parse(stored), guest));
  };

  const switchTo = ({ adoptsGuest }: PlayerSwitch): void => {
    const guest = value();
    loaded.set(false);
    value.set(empty);
    onSwitch?.();
    if (adoptsGuest) {
      adoptOnce(guest);
    }
  };

  /** Hands the device's copy to the player, once - dropped with them. */
  const deviceCopy = (): Observable<never> =>
    device.watch(key).pipe(
      take(1),
      tap((stored) => {
        if (stored !== null) {
          adoptOnce(parse(stored));
          device.write(key, null);
        }
      }),
      ignoreElements()
    );

  account.players
    .pipe(
      switchMap((player, index) => {
        if (index > 0) {
          switchTo(player);
        } else if (account.cloud) {
          return mergeStreams(deviceCopy(), storage.watch(key));
        }
        return storage.watch(key);
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
