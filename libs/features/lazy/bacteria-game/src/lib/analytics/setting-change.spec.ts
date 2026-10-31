import type { StoredSettings } from '../settings.service';
import { settingChange } from './setting-change';

describe('settingChange', () => {
  const settings: StoredSettings = {
    sound: false,
    language: undefined,
    colors: ['orange', 'blue'],
    vaporizeMs: 900,
    levelId: 'petri-1',
    recordingHintShown: true,
  };

  it.each([
    ['sound', false],
    ['language', 'auto'],
    ['colors', 'orange/blue'],
    ['vaporizeMs', 900],
  ] as const)('reports %s as %p', (setting, value) => {
    expect(settingChange(setting, settings)).toEqual({ setting, value });
  });

  it.each(['levelId', 'recordingHintShown', 'musicVolume'] as const)(
    'leaves %s out',
    (setting) => {
      expect(settingChange(setting, settings)).toBeNull();
    }
  );
});
