import { Motes } from './motes';
import { DynamicWall, Rect } from '../state/maps';
import { ArenaPattern, ArenaTheme, Rgb } from './arena-theme';
import {
  createCanvas,
  hash,
  lerp,
  mix,
  putPixels,
  rgba,
  smoothstep,
  valueNoise,
} from './canvas-math';
import { darker } from './colony-renderer';
import { Zone } from '../state/zones';
import { clamp } from '../state/geometry';
import { paintZoneLayer } from './zone-decal';
import { ColonyTint, MarkLayer, sameRgb, WeaponMark } from './weapon-fx';

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
    random: () => number,
    /** Pixels per arena cell the zones are painted with. */
    private readonly scale: number,
    /** Cells per base cell - the zones' marks are as big on every grid. */
    private readonly unit: number
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
    drawWallBlobs(cx, walls, darker(theme.wall), theme);
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
    drawWallBlobs(cx, walls, theme.border, theme);
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

  /**
   * Draws a layer of the weapons' marks - see `WeaponFx` - and, for
   * `light`, adds it over the frame as light.
   */
  public drawWeaponMarks(
    cx: CanvasRenderingContext2D,
    layer: MarkLayer,
    light: boolean
  ): void {
    if (layer.count === 0) {
      return;
    }
    cx.globalCompositeOperation = light ? 'lighter' : 'source-over';
    for (let i = 0; i < layer.count; i++) {
      drawMark(cx, layer.at(i));
    }
    cx.globalCompositeOperation = 'source-over';
  }

  /**
   * Shades the colonies' layer where a toxin cloud or the ice lies on it -
   * every colony in the circle: the layer holds them all as one.
   */
  public tintColonies(
    layer: HTMLCanvasElement,
    tints: readonly ColonyTint[]
  ): void {
    const cx = tints.length > 0 ? layer.getContext('2d') : null;
    if (cx == null) {
      return;
    }
    const scale = layer.width / this.width;
    cx.save();
    cx.setTransform(scale, 0, 0, scale, 0, 0);
    // Only over what is drawn already: the bacteria.
    cx.globalCompositeOperation = 'source-atop';
    for (const tint of tints) {
      const color =
        tint.mode === 'toxin' ? SICKLY : tint.mode === 'cryo' ? FROZEN : null;
      if (color === null) {
        continue;
      }
      const alpha = 0.6 * tint.strength;
      fillGradientCircle(cx, tint.x, tint.y, tint.radius, [
        [0, color, alpha],
        [0.85, color, alpha],
        [1, color, 0],
      ]);
    }
    cx.restore();
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
    const layer = paintZoneLayer(
      this.width,
      this.height,
      zones,
      this.scale,
      this.unit
    );
    return layer === null
      ? null
      : imageCanvas(layer.data, layer.width, layer.height);
  }
}

/** What the toxin turns bacteria, and the ice. */
const SICKLY: Rgb = [150, 190, 40];
const FROZEN: Rgb = [205, 235, 255];

/** One of the weapons' marks with the Canvas 2D API. */
function drawMark(cx: CanvasRenderingContext2D, mark: WeaponMark): void {
  const { x, y, radius, size, angle, color, alpha } = mark;
  if (alpha <= 0 || radius <= 0) {
    return;
  }
  switch (mark.kind) {
    case 'glow':
      if (radius < 2.5) {
        // Too small for the gradient to show - a plain dot is cheaper.
        cx.fillStyle = rgba(color, alpha * 0.55);
        cx.beginPath();
        cx.arc(x, y, radius, 0, Math.PI * 2);
        cx.fill();
      } else {
        // The falloff of the WebGL glow, (1 - r²)².
        fillGradientCircle(cx, x, y, radius, [
          [0, color, alpha],
          [0.5, color, alpha * 0.56],
          [0.75, color, alpha * 0.19],
          [1, color, 0],
        ]);
      }
      break;
    case 'ring':
      cx.strokeStyle = rgba(color, alpha);
      cx.lineWidth = size;
      cx.beginPath();
      cx.arc(x, y, radius, 0, Math.PI * 2);
      cx.stroke();
      break;
    case 'hex':
      cx.beginPath();
      for (let corner = 0; corner < 6; corner++) {
        const turn = angle + (corner * Math.PI) / 3;
        const cornerX = x + Math.cos(turn) * radius;
        const cornerY = y + Math.sin(turn) * radius;
        if (corner === 0) {
          cx.moveTo(cornerX, cornerY);
        } else {
          cx.lineTo(cornerX, cornerY);
        }
      }
      cx.closePath();
      if (size > 0) {
        cx.strokeStyle = rgba(color, alpha);
        cx.lineWidth = size;
        cx.stroke();
      } else {
        cx.fillStyle = rgba(color, alpha);
        cx.fill();
      }
      break;
    case 'ellipse': {
      const { color2 } = mark;
      if (sameRgb(color, color2)) {
        cx.fillStyle = rgba(color, alpha);
      } else {
        // From its base to its tip, along the way it is turned.
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius;
        const gradient = cx.createLinearGradient(
          x - dx,
          y - dy,
          x + dx,
          y + dy
        );
        gradient.addColorStop(0, rgba(color, alpha));
        gradient.addColorStop(1, rgba(color2, alpha));
        cx.fillStyle = gradient;
      }
      cx.beginPath();
      cx.ellipse(x, y, radius, Math.max(0.01, size), angle, 0, Math.PI * 2);
      cx.fill();
      break;
    }
    case 'field':
      drawField(cx, mark);
      break;
  }
}

/**
 * A weapon's effect over its circle: the gradients and lines that stand in
 * for the WebGL painter's patterns.
 */
function drawField(cx: CanvasRenderingContext2D, mark: WeaponMark): void {
  const { x, y, radius, color, color2, alpha, growth, timeSec } = mark;
  const seed = Math.round(x * 13 + y * 7);
  switch (mark.weapon) {
    case 'toxin-bomb': {
      fillGradientCircle(cx, x, y, radius, [
        [0, color, 0.55 * alpha],
        [0.6, color, 0.4 * alpha],
        [0.85, color2, 0.3 * alpha],
        [1, color2, 0],
      ]);
      break;
    }
    case 'cryo-pulse': {
      const reach = radius * growth;
      fillGradientCircle(cx, x, y, reach, [
        [0, color2, 0.15 * alpha],
        [0.7, color, 0.3 * alpha],
        [0.92, color2, 0.55 * alpha],
        [1, color2, 0],
      ]);
      // Cracks running out from the centre.
      cx.strokeStyle = rgba(color2, 0.5 * alpha);
      cx.lineWidth = Math.max(0.3, radius * 0.025);
      cx.beginPath();
      for (let i = 0; i < 7; i++) {
        let turn = hash(i, seed, 3) * Math.PI * 2;
        let px = x;
        let py = y;
        cx.moveTo(px, py);
        for (let step = 0; step < 3; step++) {
          turn += (hash(i, step, seed) - 0.5) * 0.6;
          px += (Math.cos(turn) * reach) / 3.2;
          py += (Math.sin(turn) * reach) / 3.2;
          cx.lineTo(px, py);
        }
      }
      cx.stroke();
      break;
    }
    case 'phage-strike': {
      const front = clamp(growth, 0.05, 0.9);
      fillGradientCircle(cx, x, y, radius, [
        [0, color, (1 - growth) * alpha],
        [front - 0.05, color2, 0.15 * alpha],
        [front, color, 0.8 * alpha],
        [front + 0.1, color2, 0],
        [1, color2, 0],
      ]);
      break;
    }
    case 'agar-bloom': {
      const reach = radius * growth;
      if (reach <= 0) {
        break;
      }
      const sway = Math.sin(timeSec * 0.7) * 0.3;
      cx.beginPath();
      for (let step = 0; step <= 72; step++) {
        const turn = (step / 72) * Math.PI * 2;
        const lobes = Math.abs(Math.cos(turn * 4 + sway));
        const r = reach * (0.55 + 0.45 * Math.pow(lobes, 0.6));
        const px = x + Math.cos(turn) * r;
        const py = y + Math.sin(turn) * r;
        if (step === 0) {
          cx.moveTo(px, py);
        } else {
          cx.lineTo(px, py);
        }
      }
      const gradient = cx.createRadialGradient(x, y, 0, x, y, reach);
      gradient.addColorStop(0, rgba(color2, 0.6 * alpha));
      gradient.addColorStop(0.7, rgba(color, 0.45 * alpha));
      gradient.addColorStop(1, rgba(color, 0.25 * alpha));
      cx.fillStyle = gradient;
      cx.fill();
      break;
    }
    case 'biofilm-shield': {
      const reach = radius * Math.max(0.05, growth);
      cx.save();
      cx.beginPath();
      cx.arc(x, y, reach, 0, Math.PI * 2);
      cx.clip();
      fillGradientCircle(cx, x, y, reach, [
        [0, color, 0.08 * alpha],
        [0.8, color, 0.18 * alpha],
        [1, color2, 0.45 * alpha],
      ]);
      // The membrane: a honeycomb, pulsing.
      const width = radius / 5.5;
      const corner = width / Math.sqrt(3);
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 4);
      cx.strokeStyle = rgba(color2, (0.3 + 0.3 * pulse) * alpha);
      cx.lineWidth = Math.max(0.3, radius * 0.02);
      cx.beginPath();
      // Only the cells that reach into the clipped circle, at most seven
      // out from the centre each way.
      const rowStep = corner * 1.5;
      const rows = Math.min(7, Math.ceil((reach + corner) / rowStep));
      for (let row = -rows; row <= rows; row++) {
        const cy = y + row * rowStep;
        const shift = (row & 1) * 0.5 * width;
        const nearest = Math.max(0, Math.abs(row * rowStep) - corner);
        const half =
          Math.sqrt(Math.max(0, reach * reach - nearest * nearest)) + corner;
        const first = Math.max(-7, Math.floor((-half - shift) / width));
        const last = Math.min(7, Math.ceil((half - shift) / width));
        for (let column = first; column <= last; column++) {
          const cellX = x + column * width + shift;
          for (let k = 0; k <= 6; k++) {
            const turn = Math.PI / 6 + (k * Math.PI) / 3;
            const px = cellX + Math.cos(turn) * corner;
            const py = cy + Math.sin(turn) * corner;
            if (k === 0) {
              cx.moveTo(px, py);
            } else {
              cx.lineTo(px, py);
            }
          }
        }
      }
      cx.stroke();
      cx.restore();
      break;
    }
  }
}

/** A circle filled with a radial gradient: stops of offset, colour and alpha. */
function fillGradientCircle(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stops: readonly [number, Rgb, number][]
): void {
  if (radius <= 0) {
    return;
  }
  const gradient = cx.createRadialGradient(x, y, 0, x, y, radius);
  let last = 0;
  for (const [offset, color, alpha] of stops) {
    // Offsets have to climb, and stay within the circle.
    last = clamp(Math.max(offset, last), 0, 1);
    gradient.addColorStop(last, rgba(color, clamp(alpha, 0, 1)));
  }
  cx.fillStyle = gradient;
  cx.beginPath();
  cx.arc(x, y, radius, 0, Math.PI * 2);
  cx.fill();
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

/**
 * The round walls among these, pass by pass - see {@link blobLayer} - on
 * the arena or on a level preview. With `shadowOnce` only the first pass
 * casts the shadow the context is set up with.
 */
export function drawWallBlobs(
  cx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  walls: readonly Rect[],
  rim: Rgb,
  theme: ArenaTheme,
  shadowOnce = false
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
    if (shadowOnce) {
      cx.shadowColor = 'transparent';
    }
  }
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

/** RGBA pixels in an offscreen canvas, or null where there is no canvas. */
function imageCanvas(
  data: Uint8ClampedArray,
  width: number,
  height: number
): HTMLCanvasElement | null {
  const canvas = createCanvas(width, height);
  return canvas != null &&
    putPixels(canvas.getContext?.('2d'), data, width, height)
    ? canvas
    : null;
}
