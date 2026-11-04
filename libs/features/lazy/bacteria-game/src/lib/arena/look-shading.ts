import { type BoostShimmer, shimmerAt, sparkle } from './colony-energy';
import { CellBounds, clamp } from '@wolsok/feat-shared-bacteria-engine';
import { SLIME_SCALE } from './slime-painter';
import { lerp, mix, smoothstep } from './canvas-math';
import { cellLatticeOffset } from './lattice-cells';
import { Rgb } from './arena-theme';
import { LOOK_TUNING } from './look-tuning';

const {
  CELL_ROW_HEIGHT,
  CELL_FOCAL_X,
  CELL_FOCAL_Y,
  SPHERE_BODY_STOP,
  SPHERE_REACH,
  TINT_LIGHT,
  TINT_DARK,
  CELL_BASE,
  CELL_CLIP_START,
  CELL_CLIP_END,
} = LOOK_TUNING;

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
export function paintLook(
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

export function buildLattice(
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
export function latticeNeighbours(
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
export function overBase(
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

export const WHITE: Rgb = [255, 255, 255];
export const BLACK: Rgb = [0, 0, 0];

/** The colony's colour lightened, darkened and as the base under its cells. */
export function lookPalette(color: readonly number[]) {
  const rgb: Rgb = [color[0], color[1], color[2]];
  return {
    rgb,
    light: mix(rgb, WHITE, TINT_LIGHT),
    dark: mix(rgb, BLACK, TINT_DARK),
    base: mix(rgb, BLACK, 1 - CELL_BASE),
  };
}

/**
 * The cell of a lattice look the pixel is deepest in, of the nine lattice
 * points around - the index of its values, or -1 outside every cell - with
 * the square of the pixel's unit distance and its unit disc coordinates in
 * `found`. A lattice entry starts with the cell's centre x, y and radius,
 * 0 for none. The shader's `nearestBubble` is its twin.
 */
export function nearestBubble(
  lattice: Lattice,
  x: number,
  y: number,
  around: Int32Array,
  found: Float64Array
): number {
  const { values } = lattice;
  let bestQ2 = Infinity;
  let bestAt = -1;
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
      found[1] = vx;
      found[2] = vy;
    }
  }
  found[0] = bestQ2;
  return bestAt;
}

/**
 * How much of a lattice cell covers a pixel at that unit distance squared:
 * anti-aliased at the rim, one layer pixel wide, and nothing where the
 * density under the pixel is too thin for a cell to float over.
 */
export function cellEdge(q2: number, radius: number, d: number): number {
  return (
    clamp((1 - Math.sqrt(q2)) * radius * SLIME_SCALE + 0.5, 0, 1) *
    smoothstep(CELL_CLIP_START, CELL_CLIP_END, d)
  );
}

/**
 * The gradient of the icon's cells on a unit disc, at `(ux, uy)`: a light
 * spot at the top left, the body colour around it and a dark rim.
 */
export function sphereShade(
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
  latticeRegion: CellBounds,
  /** Seconds of animation, for a look that moves. */
  timeSec: number
) => void;
