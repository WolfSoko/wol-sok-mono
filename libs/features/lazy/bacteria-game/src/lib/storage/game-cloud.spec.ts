import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DeviceAccount } from './device-account';
import { FirebaseGameAccount } from './firebase-game-account';
import { FirestoreGameBoards } from './firestore-game-boards';
import { FirestoreGameStorage } from './firestore-game-storage';
import { GameAccount } from './game-account';
import type { FirebaseConnection } from './firebase-connection';
import { GameCloud } from './game-cloud';
import { GameStorage } from './game-storage';
import { LocalGameStorage } from './local-game-storage';
import { GameReplays } from './game-replays';
import { LocalGameReplays } from './local-game-replays';
import { FirestoreGameReplays } from './firestore-game-replays';
import { GameToggles } from './game-toggles';
import { NoGameToggles } from './no-game-toggles';
import { RemoteConfigGameToggles } from './remote-config-game-toggles';

/** A project nobody signs in to - just enough to set the backend up. */
const CONNECTION = {
  auth: {},
  db: {},
  authSdk: {
    onAuthStateChanged: () => () => undefined,
    onIdTokenChanged: () => () => undefined,
  },
} as unknown as FirebaseConnection;

describe('GameCloud', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('keeps everything on this device without a project', async () => {
    expect(TestBed.inject(GameStorage)).toBeInstanceOf(LocalGameStorage);
    const account = TestBed.inject(GameAccount);
    expect(account).toBeInstanceOf(DeviceAccount);
    expect(account.cloud).toBe(false);
    expect(await firstValueFrom(account.players)).toEqual({
      playerId: 'device',
      adoptsGuest: false,
    });
  });

  it('keeps the progress in the project once one is named', () => {
    TestBed.inject(GameCloud).use(CONNECTION);

    expect(TestBed.inject(GameStorage)).toBeInstanceOf(FirestoreGameStorage);
    expect(TestBed.inject(GameAccount)).toBeInstanceOf(FirebaseGameAccount);
  });

  it('stays on this device when the project comes after the game started', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.inject(GameStorage);

    TestBed.inject(GameCloud).use(CONNECTION);

    expect(TestBed.inject(GameAccount)).toBeInstanceOf(DeviceAccount);
  });

  it('takes the same project again, from the admin area beside the game', () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    // The test before left its calls on the same spy.
    error.mockClear();
    const cloud = TestBed.inject(GameCloud);
    cloud.use(CONNECTION);
    TestBed.inject(GameStorage);

    cloud.use({ ...CONNECTION });

    expect(error).not.toHaveBeenCalled();
    expect(cloud.firebase()?.db).toBe(CONNECTION.db);
    expect(TestBed.inject(GameAccount)).toBeInstanceOf(FirebaseGameAccount);
  });

  it('reads the leaderboards from the project, none without one', () => {
    expect(TestBed.inject(GameCloud).boards()).toBeNull();

    TestBed.resetTestingModule();
    const cloud = TestBed.inject(GameCloud);
    cloud.use(CONNECTION);

    expect(cloud.boards()).toBeInstanceOf(FirestoreGameBoards);
    expect(cloud.boards()).toBe(cloud.boards());
  });

  it('hands the admin area no connection without a project', () => {
    expect(TestBed.inject(GameCloud).firebase()).toBeNull();
  });

  describe('replays', () => {
    it('stay on this device without a project', () => {
      expect(TestBed.inject(GameReplays)).toBeInstanceOf(LocalGameReplays);
    });

    it('stay on this device while the project takes none', () => {
      TestBed.inject(GameCloud).use(CONNECTION);

      expect(TestBed.inject(GameReplays)).toBeInstanceOf(LocalGameReplays);
    });

    it('go to the project once it takes them', () => {
      TestBed.inject(GameCloud).use({ ...CONNECTION, replays: true });

      expect(TestBed.inject(GameReplays)).toBeInstanceOf(FirestoreGameReplays);
    });
  });

  describe('toggles', () => {
    it('are the defaults without a project', async () => {
      const toggles = TestBed.inject(GameToggles);

      expect(toggles).toBeInstanceOf(NoGameToggles);
      expect(await firstValueFrom(toggles.watch())).toEqual({});
    });

    it("come from the project's Remote Config, fetched once watched, without signing anyone in", async () => {
      const remoteConfig = jest.fn(async () => null);
      const onAuthStateChanged = jest.fn(() => () => undefined);
      TestBed.inject(GameCloud).use({
        ...CONNECTION,
        authSdk: { ...CONNECTION.authSdk, onAuthStateChanged },
        remoteConfig,
      } as unknown as FirebaseConnection);

      const toggles = TestBed.inject(GameToggles);
      expect(toggles).toBeInstanceOf(RemoteConfigGameToggles);
      expect(remoteConfig).not.toHaveBeenCalled();

      expect(await firstValueFrom(toggles.watch())).toEqual({});
      expect(remoteConfig).toHaveBeenCalledTimes(1);
      expect(onAuthStateChanged).not.toHaveBeenCalled();
    });
  });
});
