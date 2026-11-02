import type { StoredSettings } from '../settings.service';
import type { GameEvents } from './game-analytics';

/**
 * The settings players pick themselves. Not the match setup the menus keep
 * (level, mode, difficulty, colours: the matches tell those, and restoring
 * it sets them again), nor what the game
 * remembers for itself (`recordingHintShown`), nor the volumes, which a
 * slider changes many times in one go.
 */
const REPORTED_SETTINGS: readonly (keyof StoredSettings)[] = [
  'sound',
  'music',
  'effects',
  'vibration',
  'language',
  'look',
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

/**
 * The change of `key` from `before` to `after` to report - null for a
 * setting not reported, or one set to the value it had.
 */
export function settingChange(
  key: keyof StoredSettings,
  before: StoredSettings,
  after: StoredSettings
): GameEvents['setting_changed'] | null {
  if (!REPORTED_SETTINGS.includes(key)) return null;
  const value = settingValue(after[key]);
  return value === settingValue(before[key]) ? null : { setting: key, value };
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
