import { TestBed } from '@angular/core/testing';
import {
  provideRecordingAnalytics,
  RecordingAnalytics,
} from '@wolsok/shared-analytics/testing';
import { LEVELS } from '@wolsok/feat-shared-bacteria-engine';
import {
  DEFAULT_EFFECTS_VOLUME,
  DEFAULT_MUSIC_VOLUME,
  GameSettingsService,
  SETTINGS_STORAGE_KEY,
  StoredSettings,
} from './settings.service';
import { I18nService } from './i18n/i18n.service';
import { GameStateService } from './state/game-state.service';
import { GameStateStore } from './state/game.states';
import { DeviceStorage } from './storage/game-storage';
import { LateGameStorage } from '../testing/late-game-storage';

/**
 * How the service ties the settings to the storage, the statistics and the
 * game. What each setting restores, ignores and stores is the table's
 * spec (`settings/device-settings.spec.ts`), the match setup's in
 * `settings/stored-match-setup.spec.ts`.
 */
describe('GameSettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  function stored(): Record<string, unknown> {
    return JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
  }

  it('restores the settings and the match setup an earlier visit stored', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mode: 'two-players',
        levelId: LEVELS[2].id,
        showFps: true,
        look: 'pixels',
      })
    );

    const service = TestBed.inject(GameSettingsService);
    const state = TestBed.inject(GameStateStore).snapshot();

    expect(state.mode).toBe('two-players');
    expect(state.levelId).toBe(LEVELS[2].id);
    expect(service.value('showFps')).toBe(true);
    expect(service.value('look')).toBe('pixels');
  });

  it('survives unreadable storage', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json');

    expect(() => TestBed.inject(GameSettingsService)).not.toThrow();
  });

  it('stores the device settings and the match setup in one entry', () => {
    const service = TestBed.inject(GameSettingsService);

    service.set('sound', false);
    TestBed.inject(GameStateService).setLevel(LEVELS[1].id);

    expect(stored()).toMatchObject({
      sound: false,
      levelId: LEVELS[1].id,
      mode: 'vs-computer',
      musicVolume: DEFAULT_MUSIC_VOLUME,
    });
    TestBed.resetTestingModule();
    expect(TestBed.inject(GameSettingsService).value('sound')).toBe(false);
  });

  it('leaves the settings without a value out of the stored entry', () => {
    const service = TestBed.inject(GameSettingsService);

    service.set('arena', LEVELS[3].id);
    expect(stored()['arena']).toBe(LEVELS[3].id);

    service.set('arena', null);
    expect(stored()).not.toHaveProperty('arena');
  });

  it('counts the settings the player changes, not the volumes or a value set again', () => {
    const analytics = new RecordingAnalytics();
    TestBed.configureTestingModule({
      providers: [provideRecordingAnalytics(analytics)],
    });
    const service = TestBed.inject(GameSettingsService);

    service.set('sound', false);
    // the same again: no change
    service.set('sound', false);
    service.set('language', 'de');
    service.set('language', null);
    service.set('musicVolume', 40);
    service.preview('effectsVolume', 10);
    TestBed.inject(GameStateService).setLevel(LEVELS[1].id);

    expect(analytics.tracked('setting_changed')).toEqual([
      { setting: 'sound', value: false },
      { setting: 'language', value: 'de' },
      { setting: 'language', value: 'auto' },
    ]);
  });

  it('previews a volume without writing it', () => {
    const service = TestBed.inject(GameSettingsService);

    service.preview('musicVolume', 20);
    service.preview('effectsVolume', 30);

    expect(service.value('musicVolume')).toBe(20);
    expect(service.value('effectsVolume')).toBe(30);
    expect(stored()).toMatchObject({
      musicVolume: DEFAULT_MUSIC_VOLUME,
      effectsVolume: DEFAULT_EFFECTS_VOLUME,
    });

    service.set('musicVolume', 25);
    expect(stored()).toMatchObject({ musicVolume: 25, effectsVolume: 30 });
  });

  it('follows the browser until the player picks a language, and speaks it', () => {
    const service = TestBed.inject(GameSettingsService);
    const i18n = TestBed.inject(I18nService);
    expect(service.value('language')).toBeNull();
    expect(i18n.language()).toBe('en');

    service.set('language', 'de');

    expect(i18n.language()).toBe('de');
    expect(stored()).toMatchObject({ language: 'de' });

    service.set('language', null);

    expect(i18n.language()).toBe('en');
    expect(stored()['language']).toBeUndefined();
  });

  it('speaks the restored language, and follows the browser for one it does not know', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ language: 'de' })
    );
    TestBed.inject(GameSettingsService);
    expect(TestBed.inject(I18nService).language()).toBe('de');

    TestBed.resetTestingModule();
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ language: 'klingon' })
    );
    const service = TestBed.inject(GameSettingsService);
    expect(service.value('language')).toBeNull();
    expect(TestBed.inject(I18nService).language()).toBe('en');
  });

  describe('with storage that answers late', () => {
    let storage: LateGameStorage;

    function createWith(stored: StoredSettings): GameSettingsService {
      storage = new LateGameStorage({ [SETTINGS_STORAGE_KEY]: stored });
      TestBed.configureTestingModule({
        providers: [{ provide: DeviceStorage, useValue: storage }],
      });
      return TestBed.inject(GameSettingsService);
    }

    it('keeps and records matches by default, and hands the stored choice to the game', () => {
      const service = createWith({ saveMatches: false, recordLocal: false });
      const prefs = jest.spyOn(
        TestBed.inject(GameStateService),
        'setReplayPrefs'
      );
      expect(service.value('saveMatches')).toBe(true);
      expect(service.value('recordLocal')).toBe(true);

      storage.flush();

      expect(service.value('saveMatches')).toBe(false);
      expect(service.value('recordLocal')).toBe(false);
      expect(prefs).toHaveBeenLastCalledWith({
        recordLocal: false,
        saveMatches: false,
      });
    });

    it('hands "Save my matches" to the game as switched before the storage answered', () => {
      const service = createWith({ saveMatches: true });
      const prefs = jest.spyOn(
        TestBed.inject(GameStateService),
        'setReplayPrefs'
      );

      service.set('saveMatches', false);
      expect(prefs).toHaveBeenLastCalledWith({ saveMatches: false });
      storage.flush();
      storage.flush();

      expect(service.value('saveMatches')).toBe(false);
      expect(storage.stored(SETTINGS_STORAGE_KEY)).toMatchObject({
        saveMatches: false,
        recordLocal: true,
      });
      expect(prefs).toHaveBeenLastCalledWith({
        recordLocal: true,
        saveMatches: false,
      });
    });

    it('says when the stored settings are read', () => {
      const service = createWith({ recordingHintShown: true });
      expect(service.loaded()).toBe(false);
      expect(service.value('recordingHintShown')).toBe(false);

      storage.flush();

      expect(service.loaded()).toBe(true);
      expect(service.value('recordingHintShown')).toBe(true);
    });

    it('does not overwrite the stored settings with the defaults meanwhile', () => {
      const service = createWith({ levelId: LEVELS[2].id, sound: false });

      service.set('showFps', true);
      storage.flush();
      storage.flush();

      expect(storage.stored(SETTINGS_STORAGE_KEY)).toMatchObject({
        levelId: LEVELS[2].id,
        sound: false,
        showFps: true,
      });
    });

    it('keeps what the player changed before the storage answered', () => {
      const service = createWith({
        sound: false,
        look: 'pixels',
        levelId: LEVELS[2].id,
      });

      service.set('sound', true);
      TestBed.inject(GameStateService).setLevel(LEVELS[3].id);
      storage.flush();
      storage.flush();

      expect(service.value('sound')).toBe(true);
      expect(service.value('look')).toBe('pixels');
      expect(storage.stored(SETTINGS_STORAGE_KEY)).toMatchObject({
        sound: true,
        look: 'pixels',
        levelId: LEVELS[3].id,
      });
    });

    it('stores the stored setup of a match under way while settings change', () => {
      const service = createWith({
        levelId: LEVELS[2].id,
        difficulty: 'hard',
        showFps: true,
      });
      const gameState = TestBed.inject(GameStateService);
      const store = TestBed.inject(GameStateStore);

      gameState.start();
      storage.flush();
      service.set('sound', false);
      storage.flush();

      expect(store.snapshot().levelId).toBe(LEVELS[0].id);
      expect(service.value('showFps')).toBe(true);
      expect(storage.stored(SETTINGS_STORAGE_KEY)).toMatchObject({
        levelId: LEVELS[2].id,
        difficulty: 'hard',
        sound: false,
      });

      gameState.reset();

      expect(store.snapshot().levelId).toBe(LEVELS[2].id);
    });

    it('stores the changes made after the settings were restored', () => {
      const service = createWith({ sound: false });
      storage.flush();

      service.set('music', false);
      storage.flush();

      expect(storage.stored(SETTINGS_STORAGE_KEY)).toMatchObject({
        sound: false,
        music: false,
      });
    });
  });
});
