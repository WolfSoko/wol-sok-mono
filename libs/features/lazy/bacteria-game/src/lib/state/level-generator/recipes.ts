import type { levels as levelTexts } from '../../i18n/en/levels';
import { Rect } from '../maps';
import {
  blob,
  growThread,
  hexLattice,
  rectNearSpawn,
  spawnSpots,
} from '../shapes';
import { Rng } from './rng';

/** The kinds of layout the generator makes - its styles. */
export const RECIPE_IDS = ['field', 'corridor', 'fortress', 'cave'] as const;
export type RecipeId = (typeof RECIPE_IDS)[number];

export function isRecipeId(value: unknown): value is RecipeId {
  return RECIPE_IDS.includes(value as RecipeId);
}

/**
 * A style of generated layout: how it lays out the left half of the arena -
 * the generator mirrors it into the right one - and what it aims at.
 */
export interface Recipe {
  /** The style's name in the level choice - "Corridors". */
  label: string;
  /**
   * The second word of a generated name - "Quiet Corridors" - by its id in
   * the dictionaries, which place the adjective before it.
   */
  nouns: readonly GeneratedNoun[];
  /** The briefing of a generated level. */
  description: string;
  /** How winding the way between the start spots should be - see `detour`. */
  detour: number;
  /** Hand-made levels whose look a generated one borrows. */
  family: readonly string[];
  /**
   * The walls of the left half on an arena of that size; `heat` runs from 0
   * (calm) to 1 (frantic) and tightens what the recipe builds.
   */
  build(rng: Rng, width: number, height: number, heat: number): Rect[];
}

/** A noun a generated name can end on. */
export type GeneratedNoun = keyof typeof levelTexts.generated.nouns;

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
  label: 'Field',
  nouns: ['meadow', 'flats', 'garden', 'plain', 'shallows'],
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
  label: 'Corridors',
  nouns: ['corridors', 'halls', 'passage', 'lanes', 'locks'],
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
  label: 'Fortress',
  nouns: ['keep', 'bastion', 'citadel', 'ramparts', 'redoubt'],
  description: 'A keep around each colony, with doors to hold or to storm.',
  detour: 1.45,
  family: ['twin-chambers', 'inner-ring'],
  build(rng, width, height, heat) {
    const [spawn] = spawnSpots(width, height);
    const reach = rng.int(30, 38);
    const thickness = rng.int(4, 6);
    const door = Math.round(26 - heat * 8);
    const left = spawn.x - reach;
    const top = spawn.y - reach;
    const span = 2 * reach;
    const side = (wall: Rect, hasDoor: boolean) =>
      hasDoor ? withDoor(wall, door, rng) : [wall];
    // The side towards the enemy always has a door, top and bottom now and
    // then, and the back - against the arena's edge - none, if it is there.
    const walls = [
      ...side(
        { x: left + span, y: top, width: thickness, height: span + thickness },
        true
      ),
      ...side(
        { x: left, y: top, width: span, height: thickness },
        rng.chance(0.5)
      ),
      ...side(
        { x: left, y: top + span, width: span, height: thickness },
        rng.chance(0.5)
      ),
    ];
    if (rng.chance(0.35)) {
      walls.push({ x: left, y: top, width: thickness, height: span });
    }
    return [
      ...walls,
      ...pillars(rng, width, height, rng.int(2, 6), { min: 5, max: 10 }).filter(
        (pillar) => pillar.x > left + span + thickness + 4
      ),
    ];
  },
};

/** A straight wall with a door of that size somewhere along its length. */
function withDoor(wall: Rect, door: number, rng: Rng): Rect[] {
  const upright = wall.height > wall.width;
  const length = upright ? wall.height : wall.width;
  const at = rng.int(6, Math.max(6, length - door - 6));
  const rest = length - at - door;
  return upright
    ? [
        { ...wall, height: at },
        { ...wall, y: wall.y + at + door, height: rest },
      ]
    : [
        { ...wall, width: at },
        { ...wall, x: wall.x + at + door, width: rest },
      ];
}

/**
 * Round walls like living tissue: air sacs packed in a lattice, or threads
 * growing in from the edges - channels and no straight line anywhere.
 */
const cave: Recipe = {
  label: 'Cave',
  nouns: ['caverns', 'grotto', 'hollows', 'burrow', 'tissue'],
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

/** Air sacs on a lattice, packed tighter the hotter the level. */
function lattice(
  rng: Rng,
  width: number,
  height: number,
  heat: number
): Rect[] {
  return hexLattice(() => rng.float(), width, height, {
    spacing: height / rng.range(3.4, 4.8),
    jitter: 0.35,
    fill: 0.18 + heat * 0.08,
    spread: 0.12,
    skip: 0.2,
  });
}

/** Threads that grow in from the top edge over the left half. */
function threads(
  rng: Rng,
  width: number,
  height: number,
  heat: number
): Rect[] {
  const walls: Rect[] = [];
  const count = rng.int(3, 4);
  for (let i = 0; i < count; i++) {
    // The mirror grows them in from the bottom on the right.
    growThread(() => rng.float(), walls, width, height, {
      x: ((width / 2) * (i + 0.5)) / count + rng.range(-8, 8),
      y: -2,
      angle: Math.PI / 2 + rng.range(-0.3, 0.3),
      radius: rng.range(4, 6),
      length: height * rng.range(0.4, 0.5 + heat * 0.15),
    });
  }
  return walls;
}

export const RECIPES: Readonly<Record<RecipeId, Recipe>> = {
  field,
  corridor,
  fortress,
  cave,
};
