import { filter, Observable, Subject } from 'rxjs';
import type { GameStorage } from './game-storage';

/**
 * A storage for specs that answers late, as a Firebase backend would: no
 * watcher hears anything and no write lands before `flush()`. A service that
 * counts on storage answering at once fails against it.
 *
 * Provide it with `{ provide: GameStorage, useValue: new LateGameStorage() }`.
 */
export class LateGameStorage implements GameStorage {
  private readonly values = new Map<string, string>();
  private readonly changed = new Subject<string>();
  private pending: (() => void)[] = [];

  public constructor(stored: Record<string, unknown> = {}) {
    for (const [key, value] of Object.entries(stored)) {
      this.values.set(key, JSON.stringify(value));
    }
  }

  public watch(key: string): Observable<unknown> {
    return new Observable((subscriber) => {
      this.pending.push(() => subscriber.next(this.stored(key)));
      return this.changed
        .pipe(filter((changedKey) => changedKey === key))
        .subscribe(() => subscriber.next(this.stored(key)));
    });
  }

  public write(key: string, value: unknown): void {
    this.pending.push(() => this.store(key, value));
  }

  public update(key: string, change: (stored: unknown) => unknown): void {
    this.pending.push(() => this.store(key, change(this.stored(key))));
  }

  /** Answers everything asked so far. */
  public flush(): void {
    const pending = this.pending;
    this.pending = [];
    pending.forEach((answer) => answer());
  }

  /** The value stored under a key, null when there is none. */
  public stored(key: string): unknown {
    const json = this.values.get(key);
    return json == null ? null : JSON.parse(json);
  }

  private store(key: string, value: unknown): void {
    this.values.set(key, JSON.stringify(value));
    this.changed.next(key);
  }
}
