import { ZoneKind } from '../state/zones';
import { Rgb } from './arena-theme';
import { rgba } from './canvas-math';

/**
 * The colour of each kind of zone, the same on every level so a player
 * learns it once: violet poison, golden food, pale blue ice, red heat,
 * white for the ground to hold -
 * red rather than orange, which the default colony wears.
 */
export const ZONE_COLORS: Readonly<Record<ZoneKind, Rgb>> = {
  antibiotic: [200, 80, 255],
  agar: [255, 215, 90],
  ice: [150, 215, 255],
  heat: [255, 60, 60],
  hill: [255, 255, 255],
};

/** How strongly a zone tints the floor, and how strongly its rim shows. */
export const ZONE_FILL_ALPHA = 0.2;
export const ZONE_EDGE_ALPHA = 0.7;

/** The fill and the rim of each kind as CSS colours, for the 2D canvas. */
export const ZONE_CSS = Object.fromEntries(
  Object.entries(ZONE_COLORS).map(([kind, color]) => [
    kind,
    {
      fill: rgba(color, ZONE_FILL_ALPHA),
      edge: rgba(color, ZONE_EDGE_ALPHA),
    },
  ])
) as Readonly<Record<ZoneKind, { fill: string; edge: string }>>;
