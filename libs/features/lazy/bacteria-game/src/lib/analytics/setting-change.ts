import type { StoredSettings } from '../settings.service';
import type { GameEvents } from './game-analytics';

/**
 * The settings players pick themselves. Not the match setup the menus keep
 * (level, mode, difficulty: the matches tell those), nor what the game
 * remembers for itself (`recordingHintShown`), nor the volumes, which a
 * slider changes many times in one go.
 */
export const REPORTED_SETTINGS: readonly (keyof StoredSettings)[] = [
  'sound',
  'music',
  'effects',
  'vibration',
  'language',
  'look',
  'colors',
  'simResolution',
  'screenResolution',
  'vaporize',
  'vaporizeMs',
  'ambience',
  'adaptiveQuality',
  'showFps',
  'freePlay',
  'recordLocal',
  'saveMatches',
  'ranked',
];

/** The change of `key` to report, null for a setting not reported. */
export function settingChange(
  key: keyof StoredSettings,
  settings: StoredSettings
): GameEvents['setting_changed'] | null {
  if (!REPORTED_SETTINGS.includes(key)) return null;
  return { setting: key, value: settingValue(settings[key]) };
}

function settingValue(value: unknown): string | number | boolean {
  if (value === undefined) return 'auto';
  if (Array.isArray(value)) return value.join('/');
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return JSON.stringify(value);
}
