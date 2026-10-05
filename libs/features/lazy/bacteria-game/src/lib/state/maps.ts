/**
 * The wall layouts a match can be fought on.
 *
 * Every map is point symmetric to the centre of the arena: rotating it by 180°
 * maps it onto itself, so one player's half is exactly the other one's and
 * neither of them gets the better side. The nutrient spawner depends on it too
 * - it mirrors a pellet through the centre and expects the mirror image to be
 * free as well.
 *
 * {@link pointSymmetric} builds that guarantee into the layouts: a map only
 * describes one half, the other one is generated from it.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One wall layout, sized to whatever arena it is asked for. */
export interface GameMap {
  /** Stable id - referenced by the levels and stored in the game state. */
  id: string;
  name: string;
  /** One line on what the layout does to a match. */
  description: string;
  /** The walls for an arena of the given size. */
  createWalls(width: number, height: number): Rect[];
}

/** Thickness of a regular wall in arena pixels. */
const WALL_THICKNESS = 8;

/** The rect rotated by 180° around the centre of the arena. */
export function mirrorRect(rect: Rect, width: number, height: number): Rect {
  return {
    x: width - rect.x - rect.width,
    y: height - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
}

/** The part of the rect that is inside the arena, or null when nothing is. */
function clipToArena(rect: Rect, width: number, height: number): Rect | null {
  const x = Math.max(rect.x, 0);
  const y = Math.max(rect.y, 0);
  const right = Math.min(rect.x + rect.width, width);
  const bottom = Math.min(rect.y + rect.height, height);
  if (right <= x || bottom <= y) {
    return null;
  }
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Completes a half layout into a point symmetric one.
 *
 * Every rect is paired with its 180° rotation; a rect that already is its own
 * mirror image (a block on the centre, say) is kept once. Clipping happens
 * after mirroring, and the arena box is point symmetric itself, so even a
 * layout that hangs over the edge of a small arena stays fair.
 */
export function pointSymmetric(
  rects: Rect[],
  width: number,
  height: number
): Rect[] {
  const result: Rect[] = [];
  const seen = new Set<string>();

  for (const rect of [
    ...rects,
    ...rects.map((r) => mirrorRect(r, width, height)),
  ]) {
    const clipped = clipToArena(rect, width, height);
    if (clipped == null) {
      continue;
    }
    const key = `${clipped.x}:${clipped.y}:${clipped.width}:${clipped.height}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(clipped);
  }

  return result;
}

/** Nothing but the outer bounds - the colonies meet head on in the open. */
const openField: GameMap = {
  id: 'open-field',
  name: 'Open Field',
  description: 'No cover at all. Whoever masses the most bacteria wins.',
  createWalls: () => [],
};

/**
 * Two vertical walls with a narrow, offset gap each. The colonies have to
 * funnel through them, which turns the middle into the place where the fight
 * happens.
 */
const corridors: GameMap = {
  id: 'corridors',
  name: 'Corridors',
  description: 'Two walls with offset gaps - the middle is a killing ground.',
  createWalls(width, height) {
    const x = Math.round(width / 2) - 44;
    const gapY = Math.round(height / 2) - 28;
    const gap = 26;

    return pointSymmetric(
      [
        { x, y: 0, width: WALL_THICKNESS, height: gapY },
        {
          x,
          y: gapY + gap,
          width: WALL_THICKNESS,
          height: height - gapY - gap,
        },
      ],
      width,
      height
    );
  },
};

/** One wide block from the top and one from the bottom, meeting in the middle. */
const hourglass: GameMap = {
  id: 'hourglass',
  name: 'Hourglass',
  description: 'A single narrow waist in the centre. Hold it and you win.',
  createWalls(width, height) {
    const barWidth = 14;
    const gapHalf = 11;

    return pointSymmetric(
      [
        {
          x: Math.round(width / 2 - barWidth / 2),
          y: 0,
          width: barWidth,
          height: Math.round(height / 2) - gapHalf,
        },
      ],
      width,
      height
    );
  },
};

/**
 * A walled ring around the middle of the arena, with one way in on each side.
 *
 * The openings are point symmetric, so each colony has exactly one door - and
 * they are on opposite sides, which is what makes the inside worth fighting
 * over instead of a stalemate at a single gate.
 */
const innerRing: GameMap = {
  id: 'inner-ring',
  name: 'Inner Ring',
  description:
    'A walled ring in the middle, one door per side. Take the inside.',
  createWalls(width, height) {
    const left = Math.round(width * 0.32);
    const top = Math.round(height * 0.22);

    return pointSymmetric(
      [
        {
          x: left,
          y: top,
          width: Math.round(width * 0.36),
          height: WALL_THICKNESS,
        },
        {
          x: left,
          y: top,
          width: WALL_THICKNESS,
          height: Math.round(height * 0.28),
        },
      ],
      width,
      height
    );
  },
};

/**
 * A regular grid of small blocks. Breaking through costs time everywhere, so
 * the frontline frays instead of forming one straight line.
 */
const pillarField: GameMap = {
  id: 'pillar-field',
  name: 'Pillar Field',
  description: 'A grid of pillars that shreds every frontline into pockets.',
  createWalls(width, height) {
    const size = 10;
    const columns = 5;
    const rows = 3;
    const cells: Rect[] = [];

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        cells.push({
          x: Math.round(((column + 1) * width) / (columns + 1) - size / 2),
          y: Math.round(((row + 1) * height) / (rows + 1) - size / 2),
          width: size,
          height: size,
        });
      }
    }

    // The grid is laid out row by row, so the mirror image of the n-th pillar
    // is the n-th from the end. Mirroring the first half rebuilds the rest
    // exactly, without relying on the rounding above being symmetric.
    return pointSymmetric(
      cells.slice(0, Math.ceil(cells.length / 2)),
      width,
      height
    );
  },
};

/** A box around each spawn, open towards the middle of the arena. */
const twinChambers: GameMap = {
  id: 'twin-chambers',
  name: 'Twin Chambers',
  description:
    'Each colony starts boxed in, with the only exit facing the enemy.',
  createWalls(width, height) {
    const left = Math.round(width * 0.09);
    const right = Math.round(width * 0.31);
    const top = Math.round(height * 0.14);
    const bottom = height - top;

    return pointSymmetric(
      [
        {
          x: left,
          y: top,
          width: WALL_THICKNESS,
          height: bottom - top,
        },
        { x: left, y: top, width: right - left, height: WALL_THICKNESS },
        {
          x: left,
          y: bottom - WALL_THICKNESS,
          width: right - left,
          height: WALL_THICKNESS,
        },
      ],
      width,
      height
    );
  },
};

/** Long bars that leave only a winding path from one side to the other. */
const serpentine: GameMap = {
  id: 'serpentine',
  name: 'Serpentine',
  description: 'A winding path - the colonies arrive strung out in a line.',
  createWalls(width, height) {
    return pointSymmetric(
      [
        {
          x: 0,
          y: Math.round(height * 0.3),
          width: Math.round(width * 0.62),
          height: WALL_THICKNESS,
        },
        {
          x: Math.round(width * 0.42),
          y: 0,
          width: WALL_THICKNESS,
          height: Math.round(height * 0.2),
        },
      ],
      width,
      height
    );
  },
};

/** Every layout the game can be played on, in the order the levels use them. */
export const GAME_MAPS: readonly GameMap[] = [
  openField,
  corridors,
  hourglass,
  innerRing,
  pillarField,
  twinChambers,
  serpentine,
];

/** The map with that id, falling back to the corridors layout. */
export function getMap(id: string): GameMap {
  return GAME_MAPS.find((map) => map.id === id) ?? corridors;
}
