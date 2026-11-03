import {
  BLACK,
  buildLattice,
  cellEdge,
  latticeNeighbours,
  type LookPainter,
  lookPalette,
  nearestBubble,
  overBase,
  paintLook,
  sphereShade,
  WHITE,
} from './look-shading';
import {
  BUBBLES,
  cellBubble,
  CELLS,
  hatchPattern,
  latticeTile,
} from './lattice-cells';
import { hash, lerp, mix, smoothstep } from './canvas-math';
import { SLIME_EDGE_END, SLIME_EDGE_START, SLIME_SCALE } from './slime-painter';
import { Rgb } from './arena-theme';
import { wrap } from '../state/geometry';
import { LOOK_TUNING } from './look-tuning';

const {
  CELL_FOCAL_X,
  CELL_FOCAL_Y,
  BASE_ALPHA,
  CELL_CLIP_START,
  CELL_CLIP_END,
  TILE_SPACING,
  TILE_MIN,
  TILE_FADE,
  TILE_RADIUS,
  TILE_SEAM,
  SEAM_DARK,
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
  latticeRegion
) => {
  const palette = lookPalette(color);
  // Each lattice point's cell: centre x, y and radius, 0 for none.
  const lattice = buildLattice(
    latticeRegion,
    CELLS.spacing * unit,
    3,
    (col, row, at, values) => {
      const bubble = cellBubble(col, row, CELLS, unit, density, width, height);
      if (bubble != null) {
        values[at] = bubble.x;
        values[at + 1] = bubble.y;
        values[at + 2] = bubble.radius;
      }
    }
  );
  const { values } = lattice;
  const around = new Int32Array(9);
  const found = new Float64Array(3);

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
      const at = nearestBubble(lattice, x, y, around, found);
      const baseAlpha =
        BASE_ALPHA * smoothstep(SLIME_EDGE_START, SLIME_EDGE_END, d);
      const cellAlpha = at < 0 ? 0 : cellEdge(found[0], values[at + 2], d);
      if (cellAlpha > 0) {
        sphereShade(found[1], found[2], palette, out);
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
    latticeRegion
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

/** A helix: the centre it has drifted to, the cosine and sine of its turn, half its length. */
const HELIX_STRIDE = 5;
/** A bubble's lattice entry: centre x, y, radius, how many helices, then up to three. */
const BUBBLE_STRIDE = 3 + 1 + 3 * HELIX_STRIDE;

/**
 * Lays the DNA snippets of a bubble into its lattice entry at this moment:
 * two or three double helices, drawn by the lattice point's hashes, that
 * drift around the bubble and turn slowly with the time. Worked out once
 * per bubble and frame; {@link dnaAt} projects every pixel onto them.
 */
function layHelices(
  col: number,
  row: number,
  timeSec: number,
  values: Float32Array,
  at: number
): void {
  const count = 2 + (hash(col, row, 20) > 0.5 ? 1 : 0);
  values[at] = count;
  for (let k = 0; k < count; k++) {
    const salt = 21 + k * 6;
    const orbit = DNA_ORBIT_MIN + DNA_ORBIT_VARY * hash(col, row, salt);
    const drift = DNA_DRIFT * (0.6 + 0.8 * hash(col, row, salt + 1));
    const angle =
      hash(col, row, salt + 2) * Math.PI * 2 +
      timeSec * drift * (hash(col, row, salt + 3) < 0.5 ? -1 : 1);
    const theta = hash(col, row, salt + 4) * Math.PI * 2 + timeSec * DNA_SPIN;
    const helix = at + 1 + k * HELIX_STRIDE;
    values[helix] = orbit * Math.cos(angle);
    values[helix + 1] = orbit * Math.sin(angle);
    values[helix + 2] = Math.cos(theta);
    values[helix + 3] = Math.sin(theta);
    values[helix + 4] = DNA_HALF_MIN + DNA_HALF_VARY * hash(col, row, salt + 5);
  }
}

/**
 * How much of a DNA snippet covers a point of a bubble's unit disc, from
 * the helices {@link layHelices} laid into the lattice at `at`. `aa` is a
 * pixel's width on the disc, for the anti-aliasing of the strands.
 */
function dnaAt(
  ux: number,
  uy: number,
  values: Float32Array,
  at: number,
  timeSec: number,
  aa: number
): number {
  let cover = 0;
  const count = values[at];
  for (let k = 0; k < count; k++) {
    const helix = at + 1 + k * HELIX_STRIDE;
    const dx = ux - values[helix];
    const dy = uy - values[helix + 1];
    const cos = values[helix + 2];
    const sin = values[helix + 3];
    const halfLength = values[helix + 4];
    const along = dx * cos + dy * sin;
    if (Math.abs(along) > halfLength) {
      continue;
    }
    const across = -dx * sin + dy * cos;
    // Strands and rungs stay within the helix's amplitude.
    if (Math.abs(across) > DNA_AMPLITUDE + DNA_WIDTH + aa) {
      continue;
    }
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
      wrap(turn, Math.PI) < DNA_RUNG
        ? 0.8
        : 0;
    const ends = 1 - smoothstep(halfLength - 0.08, halfLength, Math.abs(along));
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
  latticeRegion,
  timeSec
) => {
  const { light, base } = lookPalette(color);
  // Each lattice point's bubble: centre x, y, radius (0 for none), and
  // the snippets floating inside at this moment.
  const lattice = buildLattice(
    latticeRegion,
    BUBBLES.spacing * unit,
    BUBBLE_STRIDE,
    (col, row, at, values) => {
      const bubble = cellBubble(
        col,
        row,
        BUBBLES,
        unit,
        density,
        width,
        height
      );
      if (bubble != null) {
        values[at] = bubble.x;
        values[at + 1] = bubble.y;
        values[at + 2] = bubble.radius;
        layHelices(col, row, timeSec, values, at + 3);
      }
    }
  );
  const { values } = lattice;
  const around = new Int32Array(9);
  const found = new Float64Array(3);

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
      const at = nearestBubble(lattice, x, y, around, found);
      const baseAlpha =
        BUBBLE_BASE_ALPHA * smoothstep(SLIME_EDGE_START, SLIME_EDGE_END, d);
      let bubbleAlpha = 0;
      if (at >= 0) {
        const radius = values[at + 2];
        const edge = cellEdge(found[0], radius, d);
        if (edge > 0) {
          const [q2, ux, uy] = found;
          const rim = smoothstep(
            BUBBLE_RIM_START,
            BUBBLE_RIM_END,
            Math.sqrt(q2)
          );
          const fx = ux - CELL_FOCAL_X;
          const fy = uy - CELL_FOCAL_Y;
          const spot =
            1 -
            smoothstep(
              BUBBLE_SPOT_START,
              BUBBLE_SPOT_END,
              Math.sqrt(fx * fx + fy * fy)
            );
          const dna = dnaAt(
            ux,
            uy,
            values,
            at + 3,
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
