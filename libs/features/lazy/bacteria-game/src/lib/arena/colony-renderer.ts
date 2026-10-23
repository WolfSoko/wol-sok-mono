import { BacteriaLook } from '../settings.service';
import { Nutrient } from '../state/bacteria-simulation';
import { GameBalance, gameBalance } from '../state/game-balance';
import {
  CellBounds,
  clamp,
  emptyBounds,
  growBounds,
  Point,
} from '../state/geometry';
import { Rect } from '../state/maps';
import { Bacteria } from '../state/player.model';
import { Rgb } from './arena-theme';
import { createCanvas, hash, lerp, mix, rgba, smoothstep } from './canvas-math';

import type { ColonyLayer } from '../state/simulation';

export type { CellsLayer, ColonyLayer, StateLayer } from '../state/simulation';

/** The shimmer of a boosted colony at one moment. */
export interface BoostShimmer {
  timeSec: number;
  /** The crosshair the waves run into, in arena cells. */
  target: Point;
  /** Arena cells per cell of the base arena - the waves are as wide on any grid. */
  unit: number;
}

/**
 * How many slime pixels there are per arena cell along each axis. The
 * outline is found on this finer grid, so the edge of a colony is a smooth
 * curve instead of a staircase of cells.
 */
export const SLIME_SCALE = 2;

/** Density at which the slime starts, and where it is fully opaque. */
const SLIME_EDGE_START = 0.07;
const SLIME_EDGE_END = 0.17;
/** Where the light comes from - the top left, as for every glossy UI. */
const LIGHT_X = -0.6;
const LIGHT_Y = -0.8;

/**
 * Stamps one colony into an RGBA pixel buffer the size of the arena, one
 * pixel per bacterium. Weak bacteria fade out and supercharged ones burn
 * white, so the state of a fight is visible at a glance; a boosted colony
 * shimmers with waves of light running towards its crosshair.
 *
 * The energy thresholds come from the balance of the running level, so a
 * level that moves them still renders the fight truthfully.
 */
export function createImageDataFromBacterias(
  data8: Uint8ClampedArray,
  width: number,
  color: readonly number[],
  bacterias: readonly Bacteria[],
  balance: GameBalance = gameBalance,
  shimmer: BoostShimmer | null = null
): Uint8ClampedArray {
  const [r, g, b, alpha] = color;
  for (let i = 0; i < bacterias.length; i++) {
    const { x, y, energy } = bacterias[i];
    const data8index = (y * width + x) * 4;

    let heat = overcharge(energy, balance);
    if (shimmer != null) {
      heat = Math.max(heat, shimmerAt(x, y, shimmer));
    }
    if (heat > 0) {
      // Supercharged or boosted - burn white so the hotspots are visible.
      data8[data8index] = r + (255 - r) * heat;
      data8[data8index + 1] = g + (255 - g) * heat;
      data8[data8index + 2] = b + (255 - b) * heat;
      data8[data8index + 3] = alpha;
      continue;
    }

    // Weakened bacteria fade out, but stay visible enough to follow the fight.
    const strength = strengthOf(energy, balance);
    data8[data8index] = r;
    data8[data8index + 1] = g;
    data8[data8index + 2] = b;
    data8[data8index + 3] = alpha * (0.3 + 0.7 * strength * strength);
  }

  return data8;
}

/**
 * The density of a colony on the arena grid: every bacterium adds its
 * strength to its cell, then the field is blurred twice with a 3x3 box -
 * close to a gaussian - so neighbours melt into one blob. `heat` gets the
 * same treatment for the overcharge of each bacterium.
 *
 * Only the cells of `region` are worked out, the bacteria outside it left
 * out - see {@link slimeRegion}.
 *
 * Returns false when no bacterium is overcharged - `heat` is then left as it
 * was and must not be read.
 */
export function colonyDensity(
  density: Float32Array,
  heat: Float32Array,
  scratch: Float32Array,
  width: number,
  height: number,
  bacterias: readonly Bacteria[],
  balance: GameBalance = gameBalance,
  region: CellBounds = wholeArena(width, height)
): boolean {
  density.fill(0);
  let hot = false;
  const { minX, minY, maxX, maxY } = region;
  for (const { x, y, energy } of bacterias) {
    if (x < minX || x > maxX || y < minY || y > maxY) {
      continue;
    }
    const index = y * width + x;
    density[index] += cellDensity(strengthOf(energy, balance));
    const over = overcharge(energy, balance);
    if (over > 0) {
      if (!hot) {
        heat.fill(0);
        hot = true;
      }
      heat[index] += over;
    }
  }
  boxBlur(density, scratch, width, region);
  boxBlur(density, scratch, width, region);
  if (hot) {
    boxBlur(heat, scratch, width, region);
    boxBlur(heat, scratch, width, region);
  }
  return hot;
}

/** Every cell of an arena that size. */
function wholeArena(width: number, height: number): CellBounds {
  return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
}

/**
 * How far around its bacteria a colony's slime is worked out: the blur
 * spreads it by two cells, the slime between the cells reads one more.
 */
const SLIME_REACH = 3;

/**
 * The cells the slime of a colony is worked out on: its bacteria and
 * {@link SLIME_REACH} around them, cut to what the canvas shows - null when
 * none of it is in view. Cut at the view, the blur clamps a few cells short
 * of the truth, so the cut lies {@link SLIME_REACH} cells beyond the view,
 * and `beyondView` more for a look whose cells reach in from past it;
 * around the bacteria the density is zero anyway.
 */
export function slimeRegion(
  bacterias: readonly Bacteria[],
  view: Rect,
  width: number,
  height: number,
  /** How many cells past the view a look still reads - the lattice looks'. */
  beyondView = 0
): CellBounds | null {
  if (bacterias.length === 0) {
    return null;
  }
  const bounds = emptyBounds();
  for (const { x, y } of bacterias) {
    growBounds(bounds, x, y);
  }
  // The cells the view touches, one more for a pixel half in it.
  const reach = SLIME_REACH + 1 + beyondView;
  const minX = Math.max(
    0,
    bounds.minX - SLIME_REACH,
    Math.floor(view.x) - reach
  );
  const minY = Math.max(
    0,
    bounds.minY - SLIME_REACH,
    Math.floor(view.y) - reach
  );
  const maxX = Math.min(
    width - 1,
    bounds.maxX + SLIME_REACH,
    Math.ceil(view.x + view.width) + reach
  );
  const maxY = Math.min(
    height - 1,
    bounds.maxY + SLIME_REACH,
    Math.ceil(view.y + view.height) + reach
  );
  return minX > maxX || minY > maxY ? null : { minX, minY, maxX, maxY };
}

/**
 * Turns the density of a colony into slime on a buffer {@link SLIME_SCALE}
 * times the size of the arena: the outline where the density crosses a
 * threshold, a dark rim just inside it, a glossy highlight where the surface
 * faces the light, white heat where the colony is overcharged - and, while
 * it is boosted, waves of light running towards its crosshair with a sparkle
 * here and there.
 *
 * The density is sampled bilinearly between the cells, which is what makes
 * the outline round. `heat` is null when nothing is overcharged. Only the
 * pixels of `region`'s cells are painted.
 */
export function paintSlime(
  data8: Uint8ClampedArray,
  density: Float32Array,
  heat: Float32Array | null,
  width: number,
  height: number,
  color: readonly number[],
  shimmer: BoostShimmer | null,
  region: CellBounds = wholeArena(width, height)
): void {
  const [r, g, b] = color;
  const outWidth = width * SLIME_SCALE;
  const step = 1 / SLIME_SCALE;
  const fromX = region.minX * SLIME_SCALE;
  const toX = (region.maxX + 1) * SLIME_SCALE;

  for (
    let py = region.minY * SLIME_SCALE;
    py < (region.maxY + 1) * SLIME_SCALE;
    py++
  ) {
    // Pixel centres, in cell units, shifted so a cell's centre is a lattice point.
    const gy = (py + 0.5) * step - 0.5;
    const y0 = clamp(Math.floor(gy), 0, height - 1);
    const y1 = clamp(y0 + 1, 0, height - 1);
    const fy = clamp(gy - y0, 0, 1);
    for (let px = fromX; px < toX; px++) {
      const gx = (px + 0.5) * step - 0.5;
      const x0 = clamp(Math.floor(gx), 0, width - 1);
      const x1 = clamp(x0 + 1, 0, width - 1);
      const i00 = y0 * width + x0;
      const i10 = y0 * width + x1;
      const i01 = y1 * width + x0;
      const i11 = y1 * width + x1;
      const d00 = density[i00];
      const d10 = density[i10];
      const d01 = density[i01];
      const d11 = density[i11];
      if (d00 + d10 + d01 + d11 < SLIME_EDGE_START) {
        continue;
      }
      const fx = clamp(gx - x0, 0, 1);
      const top = d00 + (d10 - d00) * fx;
      const bottom = d01 + (d11 - d01) * fx;
      const d = top + (bottom - top) * fy;
      const coverage = smoothstep(SLIME_EDGE_START, SLIME_EDGE_END, d);
      if (coverage <= 0) {
        continue;
      }

      // The slope of the surface, straight from the four lattice values.
      const slopeX = d10 - d00 + (d11 - d01 - (d10 - d00)) * fy;
      const slopeY = d01 - d00 + (d11 - d10 - (d01 - d00)) * fx;
      const facing = -(slopeX * LIGHT_X + slopeY * LIGHT_Y);
      const lit = clamp(facing * 5, 0, 1);
      const gloss = lit * lit * lit;
      // Thick slime is deeper in colour; the edge is a darker rim.
      const depth = 0.8 + 0.2 * (1 - Math.min(1, d));
      const rim = 1 - 0.45 * coverage * (1 - coverage) * 4;
      let shade = depth * rim;

      let white = gloss * 0.75;
      if (heat != null) {
        const hTop = lerp(heat[i00], heat[i10], fx);
        const hBottom = lerp(heat[i01], heat[i11], fx);
        const hot = Math.min(1, lerp(hTop, hBottom, fy) / Math.max(d, 0.05));
        white = Math.max(white, hot);
      }
      if (shimmer != null) {
        const wave = shimmerAt(px * step, py * step, shimmer);
        white = Math.max(white, wave * 0.8);
        shade = Math.max(shade, 0.85 + 0.15 * wave);
        if (sparkle(px, py, shimmer.timeSec)) {
          white = 1;
        }
      }

      const index = (py * outWidth + px) * 4;
      data8[index] = r * shade + (255 - r * shade) * white;
      data8[index + 1] = g * shade + (255 - g * shade) * white;
      data8[index + 2] = b * shade + (255 - b * shade) * white;
      data8[index + 3] = 240 * coverage;
    }
  }
}

/**
 * What a look is to the painters: whether it is drawn from the colony's
 * blurred density on the fine, smoothly scaled layer - every look but the
 * pixels - how far past the slime's edge it reads and draws, and its value
 * of `uLook` in the colony shader. Both painters read a look from here, so
 * a new look is described once.
 */
export interface LookDescription {
  fromDensity: boolean;
  /**
   * How far past the colony the look reaches, in base cells: the lattice
   * looks lay cells and tiles whose centres lie within the colony but whose
   * bodies reach out, so they read the density and draw that much further.
   */
  reach: number;
  glIndex: number;
}

/**
 * How far a cell or a tile of the lattice looks can reach past the colony,
 * in base cells: a cell's centre lies within a cell of the colony, its
 * radius is at most `CELL_RADIUS` spacings and a bit, a facet strays
 * `CRYSTAL_JITTER` spacings and fills to the next centre.
 */
const LATTICE_REACH = 3;
/** The bubbles are bigger: `BUBBLE_RADIUS` spacings and a bit, from within a cell. */
const BUBBLE_REACH = 5;

export const LOOKS: Readonly<Record<BacteriaLook, LookDescription>> = {
  slime: { fromDensity: true, reach: 0, glIndex: 0 },
  pixels: { fromDensity: false, reach: 0, glIndex: 1 },
  cells: { fromDensity: true, reach: LATTICE_REACH, glIndex: 2 },
  honeycomb: { fromDensity: true, reach: LATTICE_REACH, glIndex: 3 },
  crystal: { fromDensity: true, reach: LATTICE_REACH, glIndex: 4 },
  neon: { fromDensity: true, reach: 0, glIndex: 5 },
  ink: { fromDensity: true, reach: 0, glIndex: 6 },
  bubbles: { fromDensity: true, reach: BUBBLE_REACH, glIndex: 7 },
};

/** How many cells past the colony a look reaches on a grid of that unit. */
export function lookReach(look: BacteriaLook, unit: number): number {
  return Math.ceil(LOOKS[look].reach * unit);
}

/**
 * The numbers the looks are tuned by, in one place for both painters: the
 * colony shader gets every one of them as a `const float` of the same name
 * (see `COLONY_FRAGMENT`), so the Canvas and the WebGL painter cannot
 * drift apart. Lengths are in base cells or in spacings, densities on the
 * blurred density's scale, shares from 0 to 1.
 *
 * Cells, as on the app icon: glossy round cells of different sizes on a
 * dark base, on a jittered hex lattice `CELL_SPACING` base cells apart. A
 * cell exists where the density at its centre reaches `CELL_MIN`, grows in
 * over `CELL_GROW` and with the density from `CELL_SIZE_FROM` over
 * `CELL_SIZE_RANGE`, so the cells are small along the front and where the
 * colony is weak, big and tightly packed inside. The WebGL painter draws
 * the same lattice, jittered by its own hash - the two painters agree on
 * the look, not on each cell.
 *
 * Honeycomb and crystal: the colony tiled, every tile the nearest point of
 * a hex lattice `TILE_SPACING` apart - the honeycomb's regular, the
 * crystal's jittered by `CRYSTAL_JITTER` into irregular facets. A tile is
 * laid where the density under its centre reaches `TILE_MIN`. The
 * honeycomb's tiles are glossy with dark seams `TILE_SEAM` wide, the
 * crystal's facets flat, each its own shade, with bright seams.
 *
 * Neon: a dark body whose outline glows in the colony's colour, with a
 * fainter line further in and a soft halo outside.
 *
 * Ink: a flat body hatched with lines `INK_HATCH_SPACING` apart - crossed
 * where the colony is thin - and a thick outline in ink. Each colony is
 * hatched in its own pattern ({@link hatchPattern}).
 *
 * Bubbles: glassy bubbles of different sizes on the cells' lattice,
 * `BUBBLE_SPACING` apart - a faint film, a bright rim and a light spot -
 * each with two or three snippets of DNA inside, double helices that drift
 * around and turn slowly with the time, over a thinner base.
 */
export const LOOK_TUNING = {
  CELL_SPACING: 3.4,
  /** The height of a lattice row, in spacings - a hex lattice. */
  CELL_ROW_HEIGHT: 0.866,
  /** How far a cell's centre strays from its lattice point, in spacings. */
  CELL_JITTER: 0.5,
  CELL_MIN: 0.12,
  CELL_GROW: 0.08,
  CELL_SIZE_FROM: 0.15,
  CELL_SIZE_RANGE: 0.6,
  /** The biggest cell, in spacings - neighbours just overlap. */
  CELL_RADIUS: 0.62,
  /** A cell's radius varies by lattice point, from this share up by this much. */
  CELL_RADIUS_MIN: 0.82,
  CELL_RADIUS_VARY: 0.36,
  /** Where the light spot sits on a cell, on its unit disc. */
  CELL_FOCAL_X: -0.35,
  CELL_FOCAL_Y: -0.4,
  /** The sphere gradient: light to the body colour to here, dark beyond. */
  SPHERE_BODY_STOP: 0.55,
  SPHERE_REACH: 1.25,
  /** The light and the dark shade of the colour, towards white and black. */
  TINT_LIGHT: 0.55,
  TINT_DARK: 0.5,
  /** The base under the cells and the tiles: how dark, and how opaque. */
  CELL_BASE: 0.42,
  BASE_ALPHA: 0.92,
  /** The density below which no cell shows, so none floats over bare floor. */
  CELL_CLIP_START: 0.03,
  CELL_CLIP_END: 0.09,
  TILE_SPACING: 2.8,
  TILE_MIN: 0.12,
  TILE_FADE: 0.1,
  /** The sphere a honeycomb tile is shaded as, in spacings. */
  TILE_RADIUS: 0.55,
  CRYSTAL_JITTER: 0.3,
  TILE_SEAM: 0.12,
  /** How dark the honeycomb's seams are. */
  SEAM_DARK: 0.45,
  /** A crystal facet's shade, from this up by this much, by lattice point. */
  CRYSTAL_SHADE_MIN: 0.7,
  CRYSTAL_SHADE_VARY: 0.5,
  NEON_LINE_START: 0.04,
  NEON_LINE_END: 0.24,
  NEON_INNER_START: 0.38,
  NEON_INNER_END: 0.45,
  NEON_INNER_GLOW: 0.6,
  NEON_LIGHT: 0.45,
  NEON_HALO: 0.45,
  NEON_BODY: 0.22,
  NEON_BODY_ALPHA: 0.85,
  INK_HATCH_SPACING: 2.2,
  INK_HATCH_WIDTH: 0.4,
  INK_OUTLINE_END: 0.31,
  INK_CROSS_BELOW: 0.45,
  INK: 0.18,
  INK_HATCH: 0.62,
  INK_ALPHA: 0.95,
  BUBBLE_SPACING: 4.4,
  /** A bubble's radius in spacings, varied by lattice point from this share up by this much. */
  BUBBLE_RADIUS: 0.72,
  BUBBLE_RADIUS_MIN: 0.55,
  BUBBLE_RADIUS_VARY: 0.7,
  BUBBLE_BASE_ALPHA: 0.7,
  /** The film of a bubble: how opaque, and the rim and the light spot on it. */
  BUBBLE_FILM: 0.2,
  BUBBLE_RIM_START: 0.72,
  BUBBLE_RIM_END: 0.96,
  BUBBLE_RIM: 0.9,
  BUBBLE_SPOT_START: 0.12,
  BUBBLE_SPOT_END: 0.3,
  /** A DNA snippet on the bubble's unit disc: half its length, its helix and its drift. */
  DNA_HALF_MIN: 0.22,
  DNA_HALF_VARY: 0.3,
  DNA_AMPLITUDE: 0.07,
  DNA_TWIST: 14,
  DNA_WIDTH: 0.025,
  DNA_RUNG: 0.35,
  DNA_ORBIT_MIN: 0.12,
  DNA_ORBIT_VARY: 0.4,
  DNA_DRIFT: 0.2,
  DNA_SPIN: 0.4,
} as const;

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
  CELL_FOCAL_X,
  CELL_FOCAL_Y,
  SPHERE_BODY_STOP,
  SPHERE_REACH,
  TINT_LIGHT,
  TINT_DARK,
  CELL_BASE,
  BASE_ALPHA,
  CELL_CLIP_START,
  CELL_CLIP_END,
  TILE_SPACING,
  TILE_MIN,
  TILE_FADE,
  TILE_RADIUS,
  CRYSTAL_JITTER,
  TILE_SEAM,
  SEAM_DARK,
  CRYSTAL_SHADE_MIN,
  CRYSTAL_SHADE_VARY,
  NEON_LINE_START,
  NEON_LINE_END,
  NEON_INNER_START,
  NEON_INNER_END,
  NEON_INNER_GLOW,
  NEON_LIGHT,
  NEON_HALO,
  NEON_BODY,
  NEON_BODY_ALPHA,
  INK_HATCH_SPACING,
  INK_HATCH_WIDTH,
  INK_OUTLINE_END,
  INK_CROSS_BELOW,
  INK,
  INK_HATCH,
  INK_ALPHA,
  BUBBLE_SPACING,
  BUBBLE_RADIUS,
  BUBBLE_RADIUS_MIN,
  BUBBLE_RADIUS_VARY,
  BUBBLE_BASE_ALPHA,
  BUBBLE_FILM,
  BUBBLE_RIM_START,
  BUBBLE_RIM_END,
  BUBBLE_RIM,
  BUBBLE_SPOT_START,
  BUBBLE_SPOT_END,
  DNA_HALF_MIN,
  DNA_HALF_VARY,
  DNA_AMPLITUDE,
  DNA_TWIST,
  DNA_WIDTH,
  DNA_RUNG,
  DNA_ORBIT_MIN,
  DNA_ORBIT_VARY,
  DNA_DRIFT,
  DNA_SPIN,
} = LOOK_TUNING;

/** How big the cells of a lattice look are, in spacings, and how they vary. */
interface CellShape {
  radius: number;
  min: number;
  vary: number;
}

const CELL_SHAPE: CellShape = {
  radius: CELL_RADIUS,
  min: CELL_RADIUS_MIN,
  vary: CELL_RADIUS_VARY,
};
const BUBBLE_SHAPE: CellShape = {
  radius: BUBBLE_RADIUS,
  min: BUBBLE_RADIUS_MIN,
  vary: BUBBLE_RADIUS_VARY,
};

/** One cell of the cells look: its centre in arena cells and its radius. */
export interface CellBubble {
  x: number;
  y: number;
  radius: number;
}

/** The lattice cell a column and row of the cells look sit on. */
function cellLatticeOffset(row: number, spacing: number): number {
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
  spacing: number,
  density: Float32Array,
  width: number,
  height: number,
  shape: CellShape = CELL_SHAPE
): CellBubble | null {
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
    shape.radius *
    size *
    (shape.min + shape.vary * hash(col, row, 3));
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

/**
 * The density at an arena position, between the cells' centres - a cell's
 * centre is its lattice point, as in {@link paintSlime} and
 * {@link paintLook}, which inline the same sampling.
 */
function sampleDensity(
  density: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  const gx = x - 0.5;
  const gy = y - 0.5;
  const x0 = clamp(Math.floor(gx), 0, width - 1);
  const y0 = clamp(Math.floor(gy), 0, height - 1);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);
  const fx = clamp(gx - x0, 0, 1);
  const fy = clamp(gy - y0, 0, 1);
  const top = lerp(density[y0 * width + x0], density[y0 * width + x1], fx);
  const bottom = lerp(density[y1 * width + x0], density[y1 * width + x1], fx);
  return lerp(top, bottom, fy);
}

/**
 * The colour of a look at a layer pixel, written into `out` as r, g, b
 * from 0 to 255, and its alpha returned - 0 for a pixel the look leaves
 * clear. `x` and `y` are the pixel's centre in arena cells and `d` the
 * density under it.
 */
type LookShader = (
  x: number,
  y: number,
  d: number,
  out: Float64Array
) => number;

/**
 * The white a pixel burns with: the heat of an overcharged colony, and
 * while it is boosted, the waves of light and the sparkles every look
 * shares.
 */
function burn(
  heat: number,
  x: number,
  y: number,
  px: number,
  py: number,
  shimmer: BoostShimmer | null
): number {
  let white = heat;
  if (shimmer != null) {
    white = Math.max(white, shimmerAt(x, y, shimmer) * 0.8);
    if (sparkle(px, py, shimmer.timeSec)) {
      white = 1;
    }
  }
  return white;
}

/**
 * Paints a look that is worked out pixel by pixel from the density, like
 * the slime, onto a buffer {@link SLIME_SCALE} times the size of the arena:
 * `shade` gives each pixel its colour, and over it comes what every look
 * {@link burn}s with. Pixels under `minDensity` are skipped before `shade`
 * is asked. Only the pixels of `region`'s cells are painted.
 */
function paintLook(
  data8: Uint8ClampedArray,
  density: Float32Array,
  heat: Float32Array | null,
  width: number,
  height: number,
  shimmer: BoostShimmer | null,
  region: CellBounds,
  minDensity: number,
  shade: LookShader
): void {
  const outWidth = width * SLIME_SCALE;
  const step = 1 / SLIME_SCALE;
  const fromX = region.minX * SLIME_SCALE;
  const toX = (region.maxX + 1) * SLIME_SCALE;
  const out = new Float64Array(3);

  for (
    let py = region.minY * SLIME_SCALE;
    py < (region.maxY + 1) * SLIME_SCALE;
    py++
  ) {
    // Pixel centres, in cell units, shifted so a cell's centre is a lattice
    // point - the sampling of paintSlime, its rows worked out once.
    const y = (py + 0.5) * step;
    const gy = y - 0.5;
    const y0 = clamp(Math.floor(gy), 0, height - 1);
    const y1 = clamp(y0 + 1, 0, height - 1);
    const fy = clamp(gy - y0, 0, 1);
    const row0 = y0 * width;
    const row1 = y1 * width;
    for (let px = fromX; px < toX; px++) {
      const x = (px + 0.5) * step;
      const gx = x - 0.5;
      const x0 = clamp(Math.floor(gx), 0, width - 1);
      const x1 = clamp(x0 + 1, 0, width - 1);
      const fx = clamp(gx - x0, 0, 1);
      const top = lerp(density[row0 + x0], density[row0 + x1], fx);
      const bottom = lerp(density[row1 + x0], density[row1 + x1], fx);
      const d = lerp(top, bottom, fy);
      if (d < minDensity) {
        continue;
      }
      const alpha = shade(x, y, d, out);
      if (alpha <= 0) {
        continue;
      }

      let hot = 0;
      if (heat != null) {
        const hTop = lerp(heat[row0 + x0], heat[row0 + x1], fx);
        const hBottom = lerp(heat[row1 + x0], heat[row1 + x1], fx);
        hot = Math.min(1, lerp(hTop, hBottom, fy) / Math.max(d, 0.05));
      }
      const white = burn(hot, x, y, px, py, shimmer);

      const index = (py * outWidth + px) * 4;
      data8[index] = out[0] + (255 - out[0]) * white;
      data8[index + 1] = out[1] + (255 - out[1]) * white;
      data8[index + 2] = out[2] + (255 - out[2]) * white;
      data8[index + 3] = 255 * alpha;
    }
  }
}

/**
 * The points of a lattice look around a region, one ring more, each with
 * `stride` values worked out once by `fill` - a pixel then only looks the
 * nine around it up ({@link latticeNeighbours}).
 */
interface Lattice {
  values: Float32Array;
  stride: number;
  spacing: number;
  rowHeight: number;
  row0: number;
  row1: number;
  col0: number;
  cols: number;
}

function buildLattice(
  region: CellBounds,
  spacing: number,
  stride: number,
  fill: (col: number, row: number, at: number, values: Float32Array) => void
): Lattice {
  const rowHeight = spacing * CELL_ROW_HEIGHT;
  const row0 = Math.floor(region.minY / rowHeight) - 1;
  const row1 = Math.floor((region.maxY + 1) / rowHeight) + 1;
  const col0 = Math.floor((region.minX - spacing * 0.5) / spacing) - 1;
  const col1 = Math.floor((region.maxX + 1) / spacing) + 1;
  const cols = col1 - col0 + 1;
  const values = new Float32Array(cols * (row1 - row0 + 1) * stride);
  for (let row = row0; row <= row1; row++) {
    for (let col = col0; col <= col1; col++) {
      fill(col, row, ((row - row0) * cols + (col - col0)) * stride, values);
    }
  }
  return { values, stride, spacing, rowHeight, row0, row1, col0, cols };
}

/**
 * The lattice points around an arena position - the three rows around it,
 * three points each: the index of each one's values goes into `into`, and
 * how many there are comes back.
 */
function latticeNeighbours(
  { stride, spacing, rowHeight, row0, row1, col0, cols }: Lattice,
  x: number,
  y: number,
  into: Int32Array
): number {
  const row = Math.floor(y / rowHeight);
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    const candidateRow = row + dr;
    if (candidateRow < row0 || candidateRow > row1) {
      continue;
    }
    const c0 = Math.floor(
      (x - cellLatticeOffset(candidateRow, spacing)) / spacing
    );
    for (let dc = -1; dc <= 1; dc++) {
      const col = c0 + dc;
      if (col >= col0 && col < col0 + cols) {
        into[count++] = ((candidateRow - row0) * cols + (col - col0)) * stride;
      }
    }
  }
  return count;
}

/**
 * Lays a look's colour in `out` with its alpha over the dark base of the
 * lattice looks, and returns the alpha of both together - 0 for a clear
 * pixel.
 */
function overBase(
  out: Float64Array,
  alpha: number,
  base: Rgb,
  baseAlpha: number
): number {
  const total = alpha + baseAlpha * (1 - alpha);
  if (total > 0) {
    const rest = baseAlpha * (1 - alpha);
    for (let c = 0; c < 3; c++) {
      out[c] = (out[c] * alpha + base[c] * rest) / total;
    }
  }
  return total;
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/** The colony's colour lightened, darkened and as the base under its cells. */
function lookPalette(color: readonly number[]) {
  const rgb: Rgb = [color[0], color[1], color[2]];
  return {
    rgb,
    light: mix(rgb, WHITE, TINT_LIGHT),
    dark: mix(rgb, BLACK, TINT_DARK),
    base: mix(rgb, BLACK, 1 - CELL_BASE),
  };
}

/**
 * The gradient of the icon's cells on a unit disc, at `(ux, uy)`: a light
 * spot at the top left, the body colour around it and a dark rim.
 */
function sphereShade(
  ux: number,
  uy: number,
  { rgb, light, dark }: ReturnType<typeof lookPalette>,
  out: Float64Array
): void {
  const dx = ux - CELL_FOCAL_X;
  const dy = uy - CELL_FOCAL_Y;
  const t = clamp(Math.sqrt(dx * dx + dy * dy) / SPHERE_REACH, 0, 1);
  for (let c = 0; c < 3; c++) {
    out[c] =
      t < SPHERE_BODY_STOP
        ? lerp(light[c], rgb[c], t / SPHERE_BODY_STOP)
        : lerp(
            rgb[c],
            dark[c],
            (t - SPHERE_BODY_STOP) / (1 - SPHERE_BODY_STOP)
          );
  }
}

/**
 * Paints one look of a colony from its density onto a buffer
 * {@link SLIME_SCALE} times the size of the arena, the pixels of `region`'s
 * cells only. `latticeRegion` is where the density is known - `region` and
 * what the look reaches past it ({@link lookReach}) - which the lattice
 * looks lay their cells and tiles on. `unit` is the arena cells per base
 * cell, which keeps every look as big on every grid.
 */
export type LookPainter = (
  data8: Uint8ClampedArray,
  density: Float32Array,
  heat: Float32Array | null,
  width: number,
  height: number,
  color: readonly number[],
  shimmer: BoostShimmer | null,
  unit: number,
  region: CellBounds,
  latticeRegion?: CellBounds,
  /** Seconds of animation, for a look that moves. */
  timeSec?: number
) => void;

/**
 * The cells look: a dark base where the slime would be, and on it the
 * lattice's cells, each a glossy sphere lit from the top left with a dark
 * rim.
 */
export const paintCells: LookPainter = (
  data8,
  density,
  heat,
  width,
  height,
  color,
  shimmer,
  unit,
  region,
  latticeRegion = region
) => {
  const palette = lookPalette(color);
  const spacing = CELL_SPACING * unit;
  // Each lattice point's cell: centre x, y and radius, 0 for none.
  const lattice = buildLattice(
    latticeRegion,
    spacing,
    3,
    (col, row, at, values) => {
      const bubble = cellBubble(col, row, spacing, density, width, height);
      if (bubble != null) {
        values[at] = bubble.x;
        values[at + 1] = bubble.y;
        values[at + 2] = bubble.radius;
      }
    }
  );
  const { values } = lattice;
  const around = new Int32Array(9);

  paintLook(
    data8,
    density,
    heat,
    width,
    height,
    shimmer,
    region,
    CELL_CLIP_START,
    (x, y, d, out) => {
      // The cell the pixel is deepest in, of the nine lattice points around.
      let bestQ2 = Infinity;
      let bestRadius = 0;
      let ux = 0;
      let uy = 0;
      const count = latticeNeighbours(lattice, x, y, around);
      for (let n = 0; n < count; n++) {
        const at = around[n];
        const radius = values[at + 2];
        if (radius <= 0) {
          continue;
        }
        const vx = (x - values[at]) / radius;
        const vy = (y - values[at + 1]) / radius;
        const q2 = vx * vx + vy * vy;
        if (q2 < bestQ2) {
          bestQ2 = q2;
          bestRadius = radius;
          ux = vx;
          uy = vy;
        }
      }

      const baseAlpha =
        BASE_ALPHA * smoothstep(SLIME_EDGE_START, SLIME_EDGE_END, d);
      // Anti-aliased at the rim, one layer pixel wide.
      const cellAlpha =
        bestRadius > 0
          ? clamp(
              (1 - Math.sqrt(bestQ2)) * bestRadius * SLIME_SCALE + 0.5,
              0,
              1
            ) * smoothstep(CELL_CLIP_START, CELL_CLIP_END, d)
          : 0;
      if (cellAlpha > 0) {
        sphereShade(ux, uy, palette, out);
      }
      return overBase(out, cellAlpha, palette.base, baseAlpha);
    }
  );
};

/**
 * The honeycomb look, or the crystal look for `crystal`: a dark base where
 * the slime would be, tiled with the lattice's tiles - each pixel belongs
 * to the nearest tile centre - wherever the colony is dense enough under a
 * tile's centre. The honeycomb's tiles are glossy with dark seams between
 * them, the crystal's facets flat in their own shades with bright seams.
 */
function paintTiles(crystal: boolean): LookPainter {
  return (
    data8,
    density,
    heat,
    width,
    height,
    color,
    shimmer,
    unit,
    region,
    latticeRegion = region
  ) => {
    const palette = lookPalette(color);
    const { rgb, light } = palette;
    const spacing = TILE_SPACING * unit;
    const radius = spacing * TILE_RADIUS;
    // Each lattice point's tile: centre x, y, the density under it, its shade.
    const lattice = buildLattice(
      latticeRegion,
      spacing,
      4,
      (col, row, at, values) => {
        const tile = latticeTile(
          col,
          row,
          spacing,
          crystal,
          density,
          width,
          height
        );
        values[at] = tile.x;
        values[at + 1] = tile.y;
        values[at + 2] = tile.density;
        values[at + 3] = tile.shade;
      }
    );
    const { values } = lattice;
    const around = new Int32Array(9);

    paintLook(
      data8,
      density,
      heat,
      width,
      height,
      shimmer,
      region,
      CELL_CLIP_START,
      (x, y, d, out) => {
        // The nearest tile centre and the second nearest - the seam lies
        // where they are as far away.
        let nearest2 = Infinity;
        let second2 = Infinity;
        let nearestAt = -1;
        const count = latticeNeighbours(lattice, x, y, around);
        for (let n = 0; n < count; n++) {
          const at = around[n];
          const dx = x - values[at];
          const dy = y - values[at + 1];
          const distance2 = dx * dx + dy * dy;
          if (distance2 < nearest2) {
            second2 = nearest2;
            nearest2 = distance2;
            nearestAt = at;
          } else if (distance2 < second2) {
            second2 = distance2;
          }
        }

        const baseAlpha =
          BASE_ALPHA * smoothstep(SLIME_EDGE_START, SLIME_EDGE_END, d);
        const tileDensity = nearestAt < 0 ? 0 : values[nearestAt + 2];
        const tileAlpha =
          smoothstep(TILE_MIN, TILE_MIN + TILE_FADE, tileDensity) *
          smoothstep(CELL_CLIP_START, CELL_CLIP_END, d);
        if (tileAlpha > 0) {
          // 0 on the seam, 1 a seam's width into the tile.
          const inside = smoothstep(
            0,
            TILE_SEAM,
            (Math.sqrt(second2) - Math.sqrt(nearest2)) / spacing
          );
          if (crystal) {
            const shade = values[nearestAt + 3];
            for (let c = 0; c < 3; c++) {
              out[c] = lerp(light[c], rgb[c] * shade, inside);
            }
          } else {
            sphereShade(
              (x - values[nearestAt]) / radius,
              (y - values[nearestAt + 1]) / radius,
              palette,
              out
            );
            const seam = SEAM_DARK + (1 - SEAM_DARK) * inside;
            out[0] *= seam;
            out[1] *= seam;
            out[2] *= seam;
          }
        }
        return overBase(out, tileAlpha, palette.base, baseAlpha);
      }
    );
  };
}

export const paintHoneycomb = paintTiles(false);
export const paintCrystal = paintTiles(true);

/**
 * The neon look: the slime's outline as a glowing line in the colony's
 * colour, a fainter line further in where the colony is thick, a soft halo
 * outside and a dark body in between.
 */
export const paintNeon: LookPainter = (
  data8,
  density,
  heat,
  width,
  height,
  color,
  shimmer,
  _unit,
  region
) => {
  const rgb: Rgb = [color[0], color[1], color[2]];
  const neon = mix(rgb, WHITE, NEON_LIGHT);
  paintLook(
    data8,
    density,
    heat,
    width,
    height,
    shimmer,
    region,
    0.005,
    (x, y, d, out) => {
      const coverage = smoothstep(SLIME_EDGE_START, SLIME_EDGE_END, d);
      const line = smoothstep(NEON_LINE_START, NEON_LINE_END, d);
      const inner = smoothstep(NEON_INNER_START, NEON_INNER_END, d);
      const glow = Math.max(
        line * (1 - line) * 4,
        inner * (1 - inner) * 4 * NEON_INNER_GLOW
      );
      const halo = smoothstep(0, NEON_LINE_START, d) * (1 - line) * NEON_HALO;
      const alpha = Math.max(NEON_BODY_ALPHA * coverage, glow, halo);
      if (alpha <= 0) {
        return 0;
      }
      for (let c = 0; c < 3; c++) {
        out[c] = Math.min(
          255,
          rgb[c] * NEON_BODY * coverage + neon[c] * glow + rgb[c] * halo
        );
      }
      return alpha;
    }
  );
};

/**
 * The ink look: a flat body in the colony's colour, hatched in the
 * colony's own pattern - crossed where the colony is thin - inside a thick
 * outline of ink.
 */
export const paintInk: LookPainter = (
  data8,
  density,
  heat,
  width,
  height,
  color,
  shimmer,
  unit,
  region
) => {
  const rgb: Rgb = [color[0], color[1], color[2]];
  const ink = mix(rgb, BLACK, 1 - INK);
  const hatched = mix(rgb, BLACK, 1 - INK_HATCH);
  const {
    direction: [hx, hy],
    cross,
  } = hatchPattern(color);
  const spacing = INK_HATCH_SPACING * unit;
  const stripe = (along: number) =>
    along / spacing - Math.floor(along / spacing) < INK_HATCH_WIDTH;
  paintLook(
    data8,
    density,
    heat,
    width,
    height,
    shimmer,
    region,
    SLIME_EDGE_START,
    (x, y, d, out) => {
      const coverage = smoothstep(SLIME_EDGE_START, SLIME_EDGE_END, d);
      if (coverage <= 0) {
        return 0;
      }
      const outline = 1 - smoothstep(SLIME_EDGE_END, INK_OUTLINE_END, d);
      const lined =
        stripe(x * hx + y * hy) ||
        ((cross || d < INK_CROSS_BELOW) && stripe(x * hy - y * hx));
      const body = lined ? hatched : rgb;
      for (let c = 0; c < 3; c++) {
        out[c] = lerp(body[c], ink[c], outline);
      }
      return INK_ALPHA * coverage;
    }
  );
};

/**
 * How much of a DNA snippet covers a point of a bubble's unit disc: two or
 * three double helices per bubble, each drifting around the bubble and
 * turning slowly with the time, drawn by the lattice point's hashes. `aa`
 * is a pixel's width on the disc, for the anti-aliasing of the strands.
 */
function dnaAt(
  ux: number,
  uy: number,
  col: number,
  row: number,
  timeSec: number,
  aa: number
): number {
  let cover = 0;
  const count = 2 + (hash(col, row, 20) > 0.5 ? 1 : 0);
  for (let k = 0; k < count; k++) {
    const salt = 21 + k * 6;
    const orbit = DNA_ORBIT_MIN + DNA_ORBIT_VARY * hash(col, row, salt);
    const drift = DNA_DRIFT * (0.6 + 0.8 * hash(col, row, salt + 1));
    const angle =
      hash(col, row, salt + 2) * Math.PI * 2 +
      timeSec * drift * (hash(col, row, salt + 3) < 0.5 ? -1 : 1);
    const dx = ux - orbit * Math.cos(angle);
    const dy = uy - orbit * Math.sin(angle);
    const theta = hash(col, row, salt + 4) * Math.PI * 2 + timeSec * DNA_SPIN;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const along = dx * cos + dy * sin;
    const half = DNA_HALF_MIN + DNA_HALF_VARY * hash(col, row, salt + 5);
    if (Math.abs(along) > half) {
      continue;
    }
    const across = -dx * sin + dy * cos;
    const phase = along * DNA_TWIST + timeSec;
    const wave = DNA_AMPLITUDE * Math.sin(phase);
    // The two backbones, and a rung between them every half turn.
    const strand = Math.max(
      1 - smoothstep(DNA_WIDTH, DNA_WIDTH + aa, Math.abs(across - wave)),
      1 - smoothstep(DNA_WIDTH, DNA_WIDTH + aa, Math.abs(across + wave))
    );
    const turn = phase + Math.PI / 2;
    const rung =
      Math.abs(across) <= Math.abs(wave) + DNA_WIDTH &&
      turn - Math.floor(turn / Math.PI) * Math.PI < DNA_RUNG
        ? 0.8
        : 0;
    const ends = smoothstep(half, half - 0.08, Math.abs(along));
    cover = Math.max(cover, Math.max(strand, rung) * ends);
  }
  return cover;
}

/**
 * The bubbles look: glassy bubbles of different sizes on a thinner base -
 * a faint film in the colony's light colour, a bright rim and a light spot
 * - each with snippets of DNA floating inside ({@link dnaAt}).
 */
export const paintBubbles: LookPainter = (
  data8,
  density,
  heat,
  width,
  height,
  color,
  shimmer,
  unit,
  region,
  latticeRegion = region,
  timeSec = 0
) => {
  const palette = lookPalette(color);
  const { light, base } = palette;
  const spacing = BUBBLE_SPACING * unit;
  // Each lattice point's bubble: centre x, y, radius (0 for none), and
  // its column and row, which draw what floats inside.
  const lattice = buildLattice(
    latticeRegion,
    spacing,
    5,
    (col, row, at, values) => {
      const bubble = cellBubble(
        col,
        row,
        spacing,
        density,
        width,
        height,
        BUBBLE_SHAPE
      );
      if (bubble != null) {
        values[at] = bubble.x;
        values[at + 1] = bubble.y;
        values[at + 2] = bubble.radius;
        values[at + 3] = col;
        values[at + 4] = row;
      }
    }
  );
  const { values } = lattice;
  const around = new Int32Array(9);

  paintLook(
    data8,
    density,
    heat,
    width,
    height,
    shimmer,
    region,
    CELL_CLIP_START,
    (x, y, d, out) => {
      let bestQ2 = Infinity;
      let bestAt = -1;
      let ux = 0;
      let uy = 0;
      const count = latticeNeighbours(lattice, x, y, around);
      for (let n = 0; n < count; n++) {
        const at = around[n];
        const radius = values[at + 2];
        if (radius <= 0) {
          continue;
        }
        const vx = (x - values[at]) / radius;
        const vy = (y - values[at + 1]) / radius;
        const q2 = vx * vx + vy * vy;
        if (q2 < bestQ2) {
          bestQ2 = q2;
          bestAt = at;
          ux = vx;
          uy = vy;
        }
      }

      const baseAlpha =
        BUBBLE_BASE_ALPHA * smoothstep(SLIME_EDGE_START, SLIME_EDGE_END, d);
      let bubbleAlpha = 0;
      if (bestAt >= 0) {
        const radius = values[bestAt + 2];
        const q = Math.sqrt(bestQ2);
        const edge =
          clamp((1 - q) * radius * SLIME_SCALE + 0.5, 0, 1) *
          smoothstep(CELL_CLIP_START, CELL_CLIP_END, d);
        if (edge > 0) {
          const rim = smoothstep(BUBBLE_RIM_START, BUBBLE_RIM_END, q);
          const spot =
            1 -
            smoothstep(
              BUBBLE_SPOT_START,
              BUBBLE_SPOT_END,
              Math.hypot(ux - CELL_FOCAL_X, uy - CELL_FOCAL_Y)
            );
          const dna = dnaAt(
            ux,
            uy,
            values[bestAt + 3],
            values[bestAt + 4],
            timeSec,
            1 / (radius * SLIME_SCALE)
          );
          bubbleAlpha =
            Math.max(BUBBLE_FILM, rim * BUBBLE_RIM, spot, dna) * edge;
          // The film and the rim in the light colour, the spot and the
          // snippets towards white.
          const white = Math.max(spot, dna * 0.7);
          for (let c = 0; c < 3; c++) {
            out[c] = lerp(light[c], 255, white);
          }
        }
      }
      return overBase(out, bubbleAlpha, base, baseAlpha);
    }
  );
};

/** The slime, as every other look is called. */
const paintSlimeLook: LookPainter = (
  data8,
  density,
  heat,
  width,
  height,
  color,
  shimmer,
  _unit,
  region
) => paintSlime(data8, density, heat, width, height, color, shimmer, region);

/** The painter of every look drawn from the density. */
const DENSITY_PAINTERS: Readonly<
  Record<Exclude<BacteriaLook, 'pixels'>, LookPainter>
> = {
  slime: paintSlimeLook,
  cells: paintCells,
  honeycomb: paintHoneycomb,
  crystal: paintCrystal,
  neon: paintNeon,
  ink: paintInk,
  bubbles: paintBubbles,
};

/** Paints a colony in a look drawn from its density - see {@link LookPainter}. */
export const paintColony = (
  look: Exclude<BacteriaLook, 'pixels'>,
  ...args: Parameters<LookPainter>
): void => DENSITY_PAINTERS[look](...args);

/** A pellet of food as a drop of jam, in one of a few flavours. */
export interface Jam {
  body: Rgb;
  light: Rgb;
}

/** Where and how big a pellet's drop of jam is drawn this frame. */
export interface JamDrop {
  jam: Jam;
  /** The centre of the drop, in arena coordinates. */
  x: number;
  y: number;
  radius: number;
  /** How bright the halo pulses, 0 to 1. */
  halo: number;
}

/**
 * The drops of jam for the pellets that are left: they wobble a little and
 * shrink as they are eaten. Both pellets of a mirrored pair get the same
 * flavour.
 */
export function jamDrops(
  nutrients: readonly Nutrient[],
  nutrientEnergy: number,
  timeSec: number,
  /** Cells per base cell - a drop is as big on every grid. */
  unit = 1
): JamDrop[] {
  const drops: JamDrop[] = [];
  for (let n = 0; n < nutrients.length; n++) {
    const nutrient = nutrients[n];
    if (nutrient.amount <= 0) {
      continue;
    }
    const left = Math.min(1, nutrient.amount / nutrientEnergy);
    const wobble = 1 + 0.08 * Math.sin(timeSec * 4 + n * 1.7);
    drops.push({
      jam: JAMS[(n >> 1) % JAMS.length],
      x: nutrient.x + 0.5,
      y: nutrient.y + 0.5,
      radius: (1.3 + 1.9 * left) * wobble * unit,
      halo: 0.5 + 0.5 * Math.sin(timeSec * 2.5 + n),
    });
  }
  return drops;
}

/** Strawberry, blueberry, apricot and blackcurrant. */
const JAMS: readonly Jam[] = [
  { body: [200, 20, 55], light: [255, 120, 140] },
  { body: [80, 40, 160], light: [170, 140, 255] },
  { body: [240, 140, 20], light: [255, 215, 120] },
  { body: [120, 10, 70], light: [220, 90, 160] },
];

/**
 * Draws the pellets as glossy drops of jam that wobble a little, with a
 * soft halo so they are easy to spot. A drop shrinks as it is eaten. The
 * context is in arena coordinates, its transform does the scaling.
 */
export function drawJam(
  cx: CanvasRenderingContext2D,
  nutrients: readonly Nutrient[],
  nutrientEnergy: number,
  timeSec: number,
  unit = 1
): void {
  for (const { jam, x, y, radius, halo } of jamDrops(
    nutrients,
    nutrientEnergy,
    timeSec,
    unit
  )) {
    cx.fillStyle = rgba(jam.light, 0.12 + 0.12 * halo);
    cx.beginPath();
    cx.arc(x, y, radius + 1.5 + halo, 0, Math.PI * 2);
    cx.fill();

    cx.fillStyle = 'rgba(0,0,0,0.35)';
    cx.beginPath();
    cx.ellipse(x + 0.4, y + 0.6, radius, radius * 0.8, 0, 0, Math.PI * 2);
    cx.fill();

    const gradient = cx.createRadialGradient(
      x - radius * 0.35,
      y - radius * 0.4,
      radius * 0.1,
      x,
      y,
      radius
    );
    gradient.addColorStop(0, rgba(jam.light, 1));
    gradient.addColorStop(0.55, rgba(jam.body, 1));
    gradient.addColorStop(1, rgba(darker(jam.body), 1));
    cx.fillStyle = gradient;
    cx.beginPath();
    // Squashed a little, like a drop sitting on the agar.
    cx.ellipse(x, y, radius, radius * 0.88, 0, 0, Math.PI * 2);
    cx.fill();

    cx.fillStyle = 'rgba(255,255,255,0.8)';
    cx.beginPath();
    cx.ellipse(
      x - radius * 0.38,
      y - radius * 0.4,
      radius * 0.28,
      radius * 0.18,
      -0.6,
      0,
      Math.PI * 2
    );
    cx.fill();
  }
}

/**
 * Draws the colonies into an offscreen layer and hands it back, ready to be
 * drawn over the floor: one pixel per bacterium for the pixel look, and
 * every other look from the colony's density - smooth slime, cells, tiles,
 * neon or ink. The buffers are kept between frames.
 */
export class ColonyRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private image: ImageData | null = null;
  private scale = 0;
  private readonly density: Float32Array;
  private readonly heat: Float32Array;
  private readonly scratch: Float32Array;

  public constructor(
    private readonly width: number,
    private readonly height: number,
    /** Cells per base cell - the boost's waves are as wide on every grid. */
    private readonly unit: number
  ) {
    const cells = width * height;
    this.density = new Float32Array(cells);
    this.heat = new Float32Array(cells);
    this.scratch = new Float32Array(cells);
  }

  /**
   * The layer with every colony on it, or null where there is no canvas.
   * The slime is only worked out for what the canvas shows of the arena,
   * `view`.
   */
  public render(
    colonies: readonly ColonyLayer[],
    balance: GameBalance,
    look: BacteriaLook,
    timeSec: number,
    view: Rect
  ): HTMLCanvasElement | null {
    const { fromDensity } = LOOKS[look];
    const scale = fromDensity ? SLIME_SCALE : 1;
    if (!this.prepare(scale) || this.image == null || this.context == null) {
      return null;
    }
    const data = this.image.data;
    data.fill(0);
    for (const colony of colonies) {
      if (colony.kind !== 'cells') {
        continue;
      }
      const shimmer =
        colony.boostTarget == null
          ? null
          : { timeSec, target: colony.boostTarget, unit: this.unit };
      if (fromDensity && look !== 'pixels') {
        const { width, height, unit } = this;
        const region = slimeRegion(colony.bacterias, view, width, height);
        if (region == null) {
          continue;
        }
        // A look that reaches past the view reads the density there, but
        // paints only what the view can show.
        const reach = lookReach(look, unit);
        const wide =
          reach > 0
            ? (slimeRegion(colony.bacterias, view, width, height, reach) ??
              region)
            : region;
        const hot = colonyDensity(
          this.density,
          this.heat,
          this.scratch,
          width,
          height,
          colony.bacterias,
          balance,
          wide
        );
        paintColony(
          look,
          data,
          this.density,
          hot ? this.heat : null,
          width,
          height,
          colony.color,
          shimmer,
          unit,
          region,
          wide,
          timeSec
        );
      } else {
        createImageDataFromBacterias(
          data,
          this.width,
          colony.color,
          colony.bacterias,
          balance,
          shimmer
        );
      }
    }
    this.context.putImageData(this.image, 0, 0);
    return this.canvas;
  }

  /** Makes sure the layer has the size the look needs. */
  private prepare(scale: number): boolean {
    if (this.scale === scale && this.canvas != null) {
      return true;
    }
    const canvas = this.canvas ?? createCanvas(0, 0);
    if (canvas == null) {
      return false;
    }
    canvas.width = this.width * scale;
    canvas.height = this.height * scale;
    const context = canvas.getContext?.('2d') ?? null;
    if (context == null) {
      return false;
    }
    this.canvas = canvas;
    this.context = context;
    this.image = context.createImageData(canvas.width, canvas.height);
    this.scale = scale;
    return true;
  }
}

/**
 * The waves of light of a boosted colony at a cell, 0 to 1. Their crests
 * close in on the crosshair, so the colony visibly rushes towards it.
 */
export function shimmerAt(x: number, y: number, shimmer: BoostShimmer): number {
  const distance =
    Math.hypot(x - shimmer.target.x, y - shimmer.target.y) / shimmer.unit;
  const wave = 0.5 + 0.5 * Math.sin(shimmer.timeSec * 9 + distance * 0.35);
  const squared = wave * wave;
  return squared * squared * squared;
}

/**
 * How far a bacterium is charged beyond its normal maximum, from 0 to 1 at
 * the supercharged limit - the white heat of both looks.
 */
export function overcharge(energy: number, balance: GameBalance): number {
  const range = balance.superChargedMaxEnergy - balance.maxEnergy;
  return energy > balance.maxEnergy && range > 0
    ? Math.min(1, (energy - balance.maxEnergy) / range)
    : 0;
}

/** The density of the weakest bacterium; one at full strength has 1. */
export const MIN_CELL_DENSITY = 0.55;

/** How dense a bacterium of this strength makes its cell. */
export function cellDensity(strength: number): number {
  return MIN_CELL_DENSITY + (1 - MIN_CELL_DENSITY) * Math.min(1, strength);
}

/** A bacterium's energy relative to the normal maximum, never below 0. */
export function strengthOf(energy: number, balance: GameBalance): number {
  return Math.max(energy, 0) / balance.maxEnergy;
}

/** True for the few pixels that glint in this tenth of a second. */
function sparkle(x: number, y: number, timeSec: number): boolean {
  return hash(x >> 1, y >> 1, Math.floor(timeSec * 10)) > 0.992;
}

/** Blurs the region of the field in place with a 3x3 box, its edges clamped. */
function boxBlur(
  field: Float32Array,
  scratch: Float32Array,
  width: number,
  { minX, minY, maxX, maxY }: CellBounds
): void {
  for (let y = minY; y <= maxY; y++) {
    const row = y * width;
    for (let x = minX; x <= maxX; x++) {
      const left = field[row + (x > minX ? x - 1 : x)];
      const right = field[row + (x < maxX ? x + 1 : x)];
      scratch[row + x] = (left + field[row + x] + right) / 3;
    }
  }
  for (let y = minY; y <= maxY; y++) {
    const up = (y > minY ? y - 1 : y) * width;
    const row = y * width;
    const down = (y < maxY ? y + 1 : y) * width;
    for (let x = minX; x <= maxX; x++) {
      field[row + x] =
        (scratch[up + x] + scratch[row + x] + scratch[down + x]) / 3;
    }
  }
}

export function darker([r, g, b]: Rgb): Rgb {
  return [r * 0.55, g * 0.55, b * 0.55];
}
