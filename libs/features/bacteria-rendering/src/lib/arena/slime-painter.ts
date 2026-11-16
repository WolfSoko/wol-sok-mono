import {
  CellBounds,
  type CellList,
  clamp,
  emptyBounds,
  gameBalance,
  GameBalance,
  growBounds,
  Rect,
} from '@wolsok/feat-shared-bacteria-engine';
import {
  type BoostShimmer,
  cellDensity,
  overcharge,
  shimmerAt,
  sparkle,
  strengthOf,
} from './colony-energy';
import { lerp, smoothstep } from './canvas-math';
import { LIGHT_X, LIGHT_Y } from './look-tuning';

/**
 * How many slime pixels there are per arena cell along each axis. The
 * outline is found on this finer grid, so the edge of a colony is a smooth
 * curve instead of a staircase of cells.
 */
export const SLIME_SCALE = 2;

/** Density at which the slime starts, and where it is fully opaque. */
export const SLIME_EDGE_START = 0.07;
export const SLIME_EDGE_END = 0.17;

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
  bacterias: CellList,
  balance: GameBalance = gameBalance,
  shimmer: BoostShimmer | null = null
): Uint8ClampedArray {
  const [r, g, b, alpha] = color;
  const { x: xs, y: ys, energy: energies, length } = bacterias;
  for (let i = 0; i < length; i++) {
    const x = xs[i];
    const y = ys[i];
    const energy = energies[i];
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
  bacterias: CellList,
  balance: GameBalance = gameBalance,
  region: CellBounds = wholeArena(width, height)
): boolean {
  density.fill(0);
  let hot = false;
  const { minX, minY, maxX, maxY } = region;
  const { x: xs, y: ys, energy: energies, length } = bacterias;
  for (let i = 0; i < length; i++) {
    const x = xs[i];
    const y = ys[i];
    const energy = energies[i];
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

/** The cells a colony covers, null for a colony without bacteria. */
export function colonyBounds(bacterias: CellList): CellBounds | null {
  if (bacterias.length === 0) {
    return null;
  }
  const bounds = emptyBounds();
  const { x, y, length } = bacterias;
  for (let i = 0; i < length; i++) {
    growBounds(bounds, x[i], y[i]);
  }
  return bounds;
}

/**
 * The cells the slime of a colony is worked out on: its bacteria and
 * {@link SLIME_REACH} around them, cut to what the canvas shows - null when
 * none of it is in view. Cut at the view, the blur clamps a few cells short
 * of the truth, so the cut lies {@link SLIME_REACH} cells beyond the view,
 * and `beyondView` more for a look whose cells reach in from past it;
 * around the bacteria the density is zero anyway.
 */
export function slimeRegion(
  bacterias: CellList,
  view: Rect,
  width: number,
  height: number,
  /** How many cells past the view a look still reads - the lattice looks'. */
  beyondView = 0
): CellBounds | null {
  const bounds = colonyBounds(bacterias);
  if (bounds === null) {
    return null;
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
 * The density at an arena position, between the cells' centres - a cell's
 * centre is its lattice point, as in {@link paintSlime} and
 * {@link paintLook}, which inline the same sampling.
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
