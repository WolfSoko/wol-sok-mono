import { Injectable, inject, type Signal, signal } from '@angular/core';
import { isObject } from '@wolsok/feat-shared-bacteria-engine';
import { take } from 'rxjs';
import { injectGameAnalytics } from './analytics/game-analytics';
import { settingChange } from './analytics/setting-change';
import { I18nService } from './i18n/i18n.service';
import { DeviceSettings } from './settings/device-settings';
import {
  SETTINGS,
  type SettingKey,
  type SettingValues,
  type StoredDeviceSettings,
} from './settings/setting-table';
import {
  StoredMatchSetup,
  type StoredMatchSetupValues,
} from './settings/stored-match-setup';
import { GameStateService } from './state/game-state.service';
import { MatchRecorder } from './state/match-recorder';
import { GameStateStore } from './state/game.states';
import { DeviceStorage } from './storage/game-storage';

export {
  DEFAULT_EFFECTS_VOLUME,
  DEFAULT_MUSIC_VOLUME,
  MAX_VOLUME,
  type SettingKey,
  type SettingValues,
} from './settings/setting-table';

/** What the game remembers between visits: the device settings and the match setup. */
export type StoredSettings = StoredDeviceSettings & StoredMatchSetupValues;

export const SETTINGS_STORAGE_KEY = 'bacteria-game.settings';

/**
 * Keeps the player's choices across visits, in the storage of this device -
 * they stay with the device whoever signs in: the device settings of
 * `SETTINGS` (`settings/setting-table.ts`) and the match setup the game
 * state store keeps (`StoredMatchSetup`).
 *
 * The stored settings are restored once the storage answers and written
 * back whenever they change after that - never before, so the defaults the
 * game starts with cannot overwrite the stored settings. A setting the
 * player changed before the storage answered keeps the player's choice.
 * Storage that fails simply forgets them.
 */
@Injectable({ providedIn: 'root' })
export class GameSettingsService {
  private readonly gameState = inject(GameStateService);
  private readonly recorder = inject(MatchRecorder);
  private readonly storage = inject(DeviceStorage);
  private readonly i18n = inject(I18nService);
  private readonly analytics = injectGameAnalytics();
  private readonly settings = new DeviceSettings(SETTINGS);
  private readonly matchSetup = new StoredMatchSetup(
    this.gameState,
    inject(GameStateStore)
  );
  private readonly restored = signal(false);
  /**
   * True once the stored settings are read: before that a setting holds
   * its default, not what an earlier visit stored.
   */
  public readonly loaded: Signal<boolean> = this.restored.asReadonly();
  /**
   * The settings the statistics last saw, so setting the value in force
   * again (a menu that sets free play on every visit) counts as no change.
   */
  private reported = this.settings.toStore();

  public constructor() {
    this.matchSetup.changes$.subscribe(() => this.persistOnceRestored());
    this.storage
      .watch(SETTINGS_STORAGE_KEY)
      .pipe(take(1))
      .subscribe((stored) => this.restore(isObject(stored) ? stored : {}));
  }

  /** The setting's value, read like a signal. */
  public value<K extends SettingKey>(key: K): SettingValues[K] {
    return this.settings.value(key);
  }

  /** The player's choice: in force at once, kept and counted. */
  public set<K extends SettingKey>(key: K, value: SettingValues[K]): void {
    this.settings.set(key, value);
    this.applyToGame(key);
    const settings = this.settings.toStore();
    this.report(key, settings);
    this.persistOnceRestored(settings);
  }

  /**
   * A value while its control is still being moved (a volume slider
   * dragged): in force at once, but neither stored nor counted until `set`.
   */
  public preview<K extends SettingKey>(key: K, value: SettingValues[K]): void {
    this.settings.preview(key, value);
    this.applyToGame(key);
  }

  private restore(stored: Readonly<Record<string, unknown>>): void {
    this.matchSetup.restore(stored);
    this.settings.restore(stored);
    this.syncReplayPrefs();
    this.syncLanguage();
    this.reported = this.settings.toStore();
    this.restored.set(true);
    this.persist();
  }

  /** Hands a setting the rest of the game keeps a copy of on to it. */
  private applyToGame(key: SettingKey): void {
    if (key === 'recordLocal' || key === 'saveMatches') {
      this.syncReplayPrefs();
    } else if (key === 'language') {
      this.syncLanguage();
    }
  }

  /** Hands what the player set about recording to the recorder. */
  private syncReplayPrefs(): void {
    this.recorder.setPrefs({
      recordLocal: this.value('recordLocal'),
      saveMatches: this.value('saveMatches'),
    });
  }

  private syncLanguage(): void {
    this.i18n.setLanguage(this.value('language'));
  }

  private report(key: SettingKey, settings: StoredDeviceSettings): void {
    const before = this.reported;
    this.reported = settings;
    const change = settingChange(key, before, settings);
    if (change !== null) {
      this.analytics.track('setting_changed', change);
    }
  }

  private persistOnceRestored(settings = this.settings.toStore()): void {
    if (this.restored()) {
      this.persist(settings);
    }
  }

  private persist(settings = this.settings.toStore()): void {
    const stored: StoredSettings = {
      ...this.matchSetup.toStore(),
      ...settings,
    };
    this.storage.write(SETTINGS_STORAGE_KEY, stored);
  }
}
