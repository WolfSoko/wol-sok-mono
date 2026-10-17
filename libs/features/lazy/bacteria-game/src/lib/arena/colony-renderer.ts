import { BacteriaLook } from '../settings.service';
import { Nutrient } from '../state/bacteria-simulation';
import { GameBalance, gameBalance } from '../state/game-balance';
import { clamp } from '../state/geometry';
import { Bacteria } from '../state/player.model';
import { Rgb } from './arena-theme';
import { hash, rgba, smoothstep } from './canvas-math';

/** What the renderer needs to know about one colony. */
export interface ColonyLayer {
  /** RGBA, the alpha from 0 to 255. */
  color: readonly number[];
  bacterias: readonly Bacteria[];
  /** True while the colony's boost runs - its bacteria shimmer then. */
  boosted: boolean;
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
 * shimmers with a wave of light running across it.
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
  shimmerTimeSec: number | null = null
): Uint8ClampedArray {
  const [r, g, b, alpha] = color;
  const energyRange = balance.superChargedMaxEnergy - balance.maxEnergy;
  for (let i = 0; i < bacterias.length; i++) {
    const { x, y, energy } = bacterias[i];
    const data8index = (y * width + x) * 4;

    let heat =
      energy > balance.maxEnergy && energyRange > 0
        ? Math.min(1, (energy - balance.maxEnergy) / energyRange)
        : 0;
    if (shimmerTimeSec != null) {
      heat = Math.max(heat, shimmer(x, y, shimmerTimeSec));
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
    const strength = Math.max(energy, 0) / balance.maxEnergy;
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
 */
export function colonyDensity(
  density: Float32Array,
  heat: Float32Array,
  scratch: Float32Array,
  width: number,
  height: number,
  bacterias: readonly Bacteria[],
  balance: GameBalance = gameBalance
): void {
  density.fill(0);
  heat.fill(0);
  const energyRange = balance.superChargedMaxEnergy - balance.maxEnergy;
  for (const { x, y, energy } of bacterias) {
    const index = y * width + x;
    const strength = Math.min(1, Math.max(energy, 0) / balance.maxEnergy);
    density[index] += 0.55 + 0.45 * strength;
    if (energy > balance.maxEnergy && energyRange > 0) {
      heat[index] += Math.min(1, (energy - balance.maxEnergy) / energyRange);
    }
  }
  for (const field of [density, heat]) {
    boxBlur(field, scratch, width, height);
    boxBlur(field, scratch, width, height);
  }
}

/**
 * Turns the density of a colony into slime on a buffer {@link SLIME_SCALE}
 * times the size of the arena: the outline where the density crosses a
 * threshold, a dark rim just inside it, a glossy highlight where the surface
 * faces the light, white heat where the colony is overcharged - and, while
 * it is boosted, a shimmer running across it with a sparkle here and there.
 *
 * The density is sampled bilinearly between the cells, which is what makes
 * the outline round.
 */
export function paintSlime(
  data8: Uint8ClampedArray,
  density: Float32Array,
  heat: Float32Array,
  width: number,
  height: number,
  color: readonly number[],
  shimmerTimeSec: number | null
): void {
  const [r, g, b] = color;
  const outWidth = width * SLIME_SCALE;
  const outHeight = height * SLIME_SCALE;
  const step = 1 / SLIME_SCALE;

  for (let py = 0; py < outHeight; py++) {
    // Pixel centres, in cell units, shifted so a cell's centre is a lattice point.
    const gy = (py + 0.5) * step - 0.5;
    const y0 = clamp(Math.floor(gy), 0, height - 1);
    const y1 = clamp(y0 + 1, 0, height - 1);
    const fy = Math.min(1, Math.max(0, gy - y0));
    for (let px = 0; px < outWidth; px++) {
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
      const fx = Math.min(1, Math.max(0, gx - x0));
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
      const gloss = Math.pow(Math.min(1, Math.max(0, facing * 5)), 3);
      // Thick slime is deeper in colour; the edge is a darker rim.
      const depth = 0.8 + 0.2 * (1 - Math.min(1, d));
      const rim = 1 - 0.45 * coverage * (1 - coverage) * 4;
      let shade = depth * rim;

      const h00 = heat[i00];
      const h10 = heat[i10];
      const hTop = h00 + (h10 - h00) * fx;
      const hBottom = heat[i01] + (heat[i11] - heat[i01]) * fx;
      let white = Math.min(
        1,
        (hTop + (hBottom - hTop) * fy) / Math.max(d, 0.05)
      );
      white = Math.max(white, gloss * 0.75);
      if (shimmerTimeSec != null) {
        const wave = shimmer(px * step, py * step, shimmerTimeSec);
        white = Math.max(white, wave * 0.8);
        shade = Math.max(shade, 0.85 + 0.15 * wave);
        if (sparkle(px, py, shimmerTimeSec)) {
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

/** A pellet of food as a drop of jam, in one of a few flavours. */
interface Jam {
  body: Rgb;
  light: Rgb;
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
  timeSec: number
): void {
  for (let n = 0; n < nutrients.length; n++) {
    const nutrient = nutrients[n];
    if (nutrient.amount <= 0) {
      continue;
    }
    // Both pellets of a mirrored pair get the same flavour.
    const jam = JAMS[(n >> 1) % JAMS.length];
    const left = Math.min(1, nutrient.amount / nutrientEnergy);
    const wobble = 1 + 0.08 * Math.sin(timeSec * 4 + n * 1.7);
    const radius = (1.3 + 1.9 * left) * wobble;
    const x = nutrient.x + 0.5;
    const y = nutrient.y + 0.5;

    const halo = 0.5 + 0.5 * Math.sin(timeSec * 2.5 + n);
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
 * slime for the slime look. The buffers are kept between frames.
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
    private readonly height: number
  ) {
    const cells = width * height;
    this.density = new Float32Array(cells);
    this.heat = new Float32Array(cells);
    this.scratch = new Float32Array(cells);
  }

  /** The layer with every colony on it, or null where there is no canvas. */
  public render(
    colonies: readonly ColonyLayer[],
    balance: GameBalance,
    look: BacteriaLook,
    timeSec: number
  ): HTMLCanvasElement | null {
    const scale = look === 'slime' ? SLIME_SCALE : 1;
    if (!this.prepare(scale) || this.image == null || this.context == null) {
      return null;
    }
    const data = this.image.data;
    data.fill(0);
    for (const colony of colonies) {
      const shimmerTime = colony.boosted ? timeSec : null;
      if (look === 'slime') {
        colonyDensity(
          this.density,
          this.heat,
          this.scratch,
          this.width,
          this.height,
          colony.bacterias,
          balance
        );
        paintSlime(
          data,
          this.density,
          this.heat,
          this.width,
          this.height,
          colony.color,
          shimmerTime
        );
      } else {
        createImageDataFromBacterias(
          data,
          this.width,
          colony.color,
          colony.bacterias,
          balance,
          shimmerTime
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
    if (typeof document === 'undefined') {
      return false;
    }
    const canvas = this.canvas ?? document.createElement('canvas');
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

/** A band of light sweeping diagonally across a boosted colony, 0 to 1. */
function shimmer(x: number, y: number, timeSec: number): number {
  const wave = 0.5 + 0.5 * Math.sin(timeSec * 9 - (x + y * 0.6) * 0.35);
  return Math.pow(wave, 6);
}

/** True for the few pixels that glint in this tenth of a second. */
function sparkle(x: number, y: number, timeSec: number): boolean {
  return hash(x >> 1, y >> 1, Math.floor(timeSec * 10)) > 0.992;
}

/** Blurs the field in place with a 3x3 box, the edges clamped. */
function boxBlur(
  field: Float32Array,
  scratch: Float32Array,
  width: number,
  height: number
): void {
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const left = field[row + (x > 0 ? x - 1 : x)];
      const right = field[row + (x < width - 1 ? x + 1 : x)];
      scratch[row + x] = (left + field[row + x] + right) / 3;
    }
  }
  for (let y = 0; y < height; y++) {
    const up = (y > 0 ? y - 1 : y) * width;
    const row = y * width;
    const down = (y < height - 1 ? y + 1 : y) * width;
    for (let x = 0; x < width; x++) {
      field[row + x] =
        (scratch[up + x] + scratch[row + x] + scratch[down + x]) / 3;
    }
  }
}

function darker([r, g, b]: Rgb): Rgb {
  return [r * 0.55, g * 0.55, b * 0.55];
}
