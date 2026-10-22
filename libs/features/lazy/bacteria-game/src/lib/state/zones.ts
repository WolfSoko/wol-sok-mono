import { seeded } from './geometry';
import { GameMap, Rect, stampRect } from './maps';
import { blob } from './shapes';

/**
 * The kinds of ground a level can lay out besides walls:
 *
 * - `antibiotic`: drains a bacterium's energy and keeps it from recovering -
 *   one that stays too long dies, and nobody captures it.
 * - `agar`: rich ground, bacteria on it divide twice as often.
 * - `ice`: bacteria on it move at half the speed.
 * - `heat`: bacteria on it hunt the enemy harder.
 * - `hill`: the ground of a hold-the-zone level - it does nothing to the
 *   bacteria, but the colony with the most of them on it holds it.
 */
export type ZoneKind = 'antibiotic' | 'agar' | 'ice' | 'heat' | 'hill';

/** The kinds as the menus name them. */
export const ZONE_NAMES: Readonly<Record<ZoneKind, string>> = {
  antibiotic: 'Antibiotic',
  agar: 'Agar',
  ice: 'Ice',
  heat: 'Heat',
  hill: 'Hold zone',
};

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
  hill: 5,
};

/** The kind a code in a zone grid stands for, undefined for none. */
export function kindOfCode(code: number): ZoneKind | undefined {
  return KINDS_BY_CODE[code];
}

const KINDS_BY_CODE: readonly (ZoneKind | undefined)[] = (() => {
  const kinds: (ZoneKind | undefined)[] = [];
  for (const [kind, code] of Object.entries(ZONE_CODE)) {
    kinds[code] = kind as ZoneKind;
  }
  return kinds;
})();

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

/**
 * An organic stretch of ground: overlapping round blobs filling an ellipse
 * of radii `rx` and `ry` round a centre, each a little off its place and
 * its size - from a fixed seed, so a level always looks the same.
 */
export function puddle(
  kind: ZoneKind,
  centreX: number,
  centreY: number,
  rx: number,
  ry: number,
  seed: number
): Zone[] {
  const random = seeded(seed);
  const size = Math.max(3, Math.min(rx, ry) * 0.7);
  const step = size * 0.75;
  // A lattice centred on the centre, so the puddle sits where it is put.
  const across = Math.floor(Math.max(0, 2 * rx - size) / step);
  const down = Math.floor(Math.max(0, 2 * ry - size) / step);
  const zones: Zone[] = [];
  for (let row = 0; row <= down; row++) {
    const y = (row - down / 2) * step;
    for (let column = 0; column <= across; column++) {
      const x = (column - across / 2) * step;
      // Only the blobs inside the ellipse, so the outline stays round.
      if ((x / rx) ** 2 + (y / ry) ** 2 > 1) {
        continue;
      }
      const jitter = size * 0.25;
      const radius = size * (0.55 + 0.25 * random());
      zones.push({
        ...blob(
          centreX + x + (random() - 0.5) * 2 * jitter,
          centreY + y + (random() - 0.5) * 2 * jitter,
          radius
        ),
        kind,
      });
    }
  }
  return zones;
}
