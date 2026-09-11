/**
 * Pure viewport math for the Mandelbrot explorer.
 *
 * Everything in here is framework and WebGL free so that the tricky parts
 * (precision splitting, zoom anchoring, camera flights) can be unit tested.
 */

export interface FractalView {
  /** Real part of the viewport centre. */
  readonly centerX: number;
  /** Imaginary part of the viewport centre. */
  readonly centerY: number;
  /** Half of the viewport height in complex plane units. */
  readonly scale: number;
}

export interface ComplexPoint {
  readonly x: number;
  readonly y: number;
}

export const HOME_VIEW: FractalView = {
  centerX: -0.7,
  centerY: 0,
  scale: 1.25,
};

/** Widest view we allow - beyond this the set is a speck in the middle. */
export const MAX_SCALE = 4;

/**
 * Deepest view we allow. A double-single pair carries ~48 mantissa bits, so
 * this keeps roughly two bits of headroom per pixel at 10^13 magnification.
 */
export const MIN_SCALE = 1e-13;

/** Below this scale single precision floats start to show visible blocking. */
export const HIGH_PRECISION_SCALE = 5e-5;

export const MIN_ITERATIONS = 60;
export const MAX_ITERATIONS = 2000;

export const COLOR_MODES = ['smooth', 'trap', 'distance'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const PALETTES = [
  'Aurora',
  'Ember',
  'Ultra',
  'Ice',
  'Spectrum',
  'Blueprint',
] as const;
export type PaletteName = (typeof PALETTES)[number];

/**
 * Splits a double into two floats whose sum reproduces the original value with
 * ~48 bits of mantissa. This is the CPU side counterpart of the `dsAdd`/`dsMul`
 * helpers in the fragment shader.
 */
export function splitFloat(value: number): [number, number] {
  const high = Math.fround(value);
  return [high, Math.fround(value - high)];
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function needsHighPrecision(scale: number): boolean {
  return scale < HIGH_PRECISION_SCALE;
}

/** How much the current view magnifies the default view. */
export function magnification(view: FractalView): number {
  return HOME_VIEW.scale / view.scale;
}

/**
 * Zooms by `factor` (< 1 zooms in) while keeping `anchor` pinned to the same
 * screen position.
 */
export function zoomAt(
  view: FractalView,
  factor: number,
  anchor: ComplexPoint
): FractalView {
  const scale = clampScale(view.scale * factor);
  // Re-derive the effective factor so that clamping cannot drift the anchor.
  const applied = scale / view.scale;
  return {
    centerX: anchor.x + (view.centerX - anchor.x) * applied,
    centerY: anchor.y + (view.centerY - anchor.y) * applied,
    scale,
  };
}

/** Maps a canvas pixel position to its complex plane coordinate. */
export function screenToComplex(
  view: FractalView,
  pixelX: number,
  pixelY: number,
  width: number,
  height: number
): ComplexPoint {
  const aspect = width / height;
  return {
    x: (pixelX / width - 0.5) * 2 * aspect * view.scale + view.centerX,
    y: (0.5 - pixelY / height) * 2 * view.scale + view.centerY,
  };
}

/** Drags the view by a pixel delta, keeping the grabbed point under the cursor. */
export function panByPixels(
  view: FractalView,
  deltaX: number,
  deltaY: number,
  height: number
): FractalView {
  const perPixel = (2 * view.scale) / height;
  return {
    centerX: view.centerX - deltaX * perPixel,
    centerY: view.centerY + deltaY * perPixel,
    scale: view.scale,
  };
}

/**
 * Iteration budget that keeps deep zooms resolved without wasting cycles on
 * shallow ones: the boundary needs roughly a constant number of extra
 * iterations per decade of magnification.
 */
export function autoIterations(scale: number): number {
  const decades = Math.max(0, Math.log10(HOME_VIEW.scale / clampScale(scale)));
  const iterations = 180 + decades * 150;
  return Math.round(
    Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, iterations))
  );
}

export function easeInOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export interface FlightPlan {
  readonly from: FractalView;
  readonly to: FractalView;
  /** Widest scale the flight passes through. */
  readonly bridgeScale: number;
  readonly zoomOutWeight: number;
  readonly panWeight: number;
  readonly zoomInWeight: number;
  readonly totalWeight: number;
  readonly durationMs: number;
}

/**
 * Plans a three phase camera flight: pull back until both the start and the
 * target fit on screen, pan across, then dive in. A plain interpolation would
 * send the target off screen for most of a deep flight.
 */
export function planFlight(
  from: FractalView,
  to: FractalView,
  baseDurationMs = 900
): FlightPlan {
  const distance = Math.hypot(
    to.centerX - from.centerX,
    to.centerY - from.centerY
  );
  const bridgeScale = Math.max(from.scale, to.scale, distance * 0.75);
  const zoomOutWeight = Math.log(bridgeScale / from.scale);
  const zoomInWeight = Math.log(bridgeScale / to.scale);
  const panWeight = (distance / bridgeScale) * 1.5;
  const totalWeight = Math.max(1e-6, zoomOutWeight + panWeight + zoomInWeight);
  return {
    from,
    to,
    bridgeScale,
    zoomOutWeight,
    panWeight,
    zoomInWeight,
    totalWeight,
    durationMs: Math.min(3200, baseDurationMs + totalWeight * 130),
  };
}

/** Samples a flight plan at progress `t` in [0, 1]. */
export function sampleFlight(plan: FlightPlan, t: number): FractalView {
  const eased = easeInOutCubic(t);
  const travelled = eased * plan.totalWeight;
  const { from, to, bridgeScale, zoomOutWeight, panWeight } = plan;

  let scale: number;
  let panProgress: number;

  if (travelled <= zoomOutWeight && zoomOutWeight > 0) {
    scale = from.scale * Math.exp(travelled);
    panProgress = 0;
  } else if (travelled <= zoomOutWeight + panWeight && panWeight > 0) {
    scale = bridgeScale;
    panProgress = (travelled - zoomOutWeight) / panWeight;
  } else {
    const remaining = travelled - zoomOutWeight - panWeight;
    scale = bridgeScale * Math.exp(-remaining);
    panProgress = 1;
  }

  return {
    centerX: from.centerX + (to.centerX - from.centerX) * panProgress,
    centerY: from.centerY + (to.centerY - from.centerY) * panProgress,
    scale: clampScale(scale),
  };
}

const MAGNITUDE_SUFFIXES = ['', 'K', 'M', 'G', 'T'] as const;

/** Human readable magnification, e.g. `12.4 M` or `3.1e14`. */
export function formatMagnification(value: number): string {
  if (!Number.isFinite(value) || value < 1) {
    return '1';
  }
  const tier = Math.min(
    MAGNITUDE_SUFFIXES.length - 1,
    Math.floor(Math.log10(value) / 3)
  );
  const scaled = value / Math.pow(1000, tier);
  if (tier === MAGNITUDE_SUFFIXES.length - 1 && scaled >= 1000) {
    return value.toExponential(1);
  }
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return `${scaled.toFixed(digits)} ${MAGNITUDE_SUFFIXES[tier]}`.trim();
}

/**
 * Formats a complex coordinate with just enough digits to distinguish
 * neighbouring pixels at the given scale.
 */
export function formatComplex(x: number, y: number, scale: number): string {
  const digits = Math.min(
    17,
    Math.max(3, Math.ceil(-Math.log10(Math.max(scale, Number.MIN_VALUE))) + 3)
  );
  const sign = y < 0 || Object.is(y, -0) ? '-' : '+';
  return `${x.toFixed(digits)} ${sign} ${Math.abs(y).toFixed(digits)}i`;
}
