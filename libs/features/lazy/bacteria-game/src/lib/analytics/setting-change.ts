import {
  SETTINGS,
  type SettingKey,
  type StoredDeviceSettings,
} from '../settings/setting-table';
import type { GameEvents } from './game-analytics';

/**
 * The change of `key` from `before` to `after` to report - null for a
 * setting the table does not mark `reported` (the volumes, which a slider
 * changes many times in one go, and what the game remembers for itself),
 * or one set to the value it had.
 */
export function settingChange(
  key: SettingKey,
  before: StoredDeviceSettings,
  after: StoredDeviceSettings
): GameEvents['setting_changed'] | null {
  const spec: { reported?: boolean } = SETTINGS[key];
  if (!spec.reported) return null;
  const value = after[key] ?? 'auto';
  return value === (before[key] ?? 'auto') ? null : { setting: key, value };
}
