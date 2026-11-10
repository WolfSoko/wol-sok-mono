import { Rgb } from './arena/arena-theme';
import { rgba } from './arena/canvas-math';

/** A colour as its channels and an alpha from 0 to 1. */
export interface SplitColor {
  rgb: Rgb;
  alpha: number;
}

/** The largest alpha of a player colour (`PlayerColorArray`) - opaque. */
const ALPHA_MAX = 255;

/**
 * A player's RGBA colour, its alpha from 0 to 255 as in `PlayerColorArray`,
 * as its channels and the alpha from 0 to 1 a painter or CSS draws with.
 * Without an alpha it is opaque. The one place that reads that alpha.
 */
export function splitColor(color: readonly number[]): SplitColor {
  const [r, g, b, alpha = ALPHA_MAX] = color;
  return { rgb: [r, g, b], alpha: alpha / ALPHA_MAX };
}

/** A player's RGBA colour as a CSS `rgba()` text, its alpha from 0 to 1. */
export function cssColor(color: readonly number[]): string {
  const { rgb, alpha } = splitColor(color);
  return rgba(rgb, alpha);
}
