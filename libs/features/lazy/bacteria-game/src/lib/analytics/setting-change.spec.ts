import type { StoredSettings } from '../settings.service';
import { settingChange } from './setting-change';

describe('settingChange', () => {
  const before: StoredSettings = {
    sound: true,
    language: 'de',
    look: 'slime',
    vaporizeMs: 600,
  };
  const settings: StoredSettings = {
    sound: false,
    language: undefined,
    look: 'slime',
    colors: ['orange', 'blue'],
    vaporizeMs: 900,
    levelId: 'petri-1',
    recordingHintShown: true,
  };

  it.each([
    ['sound', false],
    ['language', 'auto'],
    ['vaporizeMs', 900],
  ] as const)('reports %s as %p', (setting, value) => {
    expect(settingChange(setting, before, settings)).toEqual({
      setting,
      value,
    });
  });

  it('reports no setting set to the value it had', () => {
    expect(settingChange('look', before, settings)).toBeNull();
  });

  it.each(['levelId', 'colors', 'recordingHintShown', 'musicVolume'] as const)(
    'leaves %s out',
    (setting) => {
      expect(settingChange(setting, before, settings)).toBeNull();
    }
  );
});
