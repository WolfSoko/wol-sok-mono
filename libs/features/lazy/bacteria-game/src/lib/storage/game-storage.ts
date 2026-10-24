import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GameCloud } from './game-cloud';
import { LocalGameStorage } from './local-game-storage';

/**
 * Where the game keeps what it remembers between visits, value by key: the
 * player's progress. It answers for whoever plays (`GameAccount`) - from the
 * Firebase project once `provideGameCloud` names one, else from the
 * browser's local storage. A spec provides another class for this one:
 * `{ provide: GameStorage, useValue: new LateGameStorage() }`.
 *
 * Every backend may answer late, so the services keep their state in
 * signals and never wait on storage. Values are plain JSON - what
 * `JSON.stringify` keeps - so every backend can store them. A backend that fails - no network, a
 * browser that refuses storage - reads as nothing stored and lets a write go,
 * so the value lasts for this visit only. None of the calls throws or errors.
 */
@Injectable({
  providedIn: 'root',
  useFactory: () => inject(GameCloud).storage(),
})
export abstract class GameStorage {
  /**
   * The value stored under a key - null when there is none or it is
   * unreadable - and the value again whenever it changes elsewhere: in
   * another tab, or later on another device. The first value may come at
   * once or later.
   */
  public abstract watch(key: string): Observable<unknown>;

  /**
   * Stores a value under a key, replacing what was there. A value equal to
   * the stored one is no write at all - a Firestore backend compares with its
   * latest snapshot, as every write there is billed.
   */
  public abstract write(key: string, value: unknown): void;

  /**
   * Stores what `change` makes of the latest value stored under a key - null
   * when there is none - and skips the write when that changes nothing, as
   * `write` does. A backend shared between devices may apply it later,
   * once it is online, and call `change` more than once, so `change` must not
   * have side effects. Changes that merge and can only gain come to the same
   * however often they land; a change that adds to a count must land exactly
   * once - a transaction does that.
   */
  public abstract update(
    key: string,
    change: (stored: unknown) => unknown
  ): void;
}

/**
 * What stays with this device, whoever plays on it: the settings - sound,
 * controls, the graphics a device can afford. Always the browser's local
 * storage.
 */
@Injectable({ providedIn: 'root', useClass: LocalGameStorage })
export abstract class DeviceStorage extends GameStorage {}
