import { Motes } from './motes';
import { DynamicWall, Rect } from '../state/maps';
import { ArenaPattern, ArenaTheme, Rgb } from './arena-theme';
import { createCanvas, hash, lerp, mix, rgba, smoothstep } from './canvas-math';
import { darker } from './colony-renderer';
import { Zone } from '../state/zones';
import { paintZoneLayer } from './zone-decal';

/**
 * Paints the floor of an arena into an RGBA pixel buffer: the theme's floor
 * colour darkening towards a vignette, its pattern, a fine grain - and a
 * bright frame on the outermost pixels, so the edge of the arena reads as a
 * wall even where no wall is drawn.
 *
 * Pure and seeded: the same theme always gives the same floor.
 */
export function paintArenaBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  theme: ArenaTheme
): Uint8ClampedArray {
  const pattern = PATTERNS[theme.pattern];
  const halfW = width / 2;
  const halfH = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x + 0.5 - halfW) / halfW;
      const dy = (y + 0.5 - halfH) / halfH;
      // A rounded box: dark in the corners, still dark along the edges.
      const edge = Math.pow(
        Math.pow(Math.abs(dx), 4) + Math.pow(Math.abs(dy), 4),
        0.25
      );
      const vignette = smoothstep(0.45, 1.05, edge);

      const ink =
        pattern(x, y, width, height) *
        theme.patternStrength *
        (1 - 0.6 * vignette);
      const floor = mix(
        mix(theme.floor, theme.rim, vignette),
        theme.patternColor,
        ink
      );
      const grain = (hash(x, y, 7) - 0.5) * 6;

      // The frame: the outermost ring bright, the next one a soft glow.
      const ring = Math.min(x, y, width - 1 - x, height - 1 - y);
      const frame =
        ring === 0 ? 0.85 : ring === 1 ? 0.35 : ring === 2 ? 0.12 : 0;
      const [r, g, b] = mix(
        [floor[0] + grain, floor[1] + grain, floor[2] + grain],
        theme.border,
        frame
      );

      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return data;
}

/**
 * Draws everything of the arena that is not a colony: the floor, the walls,
 * the gates and sliding walls, and the specks drifting over it all.
 *
 * The floor is painted once per theme into an offscreen canvas and copied in
 * every frame. Copying it at partial opacity is also what fades the last
 * frame into a short trail behind every bacterium.
 */
export class ArenaRenderer {
  private theme: ArenaTheme | null = null;
  private floor: HTMLCanvasElement | null = null;
  /** The zones the floor was laid with. */
  private zones: readonly Zone[] = [];
  /** The zones as a layer over the floor, finer than the cells. */
  private zoneLayer: HTMLCanvasElement | null = null;
  /** Diagonal hazard stripes for the closed gates and sliding walls. */
  private hazard: CanvasPattern | null = null;
  /** The theme's colours as CSS, built once instead of every frame. */
  private css = { wall: '', wallEdge: '', border: '', motes: '' };
  private readonly motes: Motes;

  public constructor(
    private readonly width: number,
    private readonly height: number,
    random: () => number = Math.random,
    /** Screen pixels per arena cell - the zones are drawn that fine. */
    private readonly scale = 1
  ) {
    this.motes = new Motes(width, height, random);
  }

  /** Switches to another level's look, repainting its floor. */
  public setFloor(theme: ArenaTheme, zones: readonly Zone[]): void {
    if (this.zones !== zones) {
      this.zones = zones;
      this.zoneLayer = this.paintZones(zones);
    }
    if (this.theme === theme) {
      return;
    }
    this.theme = theme;
    this.floor = this.paintFloor(theme);
    this.hazard = this.paintHazard(theme);
    this.css = {
      wall: rgba(theme.wall),
      wallEdge: rgba(theme.wallEdge),
      border: rgba(theme.border),
      motes: rgba(theme.motes),
    };
    this.motes.reset(theme);
  }

  /**
   * Lays the floor over the last frame - fully for `clear`, otherwise at
   * partial opacity, which leaves a fading trail of what moved.
   */
  public drawFloor(cx: CanvasRenderingContext2D, clear: boolean): void {
    cx.globalAlpha = clear ? 1 : 0.7;
    if (this.floor != null) {
      cx.drawImage(this.floor, 0, 0);
    } else {
      cx.fillStyle = rgba(this.theme?.floor ?? [0, 0, 0]);
      cx.fillRect(0, 0, this.width, this.height);
    }
    if (this.zoneLayer != null) {
      // Finer than the cells, and smoothed: soft edges, not steps.
      const smoothing = cx.imageSmoothingEnabled;
      cx.imageSmoothingEnabled = true;
      cx.drawImage(this.zoneLayer, 0, 0, this.width, this.height);
      cx.imageSmoothingEnabled = smoothing;
    }
    cx.globalAlpha = 1;
  }

  /**
   * Draws the static walls with a lit top and left edge - the round ones as
   * blobs that melt into each other, see {@link blobBody}.
   */
  public drawWalls(cx: CanvasRenderingContext2D, walls: readonly Rect[]): void {
    const theme = this.theme;
    if (theme == null) {
      return;
    }
    this.drawBlobs(cx, walls, darker(theme.wall), theme);
    for (const wall of walls) {
      if (wall.round) {
        continue;
      }
      cx.fillStyle = this.css.wall;
      cx.fillRect(wall.x, wall.y, wall.width, wall.height);
      cx.fillStyle = this.css.wallEdge;
      cx.fillRect(wall.x, wall.y, wall.width, 1);
      cx.fillRect(wall.x, wall.y, 1, wall.height);
    }
  }

  /**
   * Draws the gates and sliding walls. A closed one is a hazard striped
   * block in the frame colour, an open gate only a faint outline - which starts to blink,
   * faster and faster, once the gate is about to slam shut.
   */
  public drawDynamicWalls(
    cx: CanvasRenderingContext2D,
    walls: readonly DynamicWall[]
  ): void {
    const theme = this.theme;
    if (theme == null) {
      return;
    }
    // Living tissue rather than machinery: rimmed in the frame colour.
    this.drawBlobs(cx, walls, theme.border, theme);
    for (const wall of walls) {
      if (wall.round) {
        continue;
      }
      if (wall.solid) {
        // The pattern lives in arena space, so a sliding wall moves under
        // still stripes - like a conveyor, which reads as motion.
        cx.fillStyle = this.hazard ?? this.css.border;
        cx.fillRect(wall.x, wall.y, wall.width, wall.height);
        continue;
      }
      const blink = gateBlink(wall.warning, this.motes.timeSec);
      cx.fillStyle = rgba(theme.border, openGateFill(wall.warning, blink));
      cx.fillRect(wall.x, wall.y, wall.width, wall.height);
      cx.strokeStyle = rgba(theme.border, openGateOutline(blink));
      cx.lineWidth = 1;
      cx.strokeRect(
        wall.x + 0.5,
        wall.y + 0.5,
        wall.width - 1,
        wall.height - 1
      );
    }
  }

  /** The round walls among these, pass by pass - see {@link blobLayer}. */
  private drawBlobs(
    cx: CanvasRenderingContext2D,
    walls: readonly Rect[],
    rim: Rgb,
    theme: ArenaTheme
  ): void {
    if (!walls.some((wall) => wall.round)) {
      return;
    }
    const shape: Rect = { x: 0, y: 0, width: 0, height: 0 };
    for (let layer = 0; layer < BLOB_LAYERS; layer++) {
      cx.fillStyle = rgba(blobColor(layer, rim, theme), BLOB_ALPHA[layer]);
      cx.beginPath();
      for (const wall of walls) {
        if (wall.round) {
          const { x, y, width, height } = blobLayer(layer, wall, shape);
          cx.moveTo(x + width, y + height / 2);
          cx.ellipse(
            x + width / 2,
            y + height / 2,
            width / 2,
            height / 2,
            0,
            0,
            2 * Math.PI
          );
        }
      }
      cx.fill();
    }
  }

  /** Moves the specks along the current and draws them, twinkling. */
  public drawMotes(cx: CanvasRenderingContext2D, deltaTimeSec: number): void {
    const theme = this.theme;
    if (theme == null) {
      return;
    }
    this.motes.advance(deltaTimeSec);
    cx.fillStyle = this.css.motes;
    this.motes.forEach((x, y, alpha) => {
      cx.globalAlpha = alpha;
      cx.fillRect(x, y, 1, 1);
    });
    cx.globalAlpha = 1;
  }

  /**
   * The hazard stripes as a fill: a tile of the frame colour crossed by dark
   * diagonals, three cells each, or null where there is no canvas. A
   * pattern may fill any canvas, not only the tile's own.
   */
  private paintHazard(theme: ArenaTheme): CanvasPattern | null {
    const tile = createCanvas(HAZARD_TILE, HAZARD_TILE);
    const context = tile?.getContext?.('2d');
    if (tile == null || context == null) {
      return null;
    }
    context.fillStyle = rgba(theme.border);
    context.fillRect(0, 0, HAZARD_TILE, HAZARD_TILE);
    context.fillStyle = rgba(theme.rim, 0.75);
    for (let y = 0; y < HAZARD_TILE; y++) {
      for (let x = 0; x < HAZARD_TILE; x++) {
        if ((x + y) % HAZARD_TILE < HAZARD_TILE / 2) {
          context.fillRect(x, y, 1, 1);
        }
      }
    }
    return context.createPattern(tile, 'repeat');
  }

  /** The floor in an offscreen canvas, or null where there is no canvas. */
  private paintFloor(theme: ArenaTheme): HTMLCanvasElement | null {
    return imageCanvas(
      paintArenaBackground(
        new Uint8ClampedArray(this.width * this.height * 4),
        this.width,
        this.height,
        theme
      ),
      this.width,
      this.height
    );
  }

  /** The zone layer in an offscreen canvas - null without zones or a canvas. */
  private paintZones(zones: readonly Zone[]): HTMLCanvasElement | null {
    // No canvas, no layer - not worth painting it then.
    if (createCanvas(1, 1) == null) {
      return null;
    }
    const layer = paintZoneLayer(this.width, this.height, zones, this.scale);
    return layer === null
      ? null
      : imageCanvas(layer.data, layer.width, layer.height);
  }
}

/**
 * How round walls are drawn, pass by pass: every rim first, then every body
 * over them - so overlapping blobs read as one lumpy shape without seams -
 * then a wet shine on each. {@link blobLayer} gives a pass's ellipse.
 */
export const BLOB_LAYERS = 3;

/** The opacity of each pass. */
export const BLOB_ALPHA: readonly number[] = [1, 1, 0.3];

/** The colour of each pass: the rim, the wall, the lit edge for the shine. */
export function blobColor(layer: number, rim: Rgb, theme: ArenaTheme): Rgb {
  return layer === 0 ? rim : layer === 1 ? theme.wall : theme.wallEdge;
}

/**
 * The ellipse of a round wall in one pass, written into `out` so a frame
 * allocates nothing: the wall itself, the body pulled in a little so the
 * rim shows around it, or a small shine up and to the left.
 */
export function blobLayer(layer: number, wall: Rect, out: Rect): Rect {
  const { x, y, width, height } = wall;
  if (layer === 0) {
    out.x = x;
    out.y = y;
    out.width = width;
    out.height = height;
  } else if (layer === 1) {
    out.x = x + 0.7;
    out.y = y + 0.7;
    out.width = Math.max(0, width - 1.4);
    out.height = Math.max(0, height - 1.4);
  } else {
    out.x = x + width * 0.15;
    out.y = y + height * 0.125;
    out.width = width * 0.4;
    out.height = height * 0.3;
  }
  return out;
}

/** Width of one hazard stripe tile in arena cells - a dark and a light band. */
export const HAZARD_TILE = 6;

/**
 * How bright an open gate blinks, 0 to 1: not at all while it is safe, and
 * faster and faster the closer it is to slamming shut.
 */
export function gateBlink(warning: number, timeSec: number): number {
  return warning > 0 ? 0.5 + 0.5 * Math.sin(timeSec * (10 + 30 * warning)) : 0;
}

/** The opacity of an open gate's fill. */
export function openGateFill(warning: number, blink: number): number {
  return 0.08 + 0.4 * blink * warning;
}

/** The opacity of an open gate's outline. */
export function openGateOutline(blink: number): number {
  return 0.3 + 0.6 * blink;
}

/** Each pattern gives the ink at a pixel, from 0 to 1. */
const PATTERNS: Record<
  ArenaPattern,
  (x: number, y: number, width: number, height: number) => number
> = {
  // Soft colonies of mould on the agar, and a few dots of older ones.
  agar: (x, y) => {
    const blotch = smoothstep(0.55, 0.8, fractalNoise(x / 22, y / 22, 1));
    const dots =
      hash(Math.floor(x / 3), Math.floor(y / 3), 2) > 0.985 ? 0.6 : 0;
    return Math.max(blotch, dots);
  },
  // Lab grid paper: major lines, and a dot at every minor crossing.
  grid: (x, y) => {
    if (x % 16 === 0 || y % 16 === 0) {
      return 1;
    }
    return x % 4 === 0 && y % 4 === 0 ? 0.5 : 0;
  },
  // Wind ripples in sand, bent by a slow noise.
  dunes: (x, y) => {
    const wave = Math.sin(
      (x * 0.5 + y) / 4 + fractalNoise(x / 30, y / 30, 3) * 6
    );
    return smoothstep(0.6, 0.95, wave);
  },
  // Rings around the centre, like a dish someone stirred.
  rings: (x, y, width, height) => {
    const distance = Math.hypot((x - width / 2) * 0.55, y - height / 2);
    const ring = Math.abs(((distance / 7) % 1) - 0.5) * 2;
    return smoothstep(0.75, 1, ring);
  },
  // A honeycomb of plant cells.
  hex: (x, y) => cellEdges(x, y, 9, 0),
  // Irregular cells, like tissue under the microscope.
  cells: (x, y) => cellEdges(x, y, 11, 0.8),
  // Branching blood vessels - where a ridged noise crosses its midline.
  veins: (x, y) => {
    const ridge = Math.abs(fractalNoise(x / 26, y / 26, 5) - 0.5);
    return 1 - smoothstep(0.015, 0.06, ridge);
  },
  // Circuit traces: a coarse grid of which only some segments are laid.
  circuit: (x, y) => {
    const size = 12;
    const cx = Math.floor(x / size);
    const cy = Math.floor(y / size);
    const onRow = y % size === 0 && hash(cx, cy, 11) > 0.45;
    const onColumn = x % size === 0 && hash(cx, cy, 13) > 0.55;
    const pad =
      x % size <= 1 && y % size <= 1 && hash(cx, cy, 17) > 0.7 ? 1 : 0;
    return Math.max(onRow || onColumn ? 0.9 : 0, pad);
  },
  // Rings of small air sacs, as in a slice of lung.
  bubbles: (x, y) => {
    const size = 14;
    const cx = Math.floor(x / size);
    const cy = Math.floor(y / size);
    const px = (cx + 0.2 + hash(cx, cy, 29) * 0.6) * size;
    const py = (cy + 0.2 + hash(cx, cy, 31) * 0.6) * size;
    const radius = size * (0.18 + hash(cx, cy, 37) * 0.2);
    return (
      1 - smoothstep(0.4, 1.4, Math.abs(Math.hypot(x - px, y - py) - radius))
    );
  },
  // Fine, tangled threads - ridges of two noises crossing.
  hyphae: (x, y) => {
    const fine = Math.abs(fractalNoise(x / 14, y / 14, 41) - 0.5);
    const coarse = Math.abs(fractalNoise(x / 34, y / 34, 43) - 0.5);
    return Math.max(
      1 - smoothstep(0.01, 0.035, fine),
      0.7 * (1 - smoothstep(0.01, 0.04, coarse))
    );
  },
  // Muscle fibres: long, gently bending stripes.
  fibres: (x, y) => {
    const bend = fractalNoise(x / 40, y / 40, 47) * 10;
    const stripe = Math.sin((y + bend + x * 0.15) * 1.3);
    return smoothstep(0.55, 0.95, stripe) * (0.6 + 0.4 * hash(x >> 3, y, 53));
  },
  // The wrinkles of a gut lining: soft waves running across.
  folds: (x, y) => {
    const wave = Math.sin(
      x / 5 + Math.sin(y / 9) * 2.2 + fractalNoise(x / 24, y / 24, 59) * 4
    );
    return smoothstep(0.7, 1, wave);
  },
};

/**
 * Ink along the borders of a cell pattern: Voronoi cells on a grid of the
 * given size, their centres jittered by `jitter` (0 is a regular honeycomb).
 */
function cellEdges(x: number, y: number, size: number, jitter: number): number {
  const gy = Math.floor(y / size);
  let nearest = Infinity;
  let second = Infinity;
  for (let oy = -1; oy <= 1; oy++) {
    const row = gy + oy;
    // Every other row shifted by half a cell turns squares into hexagons.
    const shift = (row & 1) * 0.5;
    const gx = Math.floor(x / size - shift);
    for (let ox = -1; ox <= 1; ox++) {
      const column = gx + ox;
      const px =
        (column + shift + 0.5 + (hash(column, row, 19) - 0.5) * jitter) * size;
      const py = (row + 0.5 + (hash(column, row, 23) - 0.5) * jitter) * size;
      const distance = Math.hypot(x - px, y - py);
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
      } else if (distance < second) {
        second = distance;
      }
    }
  }
  return 1 - smoothstep(0.4, 1.6, second - nearest);
}

/** Two octaves of value noise, from 0 to 1. */
function fractalNoise(x: number, y: number, seed: number): number {
  return (
    (valueNoise(x, y, seed) * 2 + valueNoise(x * 2.1, y * 2.1, seed + 1)) / 3
  );
}

/** Smoothly interpolated noise on an integer lattice, from 0 to 1. */
function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = smoothstep(0, 1, fx);
  const sy = smoothstep(0, 1, fy);
  const top = lerp(hash(ix, iy, seed), hash(ix + 1, iy, seed), sx);
  const bottom = lerp(hash(ix, iy + 1, seed), hash(ix + 1, iy + 1, seed), sx);
  return lerp(top, bottom, sy);
}

/** RGBA pixels in an offscreen canvas, or null where there is no canvas. */
function imageCanvas(
  data: Uint8ClampedArray,
  width: number,
  height: number
): HTMLCanvasElement | null {
  const canvas = createCanvas(width, height);
  const context = canvas?.getContext?.('2d');
  if (canvas == null || context == null) {
    return null;
  }
  const image = context.createImageData(width, height);
  image.data.set(data);
  context.putImageData(image, 0, 0);
  return canvas;
}
