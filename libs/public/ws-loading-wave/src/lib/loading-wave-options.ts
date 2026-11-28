import { InjectionToken, Provider } from '@angular/core';
import { Autoscale, DEFAULT_FRONT_ROUNDNESS } from './wave-model';
import type { LoadingWaveShader } from './webgl/loading-wave-shader';
import { rippleShader } from './webgl/shaders/ripple.shader';

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
  /**
   * how the dot grid follows the host's size: `true` makes spacing and dot
   * size finer on a host too small for `MIN_DOTS_ACROSS` dots across its
   * shorter side (a button), a number scales both by that factor, `false`
   * keeps them as set; `true` when unset
   */
  readonly autoscale?: Autoscale;
  /** any CSS colour; unset, the dots take the host's `currentColor` */
  readonly color?: string;
  /**
   * any CSS colour for the lit dots and the wave itself; unset, they take
   * the dots' colour
   */
  readonly accentColor?: string;
  /** how long one sweep of the wave across the element takes, in ms */
  readonly sweepMs: number;
  /**
   * `'auto'` draws with a WebGL2 shader on a GPU, `'webgl'` also where the
   * browser renders WebGL in software; both fall back to a 2D canvas where
   * that fails. `'canvas'` never uses WebGL.
   */
  readonly renderer: WaveRendererPreference;
  /**
   * 0 (a straight front) to 1 (a half circle): how far the wave front's ends
   * lag its middle, as a share of `min(height / 2, width)`; 0.5 when unset
   */
  readonly frontRoundness?: number;
  /**
   * the fragment shader the WebGL renderer draws with: a built-in one
   * (`rippleShader`) or one's own; unset, `rippleShader`. The 2D canvas
   * always draws the dot wave.
   */
  readonly shader?: LoadingWaveShader;
}

/** options with every default filled in, as the wave runs with them */
export type ResolvedLoadingWaveOptions = LoadingWaveOptions &
  Required<Pick<LoadingWaveOptions, 'autoscale' | 'frontRoundness' | 'shader'>>;

export const DEFAULT_LOADING_WAVE_OPTIONS: ResolvedLoadingWaveOptions = {
  afterLoading: 'hide',
  dotSpacing: 28,
  dotSize: 1.5,
  sweepMs: 1600,
  autoscale: true,
  renderer: 'auto',
  frontRoundness: DEFAULT_FRONT_ROUNDNESS,
  shader: rippleShader,
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
 * Merges `overrides` into `defaults`, ignoring `undefined` values,
 * replacing sizes, durations and an `autoscale` factor that are no positive
 * finite number and clamping the front's roundness into 0 to 1.
 */
export function resolveLoadingWaveOptions(
  defaults: LoadingWaveOptions,
  overrides: Partial<LoadingWaveOptions> = {}
): ResolvedLoadingWaveOptions {
  const defined = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined)
  ) as Partial<LoadingWaveOptions>;
  const merged = { ...defaults, ...defined };
  return {
    ...merged,
    dotSpacing: positiveOr(merged.dotSpacing, defaults.dotSpacing),
    dotSize: positiveOr(merged.dotSize, defaults.dotSize),
    sweepMs: positiveOr(merged.sweepMs, defaults.sweepMs),
    autoscale: autoscaleOr(merged.autoscale, defaults.autoscale ?? true),
    // an app's own LOADING_WAVE_OPTIONS may lack the newer options
    frontRoundness: unitOr(
      merged.frontRoundness,
      defaults.frontRoundness ?? DEFAULT_FRONT_ROUNDNESS
    ),
    shader: merged.shader ?? rippleShader,
  };
}

/** `value` clamped into 0 to 1, `fallback` where it is no finite number */
function unitOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

/** a boolean or a positive finite factor; `fallback` for anything else */
function autoscaleOr(
  value: Autoscale | undefined,
  fallback: Autoscale
): Autoscale {
  if (typeof value === 'boolean') {
    return value;
  }
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
