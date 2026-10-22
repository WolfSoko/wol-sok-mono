import {
  EnvironmentProviders,
  inject,
  Injectable,
  provideEnvironmentInitializer,
} from '@angular/core';
import type { FirebaseOptions } from 'firebase/app';
import { DeviceAccount } from './device-account';
import type { GameAccount } from './game-account';
import type { GameStorage } from './game-storage';
import { connectFirebase } from './firebase-connection';
import { FirebaseGameAccount } from './firebase-game-account';
import { FirestoreGameStorage } from './firestore-game-storage';
import { LocalGameStorage } from './local-game-storage';

/** The Firebase project the game keeps the players' progress in. */
export interface GameCloudOptions {
  /** The web app config from the Firebase console. */
  firebase: FirebaseOptions;
  /**
   * Local emulators to use instead of the project, for development:
   * `nx run bacteria-game-remote:firebase-emulators`.
   */
  emulators?: {
    /** The Auth emulator, "http://127.0.0.1:9099". */
    authUrl: string;
    firestoreHost: string;
    firestorePort: number;
  };
}

/**
 * Connects the game to its Firebase project: the player's progress then
 * follows their account, a guest one at first, one they can sign in to
 * with Google later. Without options - no project set up yet - everything
 * stays in the browser's local storage.
 *
 * Belongs into the providers of the route the game is loaded under, so it
 * holds inside the shell, which never sees the remote's app config, as
 * well as on the game's own page.
 */
export function provideGameCloud(
  options: GameCloudOptions | null
): EnvironmentProviders {
  return provideEnvironmentInitializer(() => inject(GameCloud).use(options));
}

/**
 * Where the game's services keep their data: in the Firebase project once
 * `provideGameCloud` named one, else on this device. The game's services
 * live in the root injector while the project is named on a route, so they
 * ask here instead of a provider on that route, which they would not see.
 */
@Injectable({ providedIn: 'root' })
export class GameCloud {
  private options: GameCloudOptions | null = null;
  private backend: { account: GameAccount; storage: GameStorage } | null = null;
  /** Whether a service has asked already - the options come too late then. */
  private asked = false;

  public use(options: GameCloudOptions | null): void {
    if (this.asked && options !== this.options) {
      console.error(
        'The game cloud was set up after the game started - staying on this device.'
      );
      return;
    }
    this.options = options;
  }

  /** The storage of whoever plays. */
  public storage(): GameStorage {
    return this.connected()?.storage ?? new LocalGameStorage();
  }

  /** Who plays. */
  public account(): GameAccount {
    return this.connected()?.account ?? new DeviceAccount();
  }

  private connected() {
    this.asked = true;
    if (this.options === null) {
      return null;
    }
    if (this.backend === null) {
      const connection = connectFirebase(this.options);
      const account = new FirebaseGameAccount(connection);
      this.backend = {
        account,
        storage: new FirestoreGameStorage(connection, account.playerIds),
      };
    }
    return this.backend;
  }
}
