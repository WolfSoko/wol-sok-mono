import {
  JSONCompatible,
  safeJsonParse,
  safeJsonStringify,
} from '../utils/json-utils/json-utils';

export const LOCAL_STORAGE_KEY_PREFIX = 'PACETRAINER@';

export class Repository<T extends JSONCompatible<T>> {
  private readonly localStorageKey: string;

  constructor(
    localStorageKey: string,
    private readonly saveToLocalStorage = true
  ) {
    this.localStorageKey = LOCAL_STORAGE_KEY_PREFIX + localStorageKey;
  }

  save(data: T): void {
    if (!this.saveToLocalStorage) {
      return;
    }
    localStorage?.setItem(this.localStorageKey, safeJsonStringify(data));
  }

  load(): T | null {
    if (!this.saveToLocalStorage) {
      return null;
    }
    const data = localStorage?.getItem(this.localStorageKey);
    return data ? (safeJsonParse(data) as T) : null;
  }
}
