import { signal } from '@angular/core';
import { BehaviorSubject, switchMap } from 'rxjs';
import type {
  GameAccount,
  PlayerProfile,
  PlayerSwitch,
  SignInOutcome,
} from '../lib/storage/game-account';
import type { GameStorage } from '../lib/storage/game-storage';
import { LateGameStorage } from './late-game-storage';

/** Where what is stored while nobody plays lands in the fake. */
const NOBODY = 'nobody';

/**
 * An account for specs whose player switches on `switchTo`, with a
 * `LateGameStorage` per player behind `storage`, which answers for whoever
 * plays - as the Firestore backend does.
 *
 * Provide both: `{ provide: GameAccount, useValue: account }` and
 * `{ provide: GameStorage, useValue: account.storage }`.
 */
export class FakeGameAccount implements GameAccount {
  public readonly cloud = true;
  public readonly profile = signal<PlayerProfile | null>(null);
  private readonly switches: BehaviorSubject<PlayerSwitch>;
  public readonly players;
  private readonly storages = new Map<string, LateGameStorage>();

  public constructor(playerId = 'guest') {
    this.switches = new BehaviorSubject({ playerId, adoptsGuest: false });
    this.players = this.switches.asObservable();
  }

  public readonly storage: GameStorage = {
    watch: (key) =>
      this.switches.pipe(
        switchMap(({ playerId }) =>
          this.storageOf(playerId ?? NOBODY).watch(key)
        )
      ),
    write: (key, value) => this.current().write(key, value),
    update: (key, change) => this.current().update(key, change),
  };

  /** The storage of a player. */
  public storageOf(playerId: string): LateGameStorage {
    let storage = this.storages.get(playerId);
    if (storage === undefined) {
      storage = new LateGameStorage();
      this.storages.set(playerId, storage);
    }
    return storage;
  }

  /** Gives a player a new storage holding `stored`. */
  public seed(playerId: string, stored: Record<string, unknown>): void {
    this.storages.set(playerId, new LateGameStorage(stored));
  }

  public switchTo(playerId: string, adoptsGuest = false): void {
    this.switches.next({ playerId, adoptsGuest });
  }

  /** Answers everything asked of every player's storage so far. */
  public flush(): void {
    this.storages.forEach((storage) => storage.flush());
  }

  public signIn(): Promise<SignInOutcome> {
    return Promise.resolve('signed-in');
  }

  public signOut(): Promise<void> {
    return Promise.resolve();
  }

  private current(): LateGameStorage {
    return this.storageOf(this.switches.value.playerId ?? NOBODY);
  }
}
