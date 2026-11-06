import { TestBed } from '@angular/core/testing';
import {
  LEVELS,
  MATCH_LEVELS,
  playableOnline,
} from '@wolsok/feat-shared-bacteria-engine';
import { DeviceSettings } from './device-settings';
import { SETTINGS, type SettingKey, type SettingValues } from './setting-table';

/**
 * A stored value each setting reads back (not its default) and one it
 * ignores - every key of the table needs both, or this fails to compile.
 */
const SAMPLES: {
  [K in SettingKey]: {
    valid: Exclude<SettingValues[K], null>;
    invalid: unknown;
  };
} = {
  showFps: { valid: true, invalid: 'yes' },
  freePlay: { valid: true, invalid: 1 },
  arena: { valid: LEVELS[3].id, invalid: 'moon' },
  sound: { valid: false, invalid: 'off' },
  music: { valid: false, invalid: null },
  effects: { valid: false, invalid: 0 },
  musicVolume: { valid: 35, invalid: 'loud' },
  effectsVolume: { valid: 100, invalid: 250 },
  vibration: { valid: false, invalid: 'no' },
  look: { valid: 'pixels', invalid: 'smoke' },
  simResolution: { valid: 'high', invalid: '8k' },
  screenResolution: { valid: 'full-hd', invalid: 42 },
  vaporize: { valid: 'off', invalid: 'ultra' },
  vaporizeMs: { valid: 5000, invalid: 1234 },
  ambience: { valid: false, invalid: 'none' },
  adaptiveQuality: { valid: false, invalid: [] },
  language: { valid: 'de', invalid: 'klingon' },
  matchLevel: {
    valid: MATCH_LEVELS[1].id,
    invalid: LEVELS.find((level) => !playableOnline(level))?.id ?? 'moon',
  },
  recordLocal: { valid: false, invalid: 'never' },
  saveMatches: { valid: false, invalid: {} },
  ranked: { valid: false, invalid: 'practice' },
  recordingHintShown: { valid: true, invalid: 'once' },
};

const KEYS = Object.keys(SETTINGS) as SettingKey[];

describe('DeviceSettings', () => {
  let settings: DeviceSettings<typeof SETTINGS>;

  beforeEach(() => {
    settings = TestBed.runInInjectionContext(
      () => new DeviceSettings(SETTINGS)
    );
  });

  it.each(KEYS)('starts %s at its default', (key) => {
    expect(settings.value(key)).toEqual(SETTINGS[key].default);
  });

  it.each(KEYS)('restores %s from what an earlier visit stored', (key) => {
    settings.restore({ [key]: SAMPLES[key].valid });

    expect(settings.value(key)).toEqual(SAMPLES[key].valid);
  });

  it.each(KEYS)('ignores a stored %s it cannot read', (key) => {
    settings.restore({ [key]: SAMPLES[key].invalid });

    expect(settings.value(key)).toEqual(SETTINGS[key].default);
  });

  it.each(KEYS)('keeps %s as the player set it before the restore', (key) => {
    const chosen = SETTINGS[key].default as never;
    settings.set(key, chosen);

    settings.restore({ [key]: SAMPLES[key].valid });

    expect(settings.value(key)).toEqual(chosen);
  });

  it.each(KEYS)('stores %s as it is set', (key) => {
    settings.set(key, SAMPLES[key].valid as never);

    expect(settings.toStore()[key]).toEqual(SAMPLES[key].valid);
  });

  it('leaves the settings without a value out of the stored form', () => {
    expect(settings.toStore()).not.toHaveProperty('arena', expect.anything());
    expect(settings.toStore().language).toBeUndefined();
    expect(settings.toStore().matchLevel).toBeUndefined();
  });

  it('restores the stored form as it was stored', () => {
    KEYS.forEach((key) => settings.set(key, SAMPLES[key].valid as never));
    const stored = JSON.parse(JSON.stringify(settings.toStore()));

    const next = TestBed.runInInjectionContext(
      () => new DeviceSettings(SETTINGS)
    );
    next.restore(stored);

    expect(next.toStore()).toEqual(settings.toStore());
  });

  it('lets a restore replace a previewed value, which the player did not choose yet', () => {
    settings.preview('musicVolume', 20);
    expect(settings.value('musicVolume')).toBe(20);

    settings.restore({ musicVolume: 35 });

    expect(settings.value('musicVolume')).toBe(35);
  });

  it('brings a value into range as it is set or previewed', () => {
    settings.set('musicVolume', 140);
    expect(settings.value('musicVolume')).toBe(100);

    settings.preview('effectsVolume', -3);
    expect(settings.value('effectsVolume')).toBe(0);
  });
});
