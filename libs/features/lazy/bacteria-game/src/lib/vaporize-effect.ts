import type { Size } from './fullscreen';

/**
 * How finely the arena turns to dust once a match is left - or whether it
 * simply clears.
 */
export type VaporizeQuality = 'off' | 'low' | 'medium' | 'full';

export interface VaporizeQualityOption {
  id: VaporizeQuality;
  name: string;
  /** The most pixels the arena is captured with - every one a particle. */
  pixels: number;
}

/**
 * Pixel budgets rather than pixel ratios: a phone's small arena keeps its
 * crisp particles, while a big desktop window - millions of pixels, and the
 * effect canvas around them five times as tall - is snapped with coarser
 * ones. Medium is about the pixels the arena is drawn with by default.
 */
export const VAPORIZE_QUALITIES: readonly VaporizeQualityOption[] = [
  { id: 'off', name: 'Off', pixels: 0 },
  { id: 'low', name: 'Low', pixels: 250_000 },
  { id: 'medium', name: 'Medium', pixels: 500_000 },
  { id: 'full', name: 'Full', pixels: Infinity },
];

export const DEFAULT_VAPORIZE_QUALITY: VaporizeQuality = 'medium';

export interface VaporizeDurationOption {
  ms: number;
  name: string;
}

/** How long the arena takes to blow away. */
export const VAPORIZE_DURATIONS: readonly VaporizeDurationOption[] = [
  { ms: 1500, name: 'Short' },
  { ms: 2500, name: 'Normal' },
  { ms: 5000, name: 'Long' },
];

export const DEFAULT_VAPORIZE_MS = 2500;

/** The effect's own cap on device pixels per CSS pixel. */
const MAX_PIXEL_RATIO = 2;

export function isVaporizeQuality(value: unknown): value is VaporizeQuality {
  return VAPORIZE_QUALITIES.some((option) => option.id === value);
}

export function isVaporizeMs(value: unknown): value is number {
  return VAPORIZE_DURATIONS.some((option) => option.ms === value);
}

/**
 * The most pixels per CSS pixel to capture an arena box of that size with,
 * so it stays within the quality's budget - the device's own pixel ratio
 * caps it further. Before the box is laid out, the effect's own cap.
 */
export function vaporizePixelRatio(
  quality: VaporizeQuality,
  box: Size | null
): number {
  const budget =
    VAPORIZE_QUALITIES.find((option) => option.id === quality)?.pixels ??
    Infinity;
  const area = box == null ? 0 : box.width * box.height;
  if (!Number.isFinite(budget) || area <= 0) {
    return MAX_PIXEL_RATIO;
  }
  return Math.min(MAX_PIXEL_RATIO, Math.sqrt(budget / area));
}
