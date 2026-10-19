import { TestBed } from '@angular/core/testing';
import {
  GameSettingsService,
  SETTINGS_STORAGE_KEY,
  StoredSettings,
} from './settings.service';
import { GameStateQuery } from './state/game-state.query';
import { GameStateService } from './state/game-state.service';
import { LEVELS } from './state/levels';
import { GameStorage } from './storage/game-storage';
import { LateGameStorage } from '../testing/late-game-storage';

describe('GameSettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  function stored(): Record<string, unknown> {
    return JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
  }

  it('restores what an earlier visit chose', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: 'two-players',
        difficulty: 'hard',
        levelId: LEVELS[2].id,
        showFps: true,
      })
    );

    const service = TestBed.inject(GameSettingsService);
    const state = TestBed.inject(GameStateQuery).getValue();

    expect(state.mode).toBe('two-players');
    expect(state.difficulty).toBe('hard');
    expect(state.levelId).toBe(LEVELS[2].id);
    expect(service.showFps()).toBe(true);
  });

  it('ignores values it does not know', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: 'four-players', levelId: 'moon', showFps: 'yes' })
    );

    const service = TestBed.inject(GameSettingsService);
    const state = TestBed.inject(GameStateQuery).getValue();

    expect(state.mode).toBe('vs-computer');
    expect(state.levelId).toBe(LEVELS[0].id);
    expect(service.showFps()).toBe(false);
  });

  it('survives unreadable storage', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json');

    expect(() => TestBed.inject(GameSettingsService)).not.toThrow();
  });

  it('remembers a changed match setup', () => {
    TestBed.inject(GameSettingsService);

    TestBed.inject(GameStateService).setMode('two-players');
    TestBed.inject(GameStateService).setLevel(LEVELS[1].id);

    expect(stored()).toMatchObject({
      mode: 'two-players',
      levelId: LEVELS[1].id,
    });
  });

  it('remembers the frame rate badge', () => {
    const service = TestBed.inject(GameSettingsService);

    service.setShowFps(true);

    expect(stored().showFps).toBe(true);
  });

  it('remembers free play, with the campaign ladder by default', () => {
    const service = TestBed.inject(GameSettingsService);
    expect(service.freePlay()).toBe(false);

    service.setFreePlay(true);

    expect(stored().freePlay).toBe(true);
    TestBed.resetTestingModule();
    expect(TestBed.inject(GameSettingsService).freePlay()).toBe(true);
  });

  it('makes sound unless an earlier visit muted it', () => {
    expect(TestBed.inject(GameSettingsService).sound()).toBe(true);
  });

  it('remembers a muted game', () => {
    const service = TestBed.inject(GameSettingsService);

    service.setSound(false);

    expect(stored().sound).toBe(false);
    TestBed.resetTestingModule();
    expect(TestBed.inject(GameSettingsService).sound()).toBe(false);
  });

  it('remembers music switched off, with the sound still on', () => {
    const service = TestBed.inject(GameSettingsService);

    expect(service.music()).toBe(true);
    service.setMusic(false);

    expect(stored().music).toBe(false);
    TestBed.resetTestingModule();
    const restored = TestBed.inject(GameSettingsService);
    expect(restored.music()).toBe(false);
    expect(restored.sound()).toBe(true);
  });

  it('remembers the colours and the look of the bacteria', () => {
    const service = TestBed.inject(GameSettingsService);

    TestBed.inject(GameStateService).setColor(0, 'purple');
    service.setLook('pixels');

    expect(stored()).toMatchObject({
      colors: ['purple', 'blue'],
      look: 'pixels',
    });
    TestBed.resetTestingModule();
    expect(TestBed.inject(GameSettingsService).look()).toBe('pixels');
    expect(TestBed.inject(GameStateQuery).getValue().colors).toEqual([
      'purple',
      'blue',
    ]);
  });

  it('draws slime unless told otherwise, and ignores colours it does not know', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ colors: ['gold', 'blue'], look: 'smoke' })
    );

    const service = TestBed.inject(GameSettingsService);

    expect(service.look()).toBe('slime');
    expect(TestBed.inject(GameStateQuery).getValue().colors).toEqual([
      'orange',
      'blue',
    ]);
  });

  it('remembers both resolutions', () => {
    const service = TestBed.inject(GameSettingsService);

    service.setSimResolution('high');
    service.setScreenResolution('full-hd');

    expect(stored()).toMatchObject({
      simResolution: 'high',
      screenResolution: 'full-hd',
    });
    TestBed.resetTestingModule();
    const restored = TestBed.inject(GameSettingsService);
    expect(restored.simResolution()).toBe('high');
    expect(restored.screenResolution()).toBe('full-hd');
  });

  it('falls back to the default resolutions for ones it does not know', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ simResolution: '8k', screenResolution: 42 })
    );

    const service = TestBed.inject(GameSettingsService);

    expect(service.simResolution()).toBe('normal');
    expect(service.screenResolution()).toBe('medium');
  });

  describe('with storage that answers late', () => {
    let storage: LateGameStorage;

    function createWith(stored: StoredSettings): GameSettingsService {
      storage = new LateGameStorage({ [SETTINGS_STORAGE_KEY]: stored });
      TestBed.configureTestingModule({
        providers: [{ provide: GameStorage, useValue: storage }],
      });
      return TestBed.inject(GameSettingsService);
    }

    it('restores the settings once the storage answers', () => {
      const service = createWith({ levelId: LEVELS[2].id, sound: false });
      expect(service.sound()).toBe(true);

      storage.flush();

      expect(service.sound()).toBe(false);
      expect(TestBed.inject(GameStateQuery).getValue().levelId).toBe(
        LEVELS[2].id
      );
    });

    it('does not overwrite the stored settings with the defaults meanwhile', () => {
      const service = createWith({ levelId: LEVELS[2].id, sound: false });

      service.setShowFps(true);
      storage.flush();
      storage.flush();

      expect(storage.stored(SETTINGS_STORAGE_KEY)).toMatchObject({
        levelId: LEVELS[2].id,
        sound: false,
      });
    });

    it('keeps what the player changed before the storage answered', () => {
      const service = createWith({
        sound: false,
        look: 'pixels',
        levelId: LEVELS[2].id,
      });

      service.setSound(true);
      TestBed.inject(GameStateService).setLevel(LEVELS[3].id);
      storage.flush();
      storage.flush();

      expect(service.sound()).toBe(true);
      expect(service.look()).toBe('pixels');
      expect(TestBed.inject(GameStateQuery).getValue().levelId).toBe(
        LEVELS[3].id
      );
      expect(storage.stored(SETTINGS_STORAGE_KEY)).toMatchObject({
        sound: true,
        look: 'pixels',
        levelId: LEVELS[3].id,
      });
    });

    it('keeps the stored setup of a match under way for the next one', () => {
      const service = createWith({
        levelId: LEVELS[2].id,
        difficulty: 'hard',
        showFps: true,
      });
      const gameState = TestBed.inject(GameStateService);
      const query = TestBed.inject(GameStateQuery);

      gameState.start();
      storage.flush();
      service.setSound(false);
      storage.flush();

      expect(query.getValue().levelId).toBe(LEVELS[0].id);
      expect(query.getValue().difficulty).toBe('normal');
      expect(service.showFps()).toBe(true);
      expect(storage.stored(SETTINGS_STORAGE_KEY)).toMatchObject({
        levelId: LEVELS[2].id,
        difficulty: 'hard',
        sound: false,
      });

      gameState.reset();

      expect(query.getValue().levelId).toBe(LEVELS[2].id);
      expect(query.getValue().difficulty).toBe('hard');
    });

    it('drops the stored setup the player changed during the match', () => {
      createWith({ levelId: LEVELS[2].id, difficulty: 'hard' });
      const gameState = TestBed.inject(GameStateService);
      const query = TestBed.inject(GameStateQuery);

      gameState.start();
      storage.flush();
      gameState.setLevel(LEVELS[4].id);
      gameState.reset();
      storage.flush();

      expect(query.getValue().levelId).toBe(LEVELS[4].id);
      expect(query.getValue().difficulty).toBe('hard');
      expect(storage.stored(SETTINGS_STORAGE_KEY)).toMatchObject({
        levelId: LEVELS[4].id,
        difficulty: 'hard',
      });
    });

    it('stores the changes made after the settings were restored', () => {
      const service = createWith({ sound: false });
      storage.flush();

      service.setMusic(false);
      storage.flush();

      expect(storage.stored(SETTINGS_STORAGE_KEY)).toMatchObject({
        sound: false,
        music: false,
      });
    });
  });
});
