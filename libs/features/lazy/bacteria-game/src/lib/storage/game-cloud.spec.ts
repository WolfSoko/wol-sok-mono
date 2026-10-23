import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DeviceAccount } from './device-account';
import { FirebaseGameAccount } from './firebase-game-account';
import { FirestoreGameStorage } from './firestore-game-storage';
import { GameAccount } from './game-account';
import type { FirebaseConnection } from './firebase-connection';
import { GameCloud } from './game-cloud';
import { GameStorage } from './game-storage';
import { LocalGameStorage } from './local-game-storage';
import { GameReplays } from './game-replays';
import { LocalGameReplays } from './local-game-replays';
import { FirestoreGameReplays } from './firestore-game-replays';

/** A project nobody signs in to - just enough to set the backend up. */
const CONNECTION = {
  auth: {},
  db: {},
  authSdk: { onAuthStateChanged: () => () => undefined },
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
});
