import {
  JSONCompatible,
  safeJsonParse,
  safeJsonStringify,
} from '../utils/json-utils/json-utils';

export const LOCAL_STORAGE_KEY_PREFIX = 'PACETRAINER@V0.9';

export class Repository<T extends JSONCompatible<T>> {
  private readonly localStorageKey: string;

  constructor(
    localStorageKey: string,
    private readonly saveToLocalStorage = true
  ) {
    this.localStorageKey = LOCAL_STORAGE_KEY_PREFIX + localStorageKey;
  }

  public save(data: T): void {
    if (!this.saveToLocalStorage) {
      return;
    }
    try {
      localStorage?.setItem(this.localStorageKey, safeJsonStringify(data));
    } catch {
      // quota exceeded or site data blocked: the app keeps working unsaved
    }
  }

  public load(): T | null {
    if (!this.saveToLocalStorage) {
      return null;
    }
    try {
      const data = localStorage?.getItem(this.localStorageKey);
      return data ? (safeJsonParse(data) as T) : null;
    } catch {
      // site data blocked or not written by this app: start without it
      return null;
    }
  }
}
