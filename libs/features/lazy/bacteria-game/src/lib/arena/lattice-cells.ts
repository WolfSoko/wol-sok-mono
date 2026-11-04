import { clamp, type ColonyLook } from '@wolsok/feat-shared-bacteria-engine';
import { LOOK_TUNING, type LookDescription } from './look-tuning';
import { hash, smoothstep } from './canvas-math';
import { sampleDensity } from './slime-painter';

const {
  CELL_SPACING,
  CELL_ROW_HEIGHT,
  CELL_JITTER,
  CELL_MIN,
  CELL_GROW,
  CELL_SIZE_FROM,
  CELL_SIZE_RANGE,
  CELL_RADIUS,
  CELL_RADIUS_MIN,
  CELL_RADIUS_VARY,
  TILE_SPACING,
  CRYSTAL_JITTER,
  CRYSTAL_SHADE_MIN,
  CRYSTAL_SHADE_VARY,
  BUBBLE_SPACING,
  BUBBLE_RADIUS,
  BUBBLE_RADIUS_MIN,
  BUBBLE_RADIUS_VARY,
  MARBLE_SPACING,
  MARBLE_RADIUS,
  MARBLE_RADIUS_MIN,
  MARBLE_RADIUS_VARY,
} = LOOK_TUNING;

/**
 * The lattice a look's cells or bubbles sit on: its spacing in base cells,
 * and the cells' radius in spacings, varied by lattice point from `min` up
 * by `vary`.
 */
export interface LatticeCells {
  spacing: number;
  radius: number;
  min: number;
  vary: number;
}

export const CELLS: LatticeCells = {
  spacing: CELL_SPACING,
  radius: CELL_RADIUS,
  min: CELL_RADIUS_MIN,
  vary: CELL_RADIUS_VARY,
};
export const BUBBLES: LatticeCells = {
  spacing: BUBBLE_SPACING,
  radius: BUBBLE_RADIUS,
  min: BUBBLE_RADIUS_MIN,
  vary: BUBBLE_RADIUS_VARY,
};
export const MARBLES: LatticeCells = {
  spacing: MARBLE_SPACING,
  radius: MARBLE_RADIUS,
  min: MARBLE_RADIUS_MIN,
  vary: MARBLE_RADIUS_VARY,
};

/**
 * How far past the colony a lattice look reaches, in base cells: a cell's
 * centre lies within a cell of the colony, and its body reaches `radius`
 * base cells from there.
 */
function latticeReach(radius: number): number {
  return Math.ceil(radius) + 1;
}

/** The biggest cell of a lattice. */
function cellsReach({ spacing, radius, min, vary }: LatticeCells): number {
  return latticeReach(spacing * radius * (min + vary));
}

/** A facet strayed from its lattice point and filled to the next centre. */
const TILES_REACH = latticeReach(TILE_SPACING * (0.5 + CRYSTAL_JITTER));

export const LOOKS: Readonly<Record<ColonyLook, LookDescription>> = {
  slime: { fromDensity: true, reach: 0, glIndex: 0 },
  pixels: { fromDensity: false, reach: 0, glIndex: 1 },
  cells: {
    fromDensity: true,
    reach: cellsReach(CELLS),
    glIndex: 2,
  },
  honeycomb: {
    fromDensity: true,
    reach: TILES_REACH,
    glIndex: 3,
  },
  crystal: {
    fromDensity: true,
    reach: TILES_REACH,
    glIndex: 4,
  },
  neon: { fromDensity: true, reach: 0, glIndex: 5 },
  ink: { fromDensity: true, reach: 0, glIndex: 6 },
  bubbles: {
    fromDensity: true,
    reach: cellsReach(BUBBLES),
    glIndex: 7,
  },
  marbles: {
    fromDensity: true,
    reach: cellsReach(MARBLES),
    glIndex: 8,
  },
  lava: { fromDensity: true, reach: 0, glIndex: 9 },
  galaxy: { fromDensity: true, reach: 0, glIndex: 10 },
  plasma: { fromDensity: true, reach: 0, glIndex: 11 },
  chrome: { fromDensity: true, reach: 0, glIndex: 12 },
  eclipse: { fromDensity: true, reach: 0, glIndex: 13 },
};

/** How many cells past the colony a look reaches on a grid of that unit. */
export function lookReach(look: ColonyLook, unit: number): number {
  return Math.ceil(LOOKS[look].reach * unit);
}

/** One cell of the cells look: its centre in arena cells and its radius. */
export interface CellBubble {
  x: number;
  y: number;
  radius: number;
}

/** The lattice cell a column and row of the cells look sit on. */
export function cellLatticeOffset(row: number, spacing: number): number {
  return (row & 1) === 1 ? spacing * 0.5 : 0;
}

/**
 * The cell of a lattice point, or null where the colony is too thin for
 * one. Its size and place come from the lattice point - as hashes - and the
 * density under its centre, so a cell stays where it is from frame to frame
 * and only grows or shrinks with the colony.
 */
export function cellBubble(
  col: number,
  row: number,
  cells: LatticeCells,
  /** Arena cells per base cell - the cells are as big on every grid. */
  unit: number,
  density: Float32Array,
  width: number,
  height: number
): CellBubble | null {
  const spacing = cells.spacing * unit;
  const rowHeight = spacing * CELL_ROW_HEIGHT;
  const x =
    (col + 0.5) * spacing +
    cellLatticeOffset(row, spacing) +
    (hash(col, row, 1) - 0.5) * spacing * CELL_JITTER;
  const y =
    (row + 0.5) * rowHeight +
    (hash(col, row, 2) - 0.5) * rowHeight * CELL_JITTER;
  const d = sampleDensity(density, width, height, x, y);
  if (d < CELL_MIN) {
    return null;
  }
  const size =
    (0.5 + 0.5 * clamp((d - CELL_SIZE_FROM) / CELL_SIZE_RANGE, 0, 1)) *
    smoothstep(CELL_MIN, CELL_MIN + CELL_GROW, d);
  const radius =
    spacing *
    cells.radius *
    size *
    (cells.min + cells.vary * hash(col, row, 3));
  return { x, y, radius };
}

/**
 * The tile of a lattice point for the honeycomb or the crystal look: its
 * centre, the density under it and - for the crystal - its shade.
 */
export function latticeTile(
  col: number,
  row: number,
  spacing: number,
  crystal: boolean,
  density: Float32Array,
  width: number,
  height: number
): { x: number; y: number; density: number; shade: number } {
  const rowHeight = spacing * CELL_ROW_HEIGHT;
  let x = (col + 0.5) * spacing + cellLatticeOffset(row, spacing);
  let y = (row + 0.5) * rowHeight;
  if (crystal) {
    x += (hash(col, row, 4) - 0.5) * spacing * CRYSTAL_JITTER * 2;
    y += (hash(col, row, 5) - 0.5) * rowHeight * CRYSTAL_JITTER * 2;
  }
  return {
    x,
    y,
    density: sampleDensity(density, width, height, x, y),
    shade: CRYSTAL_SHADE_MIN + CRYSTAL_SHADE_VARY * hash(col, row, 6),
  };
}

/** How a colony is hatched in the ink look. */
export interface HatchPattern {
  /** The direction of the lines, a unit vector. */
  direction: readonly [number, number];
  /** Crossed with lines at a right angle everywhere, not only where thin. */
  cross: boolean;
}

/**
 * The hatching of a colony of that colour in the ink look, one of eight by
 * its hue - four directions of single lines and four of crossed ones - so
 * every colony of the palette is told apart from every other without its
 * colour. Red, orange and yellow, 50 degrees apart, get bins of their own.
 */
export function hatchPattern(color: readonly number[]): HatchPattern {
  const [r, g, b] = color;
  let hue = (Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180) / Math.PI;
  if (hue < HUE_START) {
    hue += 360;
  }
  const bin = HUE_BINS.filter((edge) => hue >= edge).length;
  return HATCH_PATTERNS[bin];
}

/** The hue each bin of {@link HATCH_PATTERNS} starts at, after the first. */
const HUE_START = -25;
const HUE_BINS = [10, 35, 90, 160, 200, 240, 300];

const unit = (degrees: number): [number, number] => [
  Math.cos((degrees * Math.PI) / 180),
  Math.sin((degrees * Math.PI) / 180),
];

/** Red, orange, yellow, green, cyan, blue, purple and pink. */
const HATCH_PATTERNS: readonly HatchPattern[] = [
  { direction: unit(45), cross: false },
  { direction: unit(135), cross: false },
  { direction: unit(0), cross: false },
  { direction: unit(90), cross: false },
  { direction: unit(22.5), cross: true },
  { direction: unit(67.5), cross: true },
  { direction: unit(0), cross: true },
  { direction: unit(45), cross: true },
];
