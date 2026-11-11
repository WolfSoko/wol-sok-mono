import { Injectable } from '@angular/core';
import {
  deviceStorage,
  readStoredJson,
  readStored,
  watchStored,
  writeStored,
} from '@wolsok/utils-browser-storage';
import { Observable } from 'rxjs';
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
    return new Observable<unknown>((subscriber) => {
      const emit = () => subscriber.next(readStoredJson(key, deviceStorage()));
      emit();
      return watchStored(key, emit, window);
    });
  }

  /** Stores `value`; where storage is refused it lasts for this visit only. */
  public write(key: string, value: unknown): void {
    this.store(key, value);
  }

  /**
   * Reads, changes and writes the value under a lock all tabs share, where
   * the browser has Web Locks: two tabs ending a match at once would both
   * read the old count, and one match would be lost.
   */
  public update(
    key: string,
    change: (stored: unknown) => unknown
  ): Promise<boolean> {
    const apply = () => {
      try {
        return this.store(key, change(readStoredJson(key, deviceStorage())));
      } catch (error) {
        console.error(`Could not store ${key}`, error);
        return false;
      }
    };
    const locks = globalThis.navigator?.locks;
    if (locks == null) {
      return Promise.resolve(apply());
    }
    // A browser that refuses the lock still gets the change.
    return locks.request(`${LOCK_PREFIX}${key}`, apply).catch(apply);
  }

  /** Writes the value unless it is stored already: false when refused. */
  private store(key: string, value: unknown): boolean {
    const storage = deviceStorage();
    const json = JSON.stringify(value);
    return (
      readStored(key, storage) === json ||
      writeStored(key, json, storage) === 'stored'
    );
  }
}

/** Names the Web Lock that guards a key, apart from other locks of the origin. */
const LOCK_PREFIX = 'bacteria-game-storage:';
