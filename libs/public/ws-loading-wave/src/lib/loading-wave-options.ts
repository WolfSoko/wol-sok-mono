import { InjectionToken, Provider } from '@angular/core';

/** what the dots do once loading ended */
export type AfterLoading = 'hide' | 'keep';

/** which renderer draws the wave */
export type WaveRendererPreference = 'auto' | 'webgl' | 'canvas';

export interface LoadingWaveOptions {
  /**
   * `'hide'`: dots and wave fade out and the effect is removed.
   * `'keep'`: the wave fades out, the dots stay as a quiet background.
   */
  readonly afterLoading: AfterLoading;
  /** distance between two dots, in CSS pixels */
  readonly dotSpacing: number;
  /** diameter of a dot at rest, in CSS pixels */
  readonly dotSize: number;
  /** any CSS colour; unset, the dots take the host's `currentColor` */
  readonly color?: string;
  /** how long one sweep of the wave across the element takes, in ms */
  readonly sweepMs: number;
  /**
   * `'auto'` draws with a WebGL2 shader on a GPU, `'webgl'` also where the
   * browser renders WebGL in software; both fall back to a 2D canvas where
   * that fails. `'canvas'` never uses WebGL.
   */
  readonly renderer: WaveRendererPreference;
}

export const DEFAULT_LOADING_WAVE_OPTIONS: LoadingWaveOptions = {
  afterLoading: 'hide',
  dotSpacing: 28,
  dotSize: 1.5,
  sweepMs: 1600,
  renderer: 'auto',
};

export const LOADING_WAVE_OPTIONS = new InjectionToken<LoadingWaveOptions>(
  'LOADING_WAVE_OPTIONS',
  { providedIn: 'root', factory: () => DEFAULT_LOADING_WAVE_OPTIONS }
);

/** sets app-wide defaults; the directive's own options still win */
export function provideLoadingWave(
  options: Partial<LoadingWaveOptions>
): Provider {
  return {
    provide: LOADING_WAVE_OPTIONS,
    useValue: resolveLoadingWaveOptions(DEFAULT_LOADING_WAVE_OPTIONS, options),
  };
}

/**
 * Merges `overrides` into `defaults`, ignoring `undefined` values and
 * replacing sizes and durations that are no positive finite number.
 */
export function resolveLoadingWaveOptions(
  defaults: LoadingWaveOptions,
  overrides: Partial<LoadingWaveOptions> = {}
): LoadingWaveOptions {
  const defined = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined)
  ) as Partial<LoadingWaveOptions>;
  const merged = { ...defaults, ...defined };
  return {
    ...merged,
    dotSpacing: positiveOr(merged.dotSpacing, defaults.dotSpacing),
    dotSize: positiveOr(merged.dotSize, defaults.dotSize),
    sweepMs: positiveOr(merged.sweepMs, defaults.sweepMs),
  };
}

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
