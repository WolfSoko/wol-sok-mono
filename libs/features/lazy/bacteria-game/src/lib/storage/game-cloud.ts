import { Injectable } from '@angular/core';
import type { FirebaseOptions } from '@angular/fire/app';
import { DeviceAccount } from './device-account';
import type { GameAccount } from './game-account';
import type { GameStorage } from './game-storage';
import type { FirebaseConnection } from './firebase-connection';
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
    /** The Auth emulator, "http://localhost:9399". */
    authUrl: string;
    firestoreHost: string;
    firestorePort: number;
  };
}

/**
 * Where the game's services keep their data: in the Firebase project once
 * `provideGameCloud` connected one, else on this device. The game's services
 * live in the root injector while the project is named on a route, so they
 * ask here instead of a provider on that route, which they would not see.
 */
@Injectable({ providedIn: 'root' })
export class GameCloud {
  private connection: FirebaseConnection | null = null;
  private backend: { account: GameAccount; storage: GameStorage } | null = null;
  /** Whether a service has asked already - a project comes too late then. */
  private asked = false;

  /** Uses the project connected to, none for this device only. */
  public use(connection: FirebaseConnection | null): void {
    if (this.asked && connection?.db !== this.connection?.db) {
      console.error(
        'The game cloud was set up after the game started - staying on this device.'
      );
      return;
    }
    this.connection = connection;
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
    const { connection } = this;
    if (connection === null) {
      return null;
    }
    if (this.backend === null) {
      const account = new FirebaseGameAccount(connection);
      this.backend = {
        account,
        storage: new FirestoreGameStorage(connection, account.playerIds),
      };
    }
    return this.backend;
  }
}
