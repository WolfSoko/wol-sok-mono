import {
  deviceStorage,
  readStoredJson,
  writeStored,
  writeStoredJson,
} from '@wolsok/utils-browser-storage';
import { JSONCompatible } from '@wolsok/utils-json';

export const LOCAL_STORAGE_KEY_PREFIX = 'PACETRAINER@V0.9';

export class Repository<T extends JSONCompatible<T>> {
  private readonly localStorageKey: string;

  constructor(
    localStorageKey: string,
    private readonly saveToLocalStorage = true
  ) {
    this.localStorageKey = LOCAL_STORAGE_KEY_PREFIX + localStorageKey;
  }

  /** Stores `data`; where storage is refused the app keeps working unsaved. */
  public save(data: T): void {
    if (this.saveToLocalStorage) {
      writeStoredJson(this.localStorageKey, data, deviceStorage());
    }
  }

  public clear(): void {
    if (this.saveToLocalStorage) {
      writeStored(this.localStorageKey, null, deviceStorage());
    }
  }

  /** The stored data; null where none, unreadable or storage is withheld. */
  public load(): T | null {
    if (!this.saveToLocalStorage) {
      return null;
    }
    return readStoredJson(this.localStorageKey, deviceStorage()) as T | null;
  }
}
