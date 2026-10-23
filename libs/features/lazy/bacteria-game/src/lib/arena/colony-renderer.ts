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
import { createCanvas, hash, lerp, rgba, smoothstep } from './canvas-math';

/** What the renderer needs to know about one colony. */
export type ColonyLayer = CellsLayer | StateLayer;

interface ColonyLayerBase {
  /** RGBA, the alpha from 0 to 255. */
  color: readonly number[];
  /**
   * The crosshair of a colony whose boost runs - waves of light rush across
   * the colony towards it. Null without a boost.
   */
  boostTarget: Point | null;
}

/** The shimmer of a boosted colony at one moment. */
export interface BoostShimmer {
  timeSec: number;
  /** The crosshair the waves run into, in arena cells. */
  target: Point;
  /** Arena cells per cell of the base arena - the waves are as wide on any grid. */
  unit: number;
}

/** A colony of the CPU simulation: its bacteria. */
export interface CellsLayer extends ColonyLayerBase {
  kind: 'cells';
  bacterias: readonly Bacteria[];
}

/**
 * A colony of the GPU simulation: where it is in the state texture. Only
 * the WebGL painter, which shares the simulation's context, can draw it.
 */
export interface StateLayer extends ColonyLayerBase {
  kind: 'state';
  /** The simulation's cell state texture. */
  state: WebGLTexture;
  /**
   * The glow of fights, meals and pushes - one texture for all colonies,
   * see the simulation's `EFFECTS_FRAGMENT`.
   */
  effects: WebGLTexture;
  /** The owner value of the colony's cells in the state. */
  owner: number;
  /** The coarse box around the colony, null once it is gone. */
  bounds: CellBounds | null;
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
 * of the truth, so the cut lies {@link SLIME_REACH} cells beyond the view;
 * around the bacteria the density is zero anyway.
 */
export function slimeRegion(
  bacterias: readonly Bacteria[],
  view: Rect,
  width: number,
  height: number
): CellBounds | null {
  if (bacterias.length === 0) {
    return null;
  }
  const bounds = emptyBounds();
  for (const { x, y } of bacterias) {
    growBounds(bounds, x, y);
  }
  // The cells the view touches, one more for a pixel half in it.
  const reach = SLIME_REACH + 1;
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
 * The cells look, as on the app icon: glossy round cells of different sizes
 * packed on a dark base in the colony's colour. The cells sit on a jittered
 * hex lattice in arena cells, {@link CELL_SPACING} base cells apart, so
 * they are as big on every grid. A cell exists where the colony's density
 * at its centre reaches {@link CELL_MIN}; it grows with the density, so the
 * cells are small along the front and where the colony is weak, and big and
 * tightly packed inside. The WebGL painter draws the same lattice - see
 * `COLONY_FRAGMENT`.
 */
export const CELL_SPACING = 3.4;
/** The height of a lattice row, in spacings - a hex lattice. */
export const CELL_ROW_HEIGHT = 0.866;
/** The density at a cell's centre below which there is no cell. */
export const CELL_MIN = 0.12;
/** The biggest cell, as a share of the spacing - neighbours just overlap. */
const CELL_RADIUS = 0.62;
/** Where the light spot sits on a cell, on its unit disc. */
const CELL_FOCAL_X = -0.35;
const CELL_FOCAL_Y = -0.4;
/** How dark the base under the cells is, a share of the colony's colour. */
const CELL_BASE = 0.42;
/** The density below which no cell shows, so none floats over bare floor. */
const CELL_CLIP_START = 0.03;
const CELL_CLIP_END = 0.09;

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
  spacing: number,
  density: Float32Array,
  width: number,
  height: number
): CellBubble | null {
  const rowHeight = spacing * CELL_ROW_HEIGHT;
  const x =
    (col + 0.5) * spacing +
    cellLatticeOffset(row, spacing) +
    (hash(col, row, 1) - 0.5) * spacing * 0.5;
  const y =
    (row + 0.5) * rowHeight + (hash(col, row, 2) - 0.5) * rowHeight * 0.5;
  const d = sampleDensity(density, width, height, x, y);
  if (d < CELL_MIN) {
    return null;
  }
  const size =
    (0.5 + 0.5 * clamp((d - 0.15) / 0.6, 0, 1)) *
    smoothstep(CELL_MIN, CELL_MIN + 0.08, d);
  const radius =
    spacing * CELL_RADIUS * size * (0.82 + 0.36 * hash(col, row, 3));
  return { x, y, radius };
}

/**
 * The density at an arena position, between the cells' centres - a cell's
 * centre is its lattice point, as in {@link paintSlime}.
 */
export function sampleDensity(
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
 * Turns the density of a colony into the cells look on a buffer
 * {@link SLIME_SCALE} times the size of the arena: a dark base where the
 * slime would be, and on it the lattice's cells, each a glossy sphere lit
 * from the top left with a dark rim, white heat where the colony is
 * overcharged and, while it is boosted, waves of light with sparkles. Only
 * the pixels of `region`'s cells are painted; `unit` is the arena cells per
 * base cell, which keeps the cells as big on every grid.
 */
export function paintCells(
  data8: Uint8ClampedArray,
  density: Float32Array,
  heat: Float32Array | null,
  width: number,
  height: number,
  color: readonly number[],
  shimmer: BoostShimmer | null,
  unit: number,
  region: CellBounds = wholeArena(width, height)
): void {
  const [r, g, b] = color;
  const light = [r, g, b].map((c) => c + (255 - c) * 0.55);
  const dark = [r, g, b].map((c) => c * 0.5);
  const base = [r, g, b].map((c) => c * CELL_BASE);
  const spacing = CELL_SPACING * unit;
  const rowHeight = spacing * CELL_ROW_HEIGHT;

  // The cells whose lattice points lie around the region, one ring more,
  // worked out once: a pixel then only looks the nine around it up.
  const row0 = Math.floor(region.minY / rowHeight) - 1;
  const row1 = Math.floor((region.maxY + 1) / rowHeight) + 1;
  const col0 = Math.floor((region.minX - spacing * 0.5) / spacing) - 1;
  const col1 = Math.floor((region.maxX + 1) / spacing) + 1;
  const cols = col1 - col0 + 1;
  const lattice = new Float32Array(cols * (row1 - row0 + 1) * 3);
  for (let row = row0; row <= row1; row++) {
    for (let col = col0; col <= col1; col++) {
      const bubble = cellBubble(col, row, spacing, density, width, height);
      if (bubble != null) {
        const at = ((row - row0) * cols + (col - col0)) * 3;
        lattice[at] = bubble.x;
        lattice[at + 1] = bubble.y;
        lattice[at + 2] = bubble.radius;
      }
    }
  }

  const outWidth = width * SLIME_SCALE;
  const step = 1 / SLIME_SCALE;
  const fromX = region.minX * SLIME_SCALE;
  const toX = (region.maxX + 1) * SLIME_SCALE;
  const rgb = [0, 0, 0];

  for (
    let py = region.minY * SLIME_SCALE;
    py < (region.maxY + 1) * SLIME_SCALE;
    py++
  ) {
    const y = (py + 0.5) * step;
    const row = Math.floor(y / rowHeight);
    for (let px = fromX; px < toX; px++) {
      const x = (px + 0.5) * step;
      const d = sampleDensity(density, width, height, x, y);
      if (d < CELL_CLIP_START) {
        continue;
      }

      // The cell the pixel is deepest in, of the nine lattice points around.
      let bestQ = Infinity;
      let bestRadius = 0;
      let ux = 0;
      let uy = 0;
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
          if (col < col0 || col > col1) {
            continue;
          }
          const at = ((candidateRow - row0) * cols + (col - col0)) * 3;
          const radius = lattice[at + 2];
          if (radius <= 0) {
            continue;
          }
          const vx = (x - lattice[at]) / radius;
          const vy = (y - lattice[at + 1]) / radius;
          const q = Math.hypot(vx, vy);
          if (q < bestQ) {
            bestQ = q;
            bestRadius = radius;
            ux = vx;
            uy = vy;
          }
        }
      }

      const baseAlpha = 0.92 * smoothstep(SLIME_EDGE_START, SLIME_EDGE_END, d);
      // Anti-aliased at the rim, one layer pixel wide.
      const cellAlpha =
        bestRadius > 0
          ? clamp((1 - bestQ) * bestRadius * SLIME_SCALE + 0.5, 0, 1) *
            smoothstep(CELL_CLIP_START, CELL_CLIP_END, d)
          : 0;
      const alpha = cellAlpha + baseAlpha * (1 - cellAlpha);
      if (alpha <= 0) {
        continue;
      }

      if (cellAlpha > 0) {
        // A sphere: a light spot at the top left, the body colour around it
        // and a dark rim - the gradient of the icon's cells.
        const t = clamp(
          Math.hypot(ux - CELL_FOCAL_X, uy - CELL_FOCAL_Y) / 1.25,
          0,
          1
        );
        for (let c = 0; c < 3; c++) {
          const sphere =
            t < 0.55
              ? lerp(light[c], color[c], t / 0.55)
              : lerp(color[c], dark[c], (t - 0.55) / 0.45);
          rgb[c] =
            (sphere * cellAlpha + base[c] * baseAlpha * (1 - cellAlpha)) /
            alpha;
        }
      } else {
        rgb[0] = base[0];
        rgb[1] = base[1];
        rgb[2] = base[2];
      }

      let white = 0;
      if (heat != null) {
        const hot = sampleDensity(heat, width, height, x, y);
        white = Math.min(1, hot / Math.max(d, 0.05));
      }
      if (shimmer != null) {
        white = Math.max(white, shimmerAt(x, y, shimmer) * 0.8);
        if (sparkle(px, py, shimmer.timeSec)) {
          white = 1;
        }
      }

      const index = (py * outWidth + px) * 4;
      data8[index] = rgb[0] + (255 - rgb[0]) * white;
      data8[index + 1] = rgb[1] + (255 - rgb[1]) * white;
      data8[index + 2] = rgb[2] + (255 - rgb[2]) * white;
      data8[index + 3] = 255 * alpha;
    }
  }
}

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
 * drawn over the floor: one pixel per bacterium for the pixel look, smooth
 * slime for the slime look, glossy cells on a dark base for the cells look.
 * The buffers are kept between frames.
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
    const scale = look === 'pixels' ? 1 : SLIME_SCALE;
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
      if (look !== 'pixels') {
        const region = slimeRegion(
          colony.bacterias,
          view,
          this.width,
          this.height
        );
        if (region == null) {
          continue;
        }
        const hot = colonyDensity(
          this.density,
          this.heat,
          this.scratch,
          this.width,
          this.height,
          colony.bacterias,
          balance,
          region
        );
        if (look === 'slime') {
          paintSlime(
            data,
            this.density,
            hot ? this.heat : null,
            this.width,
            this.height,
            colony.color,
            shimmer,
            region
          );
        } else {
          paintCells(
            data,
            this.density,
            hot ? this.heat : null,
            this.width,
            this.height,
            colony.color,
            shimmer,
            this.unit,
            region
          );
        }
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
