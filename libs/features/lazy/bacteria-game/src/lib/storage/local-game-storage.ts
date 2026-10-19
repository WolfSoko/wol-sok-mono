import { Injectable } from '@angular/core';
import { filter, fromEvent, map, Observable, startWith } from 'rxjs';
import type { GameStorage } from './game-storage';

/**
 * The game's storage in the browser's local storage, one JSON value per key.
 * It answers at once, and hears of the changes other tabs make through the
 * `storage` event. A browser that refuses storage - private mode, a blocked
 * site - or holds something unreadable under a key reads as nothing stored.
 */
@Injectable()
export class LocalGameStorage implements GameStorage {
  public watch(key: string): Observable<unknown> {
    return fromEvent<StorageEvent>(window, 'storage').pipe(
      // A null key means another tab cleared the storage.
      filter((event) => event.key === key || event.key === null),
      startWith(null),
      map(() => readStoredJson(key))
    );
  }

  public write(key: string, value: unknown): void {
    try {
      const json = JSON.stringify(value);
      if (localStorage.getItem(key) !== json) {
        localStorage.setItem(key, json);
      }
    } catch {
      // Storage refused - the value lasts for this visit only.
    }
  }

  /**
   * Reads, changes and writes the value under a lock all tabs share, where
   * the browser has Web Locks: two tabs ending a match at once would both
   * read the old count, and one match would be lost.
   */
  public update(key: string, change: (stored: unknown) => unknown): void {
    const apply = () => this.write(key, change(readStoredJson(key)));
    const locks = globalThis.navigator?.locks;
    if (locks == null) {
      apply();
      return;
    }
    // A browser that refuses the lock still gets the change.
    locks.request(`${LOCK_PREFIX}${key}`, apply).catch(apply);
  }
}

/** Names the Web Lock that guards a key, apart from other locks of the origin. */
const LOCK_PREFIX = 'bacteria-game-storage:';

/** The JSON stored under a key, null when there is none or it is unreadable. */
function readStoredJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
