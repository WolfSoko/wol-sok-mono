import { DynamicWall, Rect } from '../state/maps';
import { ArenaPattern, ArenaTheme, Rgb } from './arena-theme';
import { hash, rgba, smoothstep } from './canvas-math';

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

      let [r, g, b] = mix(theme.floor, theme.rim, vignette);
      const ink =
        pattern(x, y, width, height) *
        theme.patternStrength *
        (1 - 0.6 * vignette);
      r += (theme.patternColor[0] - r) * ink;
      g += (theme.patternColor[1] - g) * ink;
      b += (theme.patternColor[2] - b) * ink;

      const grain = (hash(x, y, 7) - 0.5) * 6;
      r += grain;
      g += grain;
      b += grain;

      // The frame: the outermost ring bright, the next one a soft glow.
      const ring = Math.min(x, y, width - 1 - x, height - 1 - y);
      const frame =
        ring === 0 ? 0.85 : ring === 1 ? 0.35 : ring === 2 ? 0.12 : 0;
      r += (theme.border[0] - r) * frame;
      g += (theme.border[1] - g) * frame;
      b += (theme.border[2] - b) * frame;

      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return data;
}

/** A speck drifting over the floor. */
interface Mote {
  x: number;
  y: number;
  /** Its own drift on top of the theme's current. */
  vx: number;
  vy: number;
  /** Where in its twinkle it is, in radians. */
  phase: number;
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
  /** Diagonal hazard stripes for the closed gates and sliding walls. */
  private hazard: HTMLCanvasElement | null = null;
  /** The stripes as a fill, made once per theme on the first closed wall. */
  private hazardPattern: CanvasPattern | null = null;
  private motes: Mote[] = [];
  private timeSec = 0;

  public constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly random: () => number = Math.random
  ) {}

  /** Switches to another level's look, repainting its floor. */
  public setTheme(theme: ArenaTheme): void {
    if (this.theme === theme) {
      return;
    }
    this.theme = theme;
    this.floor = this.paintFloor(theme);
    this.hazard = this.paintHazard(theme);
    this.hazardPattern = null;
    this.motes = Array.from({ length: theme.moteCount }, () => ({
      x: this.random() * this.width,
      y: this.random() * this.height,
      vx: (this.random() - 0.5) * 3,
      vy: (this.random() - 0.5) * 3,
      phase: this.random() * Math.PI * 2,
    }));
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
    cx.globalAlpha = 1;
  }

  /** Draws the static walls with a lit top and left edge. */
  public drawWalls(cx: CanvasRenderingContext2D, walls: Rect[]): void {
    const theme = this.theme;
    if (theme == null) {
      return;
    }
    for (const wall of walls) {
      cx.fillStyle = rgba(theme.wall);
      cx.fillRect(wall.x, wall.y, wall.width, wall.height);
      cx.fillStyle = rgba(theme.wallEdge);
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
    for (const wall of walls) {
      if (wall.solid) {
        // The pattern lives in arena space, so a sliding wall moves under
        // still stripes - like a conveyor, which reads as motion.
        if (this.hazardPattern == null && this.hazard != null) {
          this.hazardPattern = cx.createPattern(this.hazard, 'repeat');
        }
        cx.fillStyle = this.hazardPattern ?? rgba(theme.border);
        cx.fillRect(wall.x, wall.y, wall.width, wall.height);
        continue;
      }
      const blink =
        wall.warning > 0
          ? 0.5 + 0.5 * Math.sin(this.timeSec * (10 + 30 * wall.warning))
          : 0;
      cx.fillStyle = rgba(theme.border, 0.08 + 0.4 * blink * wall.warning);
      cx.fillRect(wall.x, wall.y, wall.width, wall.height);
      cx.strokeStyle = rgba(theme.border, 0.3 + 0.6 * blink);
      cx.lineWidth = 1;
      cx.strokeRect(
        wall.x + 0.5,
        wall.y + 0.5,
        wall.width - 1,
        wall.height - 1
      );
    }
  }

  /** Moves the specks along the current and draws them, twinkling. */
  public drawMotes(cx: CanvasRenderingContext2D, deltaTimeSec: number): void {
    const theme = this.theme;
    if (theme == null) {
      return;
    }
    this.timeSec += deltaTimeSec;
    for (const mote of this.motes) {
      mote.x = wrap(
        mote.x + (theme.current.x + mote.vx) * deltaTimeSec,
        this.width
      );
      mote.y = wrap(
        mote.y + (theme.current.y + mote.vy) * deltaTimeSec,
        this.height
      );
      const twinkle = 0.5 + 0.5 * Math.sin(this.timeSec * 1.7 + mote.phase);
      cx.fillStyle = rgba(theme.motes, 0.12 + 0.3 * twinkle);
      cx.fillRect(Math.floor(mote.x), Math.floor(mote.y), 1, 1);
    }
  }

  /**
   * One tile of the hazard stripes: the frame colour crossed by dark
   * diagonals, three cells each, or null where there is no canvas.
   */
  private paintHazard(theme: ArenaTheme): HTMLCanvasElement | null {
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
    return tile;
  }

  /** The floor in an offscreen canvas, or null where there is no canvas. */
  private paintFloor(theme: ArenaTheme): HTMLCanvasElement | null {
    const canvas = createCanvas(this.width, this.height);
    const context = canvas?.getContext?.('2d');
    if (canvas == null || context == null) {
      return null;
    }
    const image = context.createImageData(this.width, this.height);
    paintArenaBackground(image.data, this.width, this.height, theme);
    context.putImageData(image, 0, 0);
    return canvas;
  }
}

/** Width of one hazard stripe tile in arena cells - a dark and a light band. */
const HAZARD_TILE = 6;

/** An offscreen canvas of that size, or null outside a browser. */
function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
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
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = lerp(hash(ix, iy, seed), hash(ix + 1, iy, seed), sx);
  const bottom = lerp(hash(ix, iy + 1, seed), hash(ix + 1, iy + 1, seed), sx);
  return lerp(top, bottom, sy);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(a: Rgb, b: Rgb, t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}
