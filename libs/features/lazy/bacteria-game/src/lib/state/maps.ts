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

import { wrap } from './geometry';

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
  /**
   * The walls that move or open and close while the match runs, at the given
   * match time. Maps without any leave it out. Like the static walls they are
   * point symmetric at every moment - see {@link pointSymmetric}.
   */
  createDynamicWalls?(
    width: number,
    height: number,
    timeSec: number
  ): DynamicWall[];
}

/** A wall that moves, or a gate that opens and closes, during a match. */
export interface DynamicWall extends Rect {
  /** True while it blocks - an open gate lets the bacteria through. */
  solid: boolean;
  /**
   * 0 while an open gate is safe, rising to 1 the moment it slams shut - the
   * renderer blinks it and the sound warns, so nobody is crushed by surprise.
   */
  warning: number;
}

/** When a gate is closed: once per period, for the last `closedSec` of it. */
export interface GateTiming {
  periodSec: number;
  closedSec: number;
  /** Shifts the cycle, so two gates of a map need not close together. */
  offsetSec?: number;
  /** How long before closing the warning starts. */
  warningSec?: number;
}

/** Whether a gate blocks at that match time, and how close it is to closing. */
export function gateState(
  timing: GateTiming,
  timeSec: number
): Pick<DynamicWall, 'solid' | 'warning'> {
  const { periodSec, closedSec, offsetSec = 0, warningSec = 1.2 } = timing;
  const phase = wrap(timeSec + offsetSec, periodSec);
  const openSec = periodSec - closedSec;
  if (phase >= openSec) {
    return { solid: true, warning: 0 };
  }
  const warningStart = openSec - warningSec;
  return {
    solid: false,
    warning: phase > warningStart ? (phase - warningStart) / warningSec : 0,
  };
}

/**
 * How far a sliding wall is off its rest position at that match time: a sine
 * swing of `amplitude` pixels, rounded to whole cells.
 */
export function slideOffset(
  amplitude: number,
  periodSec: number,
  timeSec: number
): number {
  return Math.round(amplitude * Math.sin((2 * Math.PI * timeSec) / periodSec));
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
 *
 * Moving walls go through it as well, at every moment: a gate and its
 * mirror image open and close together, and a sliding wall's twin slides
 * the other way.
 */
export function pointSymmetric<T extends Rect>(
  rects: T[],
  width: number,
  height: number
): T[] {
  const result: T[] = [];
  const seen = new Set<string>();

  for (const rect of [
    ...rects,
    ...rects.map((r) => ({ ...r, ...mirrorRect(r, width, height) })),
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
    // Whatever else the rect carries - a gate's state, say - goes along.
    result.push({ ...rect, ...clipped });
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
  description:
    'Two walls with offset gaps that slam shut now and then - the middle is a killing ground.',
  createWalls(width, height) {
    const { x, gapY, gap } = corridorGap(width, height);

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
  createDynamicWalls(width, height, timeSec) {
    const { x, gapY, gap } = corridorGap(width, height);
    return pointSymmetric(
      [
        {
          x,
          y: gapY,
          width: WALL_THICKNESS,
          height: gap,
          ...gateState({ periodSec: 11, closedSec: 3 }, timeSec),
        },
      ],
      width,
      height
    );
  },
};

/** Where the corridor wall stands and where its gap is. */
function corridorGap(width: number, height: number) {
  return {
    x: Math.round(width / 2) - 44,
    gapY: Math.round(height / 2) - 28,
    gap: 26,
  };
}

/** Size of the hourglass bars and of the waist between them. */
const HOURGLASS = { barWidth: 14, gapHalf: 11 };

/** One wide block from the top and one from the bottom, meeting in the middle. */
const hourglass: GameMap = {
  id: 'hourglass',
  name: 'Hourglass',
  description:
    'A single narrow waist in the centre that pinches shut every few seconds.',
  createWalls(width, height) {
    const { barWidth, gapHalf } = HOURGLASS;

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
  createDynamicWalls(width, height, timeSec) {
    const { barWidth, gapHalf } = HOURGLASS;
    const y = Math.round(height / 2) - gapHalf;
    return pointSymmetric(
      [
        {
          x: Math.round(width / 2 - barWidth / 2),
          y,
          width: barWidth,
          height: height - 2 * y,
          ...gateState({ periodSec: 9, closedSec: 2.5, offsetSec: 2 }, timeSec),
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

/**
 * Open ground swept by two pistons: long bars that slide up and down through
 * the middle, in opposite directions, shoving every bacterium in their way.
 */
const pistons: GameMap = {
  id: 'pistons',
  name: 'Pistons',
  description: 'Two sliding bars sweep the middle and shove everything aside.',
  createWalls(width, height) {
    // Anchors at the rim, so the pistons look like they come out of the wall.
    return pointSymmetric(
      [
        {
          x: Math.round(width / 2) - 34,
          y: 0,
          width: 14,
          height: 4,
        },
      ],
      width,
      height
    );
  },
  createDynamicWalls(width, height, timeSec) {
    const length = Math.round(height * 0.4);
    const rest = Math.round(height / 2 - length / 2);
    const amplitude = rest - 6;
    return pointSymmetric(
      [
        {
          x: Math.round(width / 2) - 32,
          y: rest + slideOffset(amplitude, 7, timeSec),
          width: WALL_THICKNESS + 2,
          height: length,
          solid: true,
          warning: 0,
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
  pistons,
];

/** The map with that id, falling back to the corridors layout. */
export function getMap(id: string): GameMap {
  return GAME_MAPS.find((map) => map.id === id) ?? corridors;
}
