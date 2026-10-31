import { Injectable } from '@angular/core';
import type { FirebaseOptions } from '@angular/fire/app';
import { DeviceAccount } from './device-account';
import type { GameAccount } from './game-account';
import type { GameStorage } from './game-storage';
import type { FirebaseConnection } from './firebase-connection';
import { FirebaseGameAccount } from './firebase-game-account';
import { FirestoreGameBoards } from './firestore-game-boards';
import { FirestoreGameRooms } from './firestore-game-rooms';
import { FirestoreGameSocial } from './firestore-game-social';
import type { GamePresence, GameSocial } from './game-social';
import { RtdbGamePresence } from './rtdb-game-presence';
import { FirestoreGameStorage } from './firestore-game-storage';
import { FirestoreGameReplays } from './firestore-game-replays';
import type { GameReplays } from './game-replays';
import { LocalGameReplays } from './local-game-replays';
import type { GameBoards } from './game-boards';
import type { GameRooms } from './game-rooms';
import type { GameToggles } from './game-toggles';
import { banned, type GameModeration } from './game-moderation';
import { FirestoreGameModeration } from './firestore-game-moderation';
import type { GameRanked } from './game-ranked';
import { FirestoreGameRanked } from './firestore-game-ranked';
import { NoGameToggles } from './no-game-toggles';
import { LocalGameStorage } from './local-game-storage';
import { RemoteConfigGameToggles } from './remote-config-game-toggles';

/**
 * The game's own Firebase app, named so it stands next to the shell's
 * default app, which belongs to another project. Whoever starts it first -
 * the game cloud or the site's analytics - starts it with the same options.
 */
export const GAME_FIREBASE_APP = 'bacteria-wars';

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
    /** The Realtime Database emulator, on the Firestore emulator's host. */
    databasePort?: number;
  };
  /**
   * True once the project takes recorded matches: its functions and the
   * rules for `replaySubmissions` and `replays` are deployed (ADR 0011).
   * Until then the replays stay on this device - nothing may write a
   * submission the rules would refuse.
   */
  replays?: boolean;
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
  private backend: {
    account: GameAccount;
    storage: GameStorage;
    rooms: GameRooms;
    social: GameSocial;
    presence: GamePresence | null;
    replays: GameReplays | null;
    boards: GameBoards;
    moderation: GameModeration;
    ranked: GameRanked;
  } | null = null;
  /** The replays on this device, one for all who ask. */
  private localReplays: GameReplays | null = null;
  /** Whether a service has asked already - a project comes too late then. */
  private asked = false;

  /**
   * Uses the project connected to, none for this device only. The same
   * project provided again (the admin area beside the game) is the same
   * connection: `provideFirebase` reuses its instances.
   */
  public use(connection: FirebaseConnection | null): void {
    if (this.asked && connection?.db !== this.connection?.db) {
      console.error(
        'The game cloud was set up after the game started - staying on this device.'
      );
      return;
    }
    this.connection = connection;
  }

  /**
   * The connection to the project, null without one - for the admin area,
   * which reads and writes the owner's collections itself. Unlike the
   * game's services it starts no backend.
   */
  public firebase(): FirebaseConnection | null {
    return this.connection;
  }

  /** The storage of whoever plays. */
  public storage(): GameStorage {
    return this.connected()?.storage ?? new LocalGameStorage();
  }

  /** Who plays. */
  public account(): GameAccount {
    return this.connected()?.account ?? new DeviceAccount();
  }

  /** Where online matches meet - null without a project, there are none then. */
  public rooms(): GameRooms | null {
    return this.connected()?.rooms ?? null;
  }

  /** Profiles, friends and matchmaking - null without a project. */
  public social(): GameSocial | null {
    return this.connected()?.social ?? null;
  }

  /** Who is online - null without a project or its Realtime Database. */
  public presence(): GamePresence | null {
    return this.connected()?.presence ?? null;
  }

  /** The leaderboards (ADR 0012) - null without a project. */
  public boards(): GameBoards | null {
    return this.connected()?.boards ?? null;
  }

  /**
   * The player's own ban and the owner's notices (ADR 0012) - null without
   * a project, where nobody is banned.
   */
  public moderation(): GameModeration | null {
    return this.connected()?.moderation ?? null;
  }

  /**
   * The declared attempts of ranked daily and endless matches (ADR 0012) -
   * null without a project, where nothing is ranked.
   */
  public ranked(): GameRanked | null {
    return this.connected()?.ranked ?? null;
  }

  /**
   * Where the recorded matches go: to the project once it takes them (see
   * {@link GameCloudOptions.replays}), else onto this device.
   */
  public replays(): GameReplays {
    const replays = this.connected()?.replays ?? null;
    if (replays !== null) {
      return replays;
    }
    this.localReplays ??= new LocalGameReplays(new LocalGameStorage());
    return this.localReplays;
  }

  /**
   * The owner's feature toggles: the project's Remote Config, the defaults
   * without a project. Starts none of the other backends - no sign-in -
   * and fetches nothing until watched. Keeps nothing itself: the
   * connection fetches Remote Config once, whoever asks.
   */
  public toggles(): GameToggles {
    this.asked = true;
    const { connection } = this;
    return connection === null
      ? new NoGameToggles()
      : new RemoteConfigGameToggles(() => connection.remoteConfig());
  }

  private connected() {
    this.asked = true;
    const { connection } = this;
    if (connection === null) {
      return null;
    }
    if (this.backend === null) {
      const account = new FirebaseGameAccount(connection);
      const moderation = new FirestoreGameModeration(
        connection,
        account.playerIds
      );
      // A ban refuses every write of the player's (ADR 0012): the storage
      // holds them until it ends, the replays send none meanwhile.
      const isBanned = banned(moderation.ban());
      this.backend = {
        account,
        storage: new FirestoreGameStorage(
          connection,
          account.playerIds,
          isBanned
        ),
        rooms: new FirestoreGameRooms(connection, account.playerIds),
        social: new FirestoreGameSocial(connection),
        presence:
          connection.rtdb == null
            ? null
            : new RtdbGamePresence(connection, connection.rtdb),
        replays:
          connection.replays === true
            ? new FirestoreGameReplays(connection, account.playerIds, isBanned)
            : null,
        boards: new FirestoreGameBoards(connection),
        moderation,
        ranked: new FirestoreGameRanked(connection, account.playerIds),
      };
    }
    return this.backend;
  }
}
