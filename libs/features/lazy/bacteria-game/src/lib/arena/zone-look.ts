import { ZoneKind } from '../state/zones';
import { Rgb } from './arena-theme';

/**
 * The colour of each kind of zone, the same on every level so a player
 * learns it once: violet poison, golden food, pale blue ice, red heat -
 * red rather than orange, which the default colony wears.
 */
export const ZONE_COLORS: Readonly<Record<ZoneKind, Rgb>> = {
  antibiotic: [200, 80, 255],
  agar: [255, 215, 90],
  ice: [150, 215, 255],
  heat: [255, 60, 60],
};

/** How strongly a zone tints the floor, and how strongly its rim shows. */
export const ZONE_FILL_ALPHA = 0.2;
export const ZONE_EDGE_ALPHA = 0.7;
