import {
  paintSlime,
  sampleDensity,
  SLIME_EDGE_END,
  SLIME_EDGE_START,
} from './slime-painter';
import {
  BLACK,
  buildLattice,
  cellEdge,
  type LookPainter,
  lookPalette,
  nearestBubble,
  overBase,
  paintLook,
  WHITE,
} from './look-shading';
import { fbm, hash, lerp, mix, smoothstep, valueNoise } from './canvas-math';
import { cellBubble, MARBLES } from './lattice-cells';
import { clamp } from '@wolsok/feat-shared-bacteria-engine';
import { LOOK_TUNING } from './look-tuning';

const {
  CELL_CLIP_START,
  SURFACE_LIGHT_X,
  SURFACE_LIGHT_Y,
  SURFACE_LIGHT_Z,
  MARBLE_BASE_ALPHA,
  MARBLE_SWIRL,
  MARBLE_SWIRL_TURNS,
  MARBLE_SWIRL_RINGS,
  MARBLE_AMBIENT,
  MARBLE_SHINE,
  MARBLE_SHINE_STRENGTH,
  MARBLE_RIM_START,
  MARBLE_RIM,
  MARBLE_GLOW_START,
  MARBLE_GLOW_END,
  MARBLE_GLOW,
  LAVA_SCALE,
  LAVA_FLOW,
  LAVA_CRACK,
  LAVA_CRACK_HALO,
  LAVA_HALO,
  LAVA_CRACK_2,
  LAVA_CRUST,
  LAVA_GREY,
  LAVA_RELIEF,
  LAVA_BUMP,
  LAVA_PULSE,
  LAVA_GLOW_LIGHT,
  LAVA_EDGE_END,
  LAVA_EDGE_GLOW,
  LAVA_ALPHA,
  GALAXY_SCALE,
  GALAXY_DRIFT,
  GALAXY_DEEP,
  GALAXY_GAS,
  GALAXY_GAS_FROM,
  GALAXY_GAS_TO,
  GALAXY_STAR_SPACING,
  GALAXY_STAR_SHARE,
  GALAXY_STAR_RADIUS,
  GALAXY_STAR_HALO,
  GALAXY_TWINKLE,
  GALAXY_CORE,
  GALAXY_RIM,
  GALAXY_ALPHA,
  PLASMA_SCALE,
  PLASMA_SCALE_2,
  PLASMA_SPEED,
  PLASMA_BOLT,
  PLASMA_HALO_WIDTH,
  PLASMA_HALO,
  PLASMA_BODY,
  PLASMA_GLOW,
  PLASMA_FLICKER,
  PLASMA_EDGE,
  PLASMA_ALPHA,
  CHROME_RELIEF,
  CHROME_RIPPLE,
  CHROME_RIPPLE_SCALE,
  CHROME_RIPPLE_STEP,
  CHROME_SKY,
  CHROME_SKY_REACH,
  CHROME_GROUND,
  CHROME_GROUND_REACH,
  CHROME_STREAK,
  CHROME_SHINE,
  CHROME_SHINE_STRENGTH,
  CHROME_FRESNEL,
  CHROME_ALPHA,
  ECLIPSE_SCALE,
  ECLIPSE_FLOW,
  ECLIPSE_VEIN,
  ECLIPSE_VEIN_GLOW,
  ECLIPSE_PULSE,
  ECLIPSE_BODY,
  ECLIPSE_RIM,
  ECLIPSE_LIMB,
  ECLIPSE_LIMB_END,
  ECLIPSE_FLARE_SCALE,
  ECLIPSE_FLARE_SPEED,
  ECLIPSE_FLARE_FROM,
  ECLIPSE_FLARE_TO,
  ECLIPSE_FLARE_BASE,
  ECLIPSE_FLARE,
  ECLIPSE_ALPHA,
} = LOOK_TUNING;

/** The length of the light's shadow on the dish, for the glow through a marble. */
const SURFACE_LIGHT_XY = Math.hypot(SURFACE_LIGHT_X, SURFACE_LIGHT_Y);

/** The surface's slope at an arena position, per cell, from the density. */
function densitySlope(
  density: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  into: Float64Array
): void {
  into[0] =
    (sampleDensity(density, width, height, x + 1, y) -
      sampleDensity(density, width, height, x - 1, y)) *
    0.5;
  into[1] =
    (sampleDensity(density, width, height, x, y + 1) -
      sampleDensity(density, width, height, x, y - 1)) *
    0.5;
}

/**
 * The highlight of the light mirrored by a surface with that unit normal,
 * seen from straight above: the reflected light's share towards the viewer,
 * raised to `shine` - a tight, hard spot.
 */
function highlight(
  nx: number,
  ny: number,
  nz: number,
  shine: number,
  strength: number
): number {
  const lit =
    nx * SURFACE_LIGHT_X + ny * SURFACE_LIGHT_Y + nz * SURFACE_LIGHT_Z;
  const mirrored = 2 * lit * nz - SURFACE_LIGHT_Z;
  // Nothing but a tight spot mirrors the light - no power outside it.
  return mirrored <= 0 ? 0 : Math.pow(mirrored, shine) * strength;
}

/**
 * A glass marble's colour at `(ux, uy)` on its unit disc: a sphere lit by
 * the surface light, a swirl of the light colour inside, turned by `seed`,
 * a dark rim, a glow where the light leaves it and the highlight.
 */
function marbleShade(
  ux: number,
  uy: number,
  q2: number,
  seed: number,
  { rgb, light, dark }: ReturnType<typeof lookPalette>,
  out: Float64Array
): void {
  const z = Math.sqrt(Math.max(0, 1 - q2));
  const q = Math.sqrt(q2);
  const diffuse = Math.max(
    0,
    ux * SURFACE_LIGHT_X + uy * SURFACE_LIGHT_Y + z * SURFACE_LIGHT_Z
  );
  const lit = MARBLE_AMBIENT + (1 - MARBLE_AMBIENT) * diffuse;
  const swirl =
    0.5 +
    0.5 *
      Math.sin(
        Math.atan2(uy, ux) * MARBLE_SWIRL_TURNS +
          q * MARBLE_SWIRL_RINGS +
          seed * 2 * Math.PI
      );
  const rim = smoothstep(MARBLE_RIM_START, 1, q);
  const away =
    -(ux * SURFACE_LIGHT_X + uy * SURFACE_LIGHT_Y) / SURFACE_LIGHT_XY;
  const glow =
    smoothstep(MARBLE_GLOW_START, MARBLE_GLOW_END, away) *
    MARBLE_GLOW *
    (1 - rim * 0.5);
  const shine = highlight(ux, uy, z, MARBLE_SHINE, MARBLE_SHINE_STRENGTH);
  for (let c = 0; c < 3; c++) {
    let body = lerp(rgb[c], light[c], swirl * MARBLE_SWIRL) * lit;
    body = lerp(body, dark[c], rim * MARBLE_RIM);
    body += (light[c] - body) * glow;
    out[c] = Math.min(255, body + (255 - body) * shine);
  }
}

/**
 * The marbles look: glass marbles of different sizes on their own lattice
 * over the cells' dark base - see {@link marbleShade}.
 */
export const paintMarbles: LookPainter = (
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
  // Each lattice point's marble: centre x, y, radius (0 for none) and the
  // turn of its swirl.
  const lattice = buildLattice(
    latticeRegion,
    MARBLES.spacing * unit,
    4,
    (col, row, at, values) => {
      const marble = cellBubble(
        col,
        row,
        MARBLES,
        unit,
        density,
        width,
        height
      );
      if (marble != null) {
        values[at] = marble.x;
        values[at + 1] = marble.y;
        values[at + 2] = marble.radius;
        values[at + 3] = hash(col, row, 7);
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
        MARBLE_BASE_ALPHA * smoothstep(SLIME_EDGE_START, SLIME_EDGE_END, d);
      let marbleAlpha = 0;
      if (at >= 0) {
        marbleAlpha = cellEdge(found[0], values[at + 2], d);
        if (marbleAlpha > 0) {
          marbleShade(
            found[1],
            found[2],
            found[0],
            values[at + 3],
            palette,
            out
          );
        }
      }
      return overBase(out, marbleAlpha, palette.base, baseAlpha);
    }
  );
};

/** 1 where a noise crosses `level`, falling to 0 `width` away from it. */
function crack(noise: number, level: number, width: number): number {
  return 1 - smoothstep(0, width, Math.abs(noise - level));
}

/**
 * The lava look: a dark crust bulging with the colony, cracked along the
 * levels of a slowly flowing noise, the cracks glowing hot and breathing;
 * the front glows molten.
 */
export const paintLava: LookPainter = (
  data8,
  density,
  heat,
  width,
  height,
  color,
  shimmer,
  unit,
  region,
  _latticeRegion,
  timeSec
) => {
  const { rgb } = lookPalette(color);
  const hot = mix(rgb, WHITE, LAVA_GLOW_LIGHT);
  const crust = mix(
    [rgb[0] * LAVA_CRUST, rgb[1] * LAVA_CRUST, rgb[2] * LAVA_CRUST],
    [40, 40, 40],
    LAVA_GREY
  );
  const scale = 1 / (LAVA_SCALE * unit);
  const flow = timeSec * LAVA_FLOW;
  const slope = new Float64Array(2);
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
      const n = fbm(x * scale + flow, y * scale + flow * 0.6, 31);
      densitySlope(density, width, height, x, y, slope);
      // The crust faces the light where the colony rises towards it, and
      // the noise's own bumps catch it too.
      const lit = clamp(
        0.55 -
          (slope[0] * SURFACE_LIGHT_X + slope[1] * SURFACE_LIGHT_Y) *
            LAVA_RELIEF +
          (n - 0.5) * LAVA_BUMP,
        0.2,
        1
      );
      const pulse = 0.65 + 0.35 * Math.sin(timeSec * LAVA_PULSE + n * 12);
      const core =
        Math.max(
          crack(n, 0.5, LAVA_CRACK),
          crack(n, LAVA_CRACK_2, LAVA_CRACK) * 0.7
        ) * pulse;
      const halo =
        Math.max(
          crack(n, 0.5, LAVA_CRACK_HALO),
          crack(n, LAVA_CRACK_2, LAVA_CRACK_HALO) * 0.7
        ) *
        LAVA_HALO *
        pulse;
      const front =
        (1 - smoothstep(SLIME_EDGE_END, LAVA_EDGE_END, d)) * LAVA_EDGE_GLOW;
      const glow = Math.min(1, core + halo + front);
      for (let c = 0; c < 3; c++) {
        const molten = lerp(crust[c] * lit, hot[c], glow);
        out[c] = molten + (255 - molten) * core * 0.6;
      }
      return coverage * LAVA_ALPHA;
    }
  );
};

/**
 * The galaxy look: deep space in the colony's colour, with clouds of gas,
 * twinkling stars, a bright core and a faint rim.
 */
export const paintGalaxy: LookPainter = (
  data8,
  density,
  heat,
  width,
  height,
  color,
  shimmer,
  unit,
  region,
  _latticeRegion,
  timeSec
) => {
  const { rgb, light } = lookPalette(color);
  const scale = 1 / (GALAXY_SCALE * unit);
  const drift = timeSec * GALAXY_DRIFT;
  const starSpacing = GALAXY_STAR_SPACING * unit;
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
      const gas = fbm(x * scale + drift, y * scale, 41);
      const tint = fbm(x * scale * 2.1 - drift + 5, y * scale * 2.1 + 3, 43);
      const cloud =
        smoothstep(GALAXY_GAS_FROM, GALAXY_GAS_TO, gas) *
        (0.5 + 0.5 * tint) *
        GALAXY_GAS;
      const col = Math.floor(x / starSpacing);
      const row = Math.floor(y / starSpacing);
      const h = hash(col, row, 47);
      let star = 0;
      let starHalo = 0;
      if (h > 1 - GALAXY_STAR_SHARE) {
        const dx = x / starSpacing - col - (0.25 + 0.5 * hash(col, row, 48));
        const dy = y / starSpacing - row - (0.25 + 0.5 * hash(col, row, 49));
        const twinkle =
          0.55 + 0.45 * Math.sin(timeSec * GALAXY_TWINKLE + h * 60);
        const distance = Math.sqrt(dx * dx + dy * dy);
        star = (1 - smoothstep(0, GALAXY_STAR_RADIUS, distance)) * twinkle;
        starHalo =
          (1 - smoothstep(0, GALAXY_STAR_HALO, distance)) * 0.5 * twinkle;
      }
      const shine =
        smoothstep(0.5, 1, d) * GALAXY_CORE +
        coverage * (1 - coverage) * 4 * GALAXY_RIM;
      for (let c = 0; c < 3; c++) {
        const space =
          rgb[c] * GALAXY_DEEP +
          lerp(rgb[c], light[c], tint) * cloud +
          light[c] * (shine + starHalo);
        out[c] = Math.min(255, space + (255 - space) * star);
      }
      return coverage * GALAXY_ALPHA;
    }
  );
};

/**
 * The plasma look: a dark body full of arcs of light that move and
 * flicker, the outline glowing.
 */
export const paintPlasma: LookPainter = (
  data8,
  density,
  heat,
  width,
  height,
  color,
  shimmer,
  unit,
  region,
  _latticeRegion,
  timeSec
) => {
  const { rgb, light } = lookPalette(color);
  const scale = 1 / (PLASMA_SCALE * unit);
  const scale2 = 1 / (PLASMA_SCALE_2 * unit);
  const t = timeSec * PLASMA_SPEED;
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
      // The arcs run where each noise crosses its middle.
      const n = fbm(x * scale + t, y * scale - t * 0.7, 53);
      const n2 = fbm(x * scale2 - t * 0.6 + 9, y * scale2 + t * 0.4 + 2, 57);
      const flicker = 0.75 + 0.25 * Math.sin(timeSec * PLASMA_FLICKER + n * 40);
      const bolt = Math.min(
        1,
        (crack(n, 0.5, PLASMA_BOLT) + crack(n2, 0.5, PLASMA_BOLT) * 0.8) *
          flicker
      );
      const halo =
        (crack(n, 0.5, PLASMA_HALO_WIDTH) +
          crack(n2, 0.5, PLASMA_HALO_WIDTH) * 0.8) *
        PLASMA_HALO *
        coverage;
      const edge = coverage * (1 - coverage) * 4 * PLASMA_EDGE;
      for (let c = 0; c < 3; c++) {
        out[c] = Math.min(
          255,
          rgb[c] * (PLASMA_BODY + halo) +
            lerp(light[c], 255, bolt) * bolt * PLASMA_GLOW +
            light[c] * edge
        );
      }
      return Math.max(coverage * PLASMA_ALPHA, Math.min(1, bolt + edge));
    }
  );
};

/**
 * The chrome look: liquid metal that rises along the front like a bevel
 * and ripples inside, mirroring a sky in the colony's colour - bright above
 * the horizon, dark below - with a hard highlight and a bright rim.
 */
export const paintChrome: LookPainter = (
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
  const { rgb, light } = lookPalette(color);
  const sky = mix(light, WHITE, CHROME_SKY);
  const ground = mix(rgb, BLACK, CHROME_GROUND);
  const scale = 1 / (CHROME_RIPPLE_SCALE * unit);
  const step = CHROME_RIPPLE_STEP * unit;
  const slope = new Float64Array(2);
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
      densitySlope(density, width, height, x, y, slope);
      // The ripple's slope, read across a step either way.
      const ripple = (coverage * CHROME_RIPPLE) / (2 * step);
      let nx =
        -slope[0] * CHROME_RELIEF +
        (fbm((x + step) * scale, y * scale, 61) -
          fbm((x - step) * scale, y * scale, 61)) *
          ripple;
      let ny =
        -slope[1] * CHROME_RELIEF +
        (fbm(x * scale, (y + step) * scale, 61) -
          fbm(x * scale, (y - step) * scale, 61)) *
          ripple;
      const length = Math.sqrt(nx * nx + ny * ny + 1);
      nx /= length;
      ny /= length;
      const nz = 1 / length;
      // What the surface mirrors: the sky above the horizon, the ground
      // below, the colony's colour at it - a surface facing up the screen
      // sees the sky.
      const up = -ny;
      const streak =
        1 +
        (valueNoise(x * scale * 0.3, y * scale * 3, 65) - 0.5) * CHROME_STREAK;
      const fresnel = (1 - nz) * (1 - nz) * CHROME_FRESNEL;
      const shine = highlight(nx, ny, nz, CHROME_SHINE, CHROME_SHINE_STRENGTH);
      for (let c = 0; c < 3; c++) {
        const env =
          up > 0
            ? lerp(rgb[c], sky[c], smoothstep(0, CHROME_SKY_REACH, up))
            : lerp(rgb[c], ground[c], smoothstep(0, CHROME_GROUND_REACH, -up));
        const metal = Math.min(255, env * streak + light[c] * fresnel);
        out[c] = metal + (255 - metal) * shine;
      }
      return coverage * CHROME_ALPHA;
    }
  );
};

/** The slime, as every other look is called. */
export const paintSlimeLook: LookPainter = (
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

/**
 * The eclipse look, the boss's: a black body that swallows the light, with
 * veins pulsing faintly in the colony's colour where a slowly flowing noise
 * crosses its middle, and a corona blazing along the rim - the limb fading
 * in from it, and flares licking out past the edge where a noise rolling
 * around the colony runs high.
 */
export const paintEclipse: LookPainter = (
  data8,
  density,
  heat,
  width,
  height,
  color,
  shimmer,
  unit,
  region,
  _latticeRegion,
  timeSec
) => {
  const { rgb, light: hot } = lookPalette(color);
  const scale = 1 / (ECLIPSE_SCALE * unit);
  const flareScale = 1 / (ECLIPSE_FLARE_SCALE * unit);
  const flow = timeSec * ECLIPSE_FLOW;
  const roll = timeSec * ECLIPSE_FLARE_SPEED;
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
      const rim = coverage * (1 - coverage) * 4;
      const limb =
        (1 - smoothstep(SLIME_EDGE_END, ECLIPSE_LIMB_END, d)) *
        coverage *
        ECLIPSE_LIMB;
      // The flares only outside the body, the veins only inside: each
      // noise is left out where it would not show.
      const tongue =
        coverage < 1
          ? smoothstep(
              ECLIPSE_FLARE_FROM,
              ECLIPSE_FLARE_TO,
              fbm(x * flareScale + roll, y * flareScale - roll * 0.7, 61)
            )
          : 0;
      const flare =
        smoothstep(0, SLIME_EDGE_START, d) *
        (1 - coverage) *
        (ECLIPSE_FLARE_BASE + (1 - ECLIPSE_FLARE_BASE) * tongue) *
        ECLIPSE_FLARE;
      const alpha = Math.max(coverage * ECLIPSE_ALPHA, flare);
      if (alpha <= 0) {
        return 0;
      }
      const corona = Math.min(1, rim * ECLIPSE_RIM + limb + flare);
      let veins = 0;
      if (coverage > 0) {
        const n = fbm(x * scale + flow, y * scale - flow * 0.5, 59);
        const pulse = 0.5 + 0.5 * Math.sin(timeSec * ECLIPSE_PULSE + n * 6);
        veins =
          crack(n, 0.5, ECLIPSE_VEIN) *
          coverage *
          ECLIPSE_VEIN_GLOW *
          (0.35 + 0.65 * pulse);
      }
      for (let c = 0; c < 3; c++) {
        out[c] = Math.min(
          255,
          rgb[c] * ECLIPSE_BODY * coverage + hot[c] * corona + rgb[c] * veins
        );
      }
      return alpha;
    }
  );
};
