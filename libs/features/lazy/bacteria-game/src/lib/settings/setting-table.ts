import {
  BacteriaLook,
  clamp,
  DEFAULT_SCREEN_RESOLUTION,
  DEFAULT_SIM_RESOLUTION,
  isBacteriaLook,
  isLanguage,
  isLevelId,
  isMatchLevel,
  Language,
  SCREEN_RESOLUTIONS,
  ScreenResolution,
  SIM_RESOLUTIONS,
  SimResolution,
} from '@wolsok/feat-shared-bacteria-engine';
import {
  DEFAULT_VAPORIZE_MS,
  DEFAULT_VAPORIZE_QUALITY,
  isVaporizeMs,
  isVaporizeQuality,
  VaporizeQuality,
} from '../vaporize-effect';

/** The volume sliders run from 0 to this. */
export const MAX_VOLUME = 100;
export const DEFAULT_MUSIC_VOLUME = 70;
export const DEFAULT_EFFECTS_VOLUME = 80;

/** One device setting: what it starts as and how it is read back. */
export interface SettingSpec<T> {
  readonly default: T;
  /** The value a stored entry stands for, undefined for one it cannot read. */
  parse(stored: unknown): T | undefined;
  /** Brings a value the player set into range; absent where any value goes. */
  normalize?(value: T): T;
  /** True where the statistics count the player's changes of it. */
  readonly reported?: boolean;
}

/**
 * The settings the game remembers on this device, whoever signs in - one
 * entry each. `null` stands for "none", "any" or "automatic" and is stored
 * as absent. The match setup is not among them (`StoredMatchSetup`).
 */
export const SETTINGS = {
  /** Whether the frame rate badge is shown on the arena. */
  showFps: flag(false, { reported: true }),
  /** Every level open against the computer, instead of the campaign ladder. */
  freePlay: flag(false, { reported: true }),
  /**
   * The level whose arena every level is drawn in, null for each its own -
   * as chosen. Only an arena the player has earned is drawn
   * (CampaignService.activeArena).
   */
  arena: setting<string | null>(null, (stored) =>
    isLevelId(stored) ? stored : undefined
  ),
  /** Whether the game makes sound. */
  sound: flag(true, { reported: true }),
  /** Whether the levels play their music - under the sound switch. */
  music: flag(true, { reported: true }),
  /** Whether the sound effects play - under the sound switch. */
  effects: flag(true, { reported: true }),
  /** How loud the music plays, from 0 to {@link MAX_VOLUME}. */
  musicVolume: volume(DEFAULT_MUSIC_VOLUME),
  /** How loud the sound effects play, from 0 to {@link MAX_VOLUME}. */
  effectsVolume: volume(DEFAULT_EFFECTS_VOLUME),
  /** Whether the phone vibrates with the match, where it can. */
  vibration: flag(true, { reported: true }),
  /** How the bacteria are drawn. */
  look: setting<BacteriaLook>(
    'slime',
    (stored) => (isBacteriaLook(stored) ? stored : undefined),
    { reported: true }
  ),
  /** How finely the war is simulated - the arena's size in cells. */
  simResolution: setting<SimResolution>(
    DEFAULT_SIM_RESOLUTION,
    (stored) => SIM_RESOLUTIONS.find((option) => option.id === stored)?.id,
    { reported: true }
  ),
  /** How many pixels the arena is drawn with. */
  screenResolution: setting<ScreenResolution>(
    DEFAULT_SCREEN_RESOLUTION,
    (stored) => SCREEN_RESOLUTIONS.find((option) => option.id === stored)?.id,
    { reported: true }
  ),
  /** How finely the arena turns to dust once a match is left, or 'off'. */
  vaporize: setting<VaporizeQuality>(
    DEFAULT_VAPORIZE_QUALITY,
    (stored) => (isVaporizeQuality(stored) ? stored : undefined),
    { reported: true }
  ),
  /** How long the arena takes to blow away, in ms. */
  vaporizeMs: setting<number>(
    DEFAULT_VAPORIZE_MS,
    (stored) => (isVaporizeMs(stored) ? stored : undefined),
    { reported: true }
  ),
  /** Whether bubbles rise and mist drifts through the dish. */
  ambience: flag(true, { reported: true }),
  /**
   * Whether a device too slow for every pixel of the arena paints it with
   * fewer, scaled up - steady frames before sharp ones.
   */
  adaptiveQuality: flag(true, { reported: true }),
  /** The language the player picked, null to follow the browser. */
  language: setting<Language | null>(
    null,
    (stored) => (isLanguage(stored) ? stored : undefined),
    { reported: true }
  ),
  /** The level the matchmaking asks for, null for any level. */
  matchLevel: setting<string | null>(
    null,
    (stored) => (isMatchLevel(stored) ? stored : undefined),
    { normalize: (levelId) => (isMatchLevel(levelId) ? levelId : null) }
  ),
  /**
   * Whether local matches against the computer are recorded, on every
   * simulation resolution (ADR 0011). On by default (the owner's decision
   * of 2026-10-23). A recorded match plays on a ruleset: the integer GPU
   * passes where the GPU passed the self-test and the deterministic
   * simulation is on, the CPU's else.
   */
  recordLocal: flag(true, { reported: true }),
  /**
   * Whether recorded local matches are kept, "Save my matches" - online
   * matches are kept either way (ADR 0012).
   */
  saveMatches: flag(true, { reported: true }),
  /**
   * Whether daily matches and endless runs are played ranked where ranked
   * play is offered (ADR 0012, on by default) - false for practice, with
   * the player's own setup.
   */
  ranked: flag(true, { reported: true }),
  /**
   * Whether the result screen told, once, that matches against the
   * computer are saved in My matches and where to turn that off - something
   * the game remembers for itself, so not reported.
   */
  recordingHintShown: flag(false),
} satisfies Record<string, SettingSpec<unknown>>;

export type DeviceSettingsTable = typeof SETTINGS;
export type SettingKey = keyof DeviceSettingsTable;
/** The value type of each setting. */
export type SettingValues = {
  [K in SettingKey]: DeviceSettingsTable[K]['default'];
};
/** The settings as they are stored: `null` ones absent. */
export type StoredDeviceSettings = {
  [K in SettingKey]?: Exclude<SettingValues[K], null>;
};

/** True for a whole number from 0 to {@link MAX_VOLUME}. */
export function isVolume(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_VOLUME
  );
}

/** A whole number on the slider - or the fallback for what is no number. */
export function clampVolume(volume: number, fallback: number): number {
  return Number.isFinite(volume)
    ? Math.round(clamp(volume, 0, MAX_VOLUME))
    : fallback;
}

type SettingOptions<T> = Pick<SettingSpec<T>, 'normalize' | 'reported'>;

function setting<T>(
  defaultValue: T,
  parse: (stored: unknown) => T | undefined,
  options: SettingOptions<T> = {}
): SettingSpec<T> {
  return { default: defaultValue, parse, ...options };
}

function flag(
  defaultValue: boolean,
  options: SettingOptions<boolean> = {}
): SettingSpec<boolean> {
  return setting(
    defaultValue,
    (stored) => (typeof stored === 'boolean' ? stored : undefined),
    options
  );
}

/** A slider volume; not reported, since a slider changes it many times in one go. */
function volume(defaultValue: number): SettingSpec<number> {
  return setting(
    defaultValue,
    (stored) => (isVolume(stored) ? stored : undefined),
    { normalize: (value) => clampVolume(value, defaultValue) }
  );
}
