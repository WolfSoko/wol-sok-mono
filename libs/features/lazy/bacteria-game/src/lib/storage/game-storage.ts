import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LocalGameStorage } from './local-game-storage';

/**
 * Where the game keeps what it remembers between visits, value by key. The
 * browser's local storage does for now; a Firebase backend can take over
 * later by providing another class for this one:
 * `{ provide: GameStorage, useClass: FirestoreGameStorage }`.
 *
 * Every backend may answer late, so the services keep their state in
 * signals and never wait on storage. A backend that fails - no network, a
 * browser that refuses storage - reads as nothing stored and lets a write go,
 * so the value lasts for this visit only. None of the calls throws or errors.
 */
@Injectable({ providedIn: 'root', useClass: LocalGameStorage })
export abstract class GameStorage {
  /**
   * The value stored under a key - null when there is none or it is
   * unreadable - and the value again whenever it changes elsewhere: in
   * another tab, or later on another device. The first value may come at
   * once or later.
   */
  public abstract watch(key: string): Observable<unknown>;

  /** Stores a value under a key, replacing what was there. */
  public abstract write(key: string, value: unknown): void;

  /**
   * Stores what `change` makes of the value stored under a key - null when
   * there is none. A backend shared between devices runs it as a transaction
   * and may call `change` more than once, so it must not have side effects.
   */
  public abstract update(
    key: string,
    change: (stored: unknown) => unknown
  ): void;
}

/** True for anything a stored object's fields can be read from. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}
