import { GameMap, Rect, stampRect } from './maps';

/**
 * The kinds of ground a level can lay out besides walls:
 *
 * - `antibiotic`: drains a bacterium's energy and keeps it from recovering -
 *   one that stays too long dies, and nobody captures it.
 * - `agar`: rich ground, bacteria on it divide twice as often.
 * - `ice`: bacteria on it move at half the speed.
 * - `heat`: bacteria on it hunt the enemy harder.
 */
export type ZoneKind = 'antibiotic' | 'agar' | 'ice' | 'heat';

/** A stretch of ground of one kind - a rect, or the ellipse in it. */
export interface Zone extends Rect {
  kind: ZoneKind;
}

/** How strongly each kind of zone acts. */
export const ZONE_EFFECTS = {
  /** Energy an antibiotic zone drains per second, regeneration stopped. */
  antibioticDrainPerSec: 0.5,
  /** How much more often bacteria divide on agar. */
  agarDivideFactor: 2,
  /** The chance a bacterium on ice sits a movement step out. */
  iceStayChance: 0.5,
  /** Aggression a colony gains on hot ground... */
  heatAggression: 0.25,
  /**
   * ...up to this much: below 1, so the crosshair still pulls the colony
   * across hot ground. A boost hunting harder already keeps its own.
   */
  heatMaxAggression: 0.95,
} as const;

/** The code of a kind in a zone grid, 0 for no zone. */
export const ZONE_CODE: Readonly<Record<ZoneKind, number>> = {
  antibiotic: 1,
  agar: 2,
  ice: 3,
  heat: 4,
};

/**
 * Lays the zones into a grid of zone codes, one per cell, shifted left by
 * `shift` bits - a later zone covers an earlier one where they overlap.
 */
export function stampZones(
  grid: Uint8Array,
  width: number,
  height: number,
  zones: readonly Zone[],
  shift = 0
): void {
  for (const zone of zones) {
    stampRect(grid, width, height, zone, ZONE_CODE[zone.kind] << shift);
  }
}

/** The zones of a map on an arena of that size - none for most maps. */
export function mapZones(map: GameMap, width: number, height: number): Zone[] {
  return map.createZones?.(width, height) ?? [];
}

/** The aggression a colony hunts with on hot ground. */
export function heatedAggression(aggression: number): number {
  const { heatAggression, heatMaxAggression } = ZONE_EFFECTS;
  return Math.max(
    aggression,
    Math.min(heatMaxAggression, aggression + heatAggression)
  );
}
