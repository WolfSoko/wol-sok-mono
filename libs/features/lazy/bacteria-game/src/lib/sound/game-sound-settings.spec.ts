import { TestBed } from '@angular/core/testing';
import { GameSettingsService, MAX_VOLUME } from '../settings.service';
import { soundSettingsOf } from './game-sound-settings';
import { GameSoundService } from './game-sound.service';

describe('soundSettingsOf', () => {
  let settings: GameSettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    settings = TestBed.inject(GameSettingsService);
  });

  it('reads each switch as the settings hold it', () => {
    const sound = soundSettingsOf(settings);
    settings.set('sound', false);
    settings.set('music', true);
    settings.set('effects', false);

    expect(sound.sound()).toBe(false);
    expect(sound.music()).toBe(true);
    expect(sound.effects()).toBe(false);

    settings.set('sound', true);
    settings.set('music', false);
    settings.set('effects', true);

    expect(sound.sound()).toBe(true);
    expect(sound.music()).toBe(false);
    expect(sound.effects()).toBe(true);
  });

  it('turns each volume into a fraction of the full volume', () => {
    const sound = soundSettingsOf(settings);
    settings.set('musicVolume', MAX_VOLUME / 4);
    settings.set('effectsVolume', MAX_VOLUME);

    expect(sound.musicVolume()).toBe(0.25);
    expect(sound.effectsVolume()).toBe(1);

    settings.preview('musicVolume', 0);

    expect(sound.musicVolume()).toBe(0);
  });
});

describe('GameSoundService', () => {
  it('follows the sound settings of the device', () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    const settings = TestBed.inject(GameSettingsService);
    const sound = TestBed.inject(GameSoundService);

    settings.set('effectsVolume', MAX_VOLUME);
    const full = sound.effectsGain();
    settings.set('effectsVolume', MAX_VOLUME / 2);
    const half = sound.effectsGain();
    settings.set('sound', false);

    expect(full).toBe(1);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(sound.effectsGain()).toBe(0);
  });
});
