import { ZoneKind } from '../state/zones';
import { Rgb } from './arena-theme';

/**
 * The colour of each kind of zone, the same on every level so a player
 * learns it once: violet poison, lime food - apart from the green
 * colony - pale blue ice, red heat,
 * white for the ground to hold -
 * red rather than orange, which the default colony wears.
 */
export const ZONE_COLORS: Readonly<Record<ZoneKind, Rgb>> = {
  antibiotic: [200, 80, 255],
  agar: [185, 235, 80],
  ice: [150, 215, 255],
  heat: [255, 60, 60],
  hill: [255, 255, 255],
};
