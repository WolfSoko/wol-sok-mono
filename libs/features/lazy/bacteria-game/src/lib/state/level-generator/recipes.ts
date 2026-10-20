import { Rect } from '../maps';
import { Rng } from './rng';
import { blob, nearSpawn, rectNearSpawn, spawnSpots } from './shapes';

/** The kinds of layout the generator makes - its styles. */
export type RecipeId = 'field' | 'corridor' | 'fortress' | 'cave';

export const RECIPE_IDS: readonly RecipeId[] = [
  'field',
  'corridor',
  'fortress',
  'cave',
];

export function isRecipeId(value: unknown): value is RecipeId {
  return RECIPE_IDS.includes(value as RecipeId);
}

/**
 * A style of generated layout: how it lays out the left half of the arena -
 * the generator mirrors it into the right one - and what it aims at.
 */
export interface Recipe {
  id: RecipeId;
  /** The second word of a generated name - "Quiet Corridors". */
  nouns: readonly string[];
  /** The briefing of a generated level. */
  description: string;
  /** How winding the way between the start spots should be - see `detour`. */
  detour: number;
  /** Hand-made levels whose look and music a generated one borrows. */
  family: readonly string[];
  /**
   * The walls of the left half on an arena of that size; `heat` runs from 0
   * (calm) to 1 (frantic) and tightens what the recipe builds.
   */
  build(rng: Rng, width: number, height: number, heat: number): Rect[];
}

/** Square or round pillars scattered over the left half. */
function pillars(
  rng: Rng,
  width: number,
  height: number,
  count: number,
  size: { min: number; max: number }
): Rect[] {
  const walls: Rect[] = [];
  for (let tries = 0; walls.length < count && tries < count * 8; tries++) {
    const s = rng.int(size.min, size.max);
    const x = rng.int(4, width / 2 - s / 2);
    const y = rng.int(4, height - s - 4);
    const wall: Rect = rng.chance(0.5)
      ? blob(x + s / 2, y + s / 2, s / 2)
      : { x, y, width: s, height: s };
    if (!rectNearSpawn(wall, width, height)) {
      walls.push(wall);
    }
  }
  return walls;
}

/**
 * A wall across the arena from edge to edge, at `x`, with `gaps` openings
 * the colonies push through.
 */
function bar(
  rng: Rng,
  x: number,
  height: number,
  thickness: number,
  gaps: number,
  gapSize: number
): Rect[] {
  const openings = Array.from({ length: gaps }, (_, i) => {
    const slot = height / gaps;
    return rng.int(i * slot + 6, (i + 1) * slot - gapSize - 6);
  });
  const walls: Rect[] = [];
  let y = 0;
  for (const opening of openings) {
    if (opening > y) {
      walls.push({ x, y, width: thickness, height: opening - y });
    }
    y = opening + gapSize;
  }
  if (y < height) {
    walls.push({ x, y, width: thickness, height: height - y });
  }
  return walls;
}

/**
 * Open ground with cover: pillars to hide behind and break a front on, more
 * and bigger the hotter the level.
 */
const field: Recipe = {
  id: 'field',
  nouns: ['Meadow', 'Flats', 'Garden', 'Plain', 'Shallows'],
  description: 'Open ground with pillars for cover - mass beats cleverness.',
  detour: 1.1,
  family: ['petri-dish', 'pillar-field'],
  build(rng, width, height, heat) {
    return pillars(rng, width, height, Math.round(10 + heat * 8), {
      min: 8,
      max: Math.round(14 + heat * 6),
    });
  },
};

/**
 * Walls from edge to edge with gaps in them - a front line to break through,
 * the gaps narrower the hotter the level.
 */
const corridor: Recipe = {
  id: 'corridor',
  nouns: ['Corridors', 'Halls', 'Passage', 'Lanes', 'Locks'],
  description: 'Walls from edge to edge, with gaps to push through.',
  detour: 1.35,
  family: ['corridors', 'hourglass', 'serpentine'],
  build(rng, width, height, heat) {
    const [spawn] = spawnSpots(width, height);
    const gapSize = Math.round(30 - heat * 12);
    const thickness = rng.int(5, 9);
    // One wall behind the start spot or none, one in front of it.
    const walls = bar(
      rng,
      rng.int(spawn.x + 24, width / 2 - thickness - 6),
      height,
      thickness,
      rng.int(1, 2),
      gapSize
    );
    if (rng.chance(0.5)) {
      walls.push(
        ...bar(rng, rng.int(6, spawn.x - 30), height, thickness, 2, gapSize)
      );
    }
    return [
      ...walls,
      ...pillars(rng, width, height, rng.int(0, 4), { min: 5, max: 9 }),
    ];
  },
};

/**
 * A walled keep around each start spot with a door or two, and pillars in
 * the field between - a base to hold, a door to storm.
 */
const fortress: Recipe = {
  id: 'fortress',
  nouns: ['Keep', 'Bastion', 'Citadel', 'Ramparts', 'Redoubt'],
  description: 'A keep around each colony, with doors to hold or to storm.',
  detour: 1.45,
  family: ['twin-chambers', 'inner-ring'],
  build(rng, width, height, heat) {
    const [spawn] = spawnSpots(width, height);
    const reach = rng.int(30, 38);
    const thickness = rng.int(4, 6);
    const door = Math.round(26 - heat * 8);
    const left = spawn.x - reach;
    const right = spawn.x + reach;
    const top = spawn.y - reach;
    const bottom = spawn.y + reach;
    const span = right - left;
    // The side towards the enemy always has a door, the others now and then.
    const sides: Rect[][] = [
      withDoor(
        { x: right, y: top, width: thickness, height: span + thickness },
        door,
        rng,
        'vertical'
      ),
      rng.chance(0.5)
        ? withDoor(
            { x: left, y: top, width: span, height: thickness },
            door,
            rng,
            'horizontal'
          )
        : [{ x: left, y: top, width: span, height: thickness }],
      rng.chance(0.5)
        ? withDoor(
            { x: left, y: bottom, width: span, height: thickness },
            door,
            rng,
            'horizontal'
          )
        : [{ x: left, y: bottom, width: span, height: thickness }],
    ];
    if (rng.chance(0.35)) {
      sides.push([{ x: left, y: top, width: thickness, height: span }]);
    }
    return [
      ...sides.flat(),
      ...pillars(rng, width, height, rng.int(2, 6), { min: 5, max: 10 }).filter(
        (pillar) => pillar.x > right + thickness + 4
      ),
    ];
  },
};

/** A straight wall with a door of that size somewhere along it. */
function withDoor(
  wall: Rect,
  door: number,
  rng: Rng,
  direction: 'vertical' | 'horizontal'
): Rect[] {
  const length = direction === 'vertical' ? wall.height : wall.width;
  const at = rng.int(6, Math.max(6, length - door - 6));
  if (direction === 'vertical') {
    return [
      { ...wall, height: at },
      { ...wall, y: wall.y + at + door, height: length - at - door },
    ];
  }
  return [
    { ...wall, width: at },
    { ...wall, x: wall.x + at + door, width: length - at - door },
  ];
}

/**
 * Round walls like living tissue: air sacs packed in a lattice, or threads
 * growing in from the edges - channels and no straight line anywhere.
 */
const cave: Recipe = {
  id: 'cave',
  nouns: ['Caverns', 'Grotto', 'Hollows', 'Burrow', 'Tissue'],
  description:
    'Round walls like living tissue - winding channels, no straights.',
  detour: 1.3,
  family: ['alveoli', 'mycelium', 'villi'],
  build(rng, width, height, heat) {
    return rng.chance(0.5)
      ? lattice(rng, width, height, heat)
      : threads(rng, width, height, heat);
  },
};

/** Blobs on a shaken hexagonal lattice over the left half. */
function lattice(
  rng: Rng,
  width: number,
  height: number,
  heat: number
): Rect[] {
  const spacing = height / rng.range(3.4, 4.8);
  const fill = 0.18 + heat * 0.08;
  const walls: Rect[] = [];
  for (let row = 0; row * spacing * 0.87 < height + spacing; row++) {
    const y = row * spacing * 0.87;
    for (let x = (row % 2) * (spacing / 2); x < width / 2; x += spacing) {
      if (rng.chance(0.2)) {
        continue;
      }
      const cx = x + (rng.float() - 0.5) * spacing * 0.35;
      const cy = y + (rng.float() - 0.5) * spacing * 0.35;
      const radius = spacing * (fill + rng.float() * 0.12);
      if (!nearSpawn(cx, cy, radius, width, height)) {
        walls.push(blob(cx, cy, radius));
      }
    }
  }
  return walls;
}

/** Threads that grow in from the top edge, wander and branch. */
function threads(
  rng: Rng,
  width: number,
  height: number,
  heat: number
): Rect[] {
  const walls: Rect[] = [];
  const grow = (
    x: number,
    y: number,
    angle: number,
    radius: number,
    length: number,
    canBranch: boolean
  ): void => {
    const branchAt = length * rng.range(0.35, 0.55);
    for (let travelled = 0; travelled < length; travelled += 3) {
      const taper = 1 - (travelled / length) * 0.6;
      if (nearSpawn(x, y, radius * taper, width, height)) {
        return;
      }
      walls.push(blob(x, y, Math.max(2, radius * taper)));
      if (canBranch && travelled >= branchAt) {
        canBranch = false;
        grow(
          x,
          y,
          angle + (rng.chance(0.5) ? -1 : 1) * rng.range(0.7, 1.1),
          radius * taper * 0.8,
          (length - travelled) * 0.7,
          false
        );
      }
      // Wander, but keep growing away from the edge.
      angle += (rng.float() - 0.5) * 0.5;
      angle += (Math.PI / 2 - angle) * 0.08;
      x += Math.cos(angle) * 3;
      y += Math.sin(angle) * 3;
    }
  };
  const count = rng.int(3, 4);
  for (let i = 0; i < count; i++) {
    // From the top over the left half; the mirror grows them from the bottom.
    grow(
      ((width / 2) * (i + 0.5)) / count + rng.range(-8, 8),
      -2,
      Math.PI / 2 + rng.range(-0.3, 0.3),
      rng.range(4, 6),
      height * rng.range(0.4, 0.5 + heat * 0.15),
      true
    );
  }
  return walls;
}

export const RECIPES: Readonly<Record<RecipeId, Recipe>> = {
  field,
  corridor,
  fortress,
  cave,
};
