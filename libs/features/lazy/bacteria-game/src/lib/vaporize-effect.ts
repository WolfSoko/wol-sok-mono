/**
 * How finely the arena turns to dust once a match is left - or whether it
 * simply clears.
 */
export type VaporizeQuality = 'off' | 'low' | 'medium' | 'full';

export interface VaporizeQualityOption {
  id: VaporizeQuality;
  name: string;
  /**
   * The most pixels the arena is captured with - every one a particle.
   * Absent where there is no budget: off never snaps, full takes the
   * effect's own device pixels.
   */
  pixels?: number;
}

/**
 * Pixel budgets rather than pixel ratios: a big desktop window - millions
 * of pixels, and the effect canvas around them five times as tall - is
 * snapped with much coarser particles, a phone's small arena with only a
 * little coarser ones. Medium is about the pixels the arena is drawn with
 * by default.
 */
export const VAPORIZE_QUALITIES: readonly VaporizeQualityOption[] = [
  { id: 'off', name: 'Off' },
  { id: 'low', name: 'Low', pixels: 250_000 },
  { id: 'medium', name: 'Medium', pixels: 500_000 },
  { id: 'full', name: 'Full' },
];

export const DEFAULT_VAPORIZE_QUALITY: VaporizeQuality = 'medium';

export interface VaporizeDurationOption {
  id: 'short' | 'normal' | 'long';
  ms: number;
  name: string;
}

/** How long the arena takes to blow away. */
export const VAPORIZE_DURATIONS: readonly VaporizeDurationOption[] = [
  { id: 'short', ms: 1500, name: 'Short' },
  { id: 'normal', ms: 2500, name: 'Normal' },
  { id: 'long', ms: 5000, name: 'Long' },
];

export const DEFAULT_VAPORIZE_MS = 2500;

export function isVaporizeQuality(value: unknown): value is VaporizeQuality {
  return VAPORIZE_QUALITIES.some((option) => option.id === value);
}

export function isVaporizeMs(value: unknown): value is number {
  return VAPORIZE_DURATIONS.some((option) => option.ms === value);
}

/** The quality's pixel budget, undefined for none. */
export function vaporizePixels(quality: VaporizeQuality): number | undefined {
  return VAPORIZE_QUALITIES.find((option) => option.id === quality)?.pixels;
}
