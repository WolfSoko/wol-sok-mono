import { DynamicWall, Rect } from '../../state/maps';
import { boostRingRadius, crosshairBars, CursorShape } from '../arena-painter';
import {
  BLOB_ALPHA,
  blobColor,
  blobLayer,
  BLOB_LAYERS,
  gateBlink,
  HAZARD_TILE,
  openGateFill,
  openGateOutline,
} from '../arena-renderer';
import { ArenaTheme, Rgb } from '../arena-theme';
import { darker, JamDrop } from '../colony-renderer';
import { Motes } from '../motes';
import { WEAPON_CODE } from '../../state/weapon-effects';
import { MarkLayer } from '../weapon-fx';

/**
 * What the shape shader draws for one instance. Every shape is a rect in
 * arena cells; the kind decides what the fragment shader fills it with.
 */
export const SHAPE = {
  /** The rect, filled with the first colour. */
  rect: 0,
  /** Diagonal stripes: the first colour, crossed by the second. */
  hazard: 1,
  /** A one cell wide outline along the inside of the rect. */
  outline: 2,
  /** A circle centred in the rect - `p0` is its radius, `p1` the line width. */
  ring: 3,
  /** A filled ellipse inscribed in the rect, turned by `p0` radians. */
  disc: 4,
  /** A drop of jam: a glossy gradient from the second colour to the first. */
  jam: 5,
  /** A soft glow filling the circle in the rect, gone at its rim. */
  glow: 6,
  /**
   * A hexagon centred in the rect, its corners `p2` out, turned by `p0` -
   * an outline `p1` wide, or filled for 0.
   */
  hex: 7,
  /**
   * A weapon's effect over the circle in the rect: `p0` the weapon (see
   * `WEAPON_CODE`, as the simulation's shaders know it), `p1` its clock, `p2` how far it has spread.
   */
  field: 8,
  /**
   * An ellipse centred in the rect, turned by `p0`, its radii `p1` and
   * `p2` - from the first colour at its base to the second at its tip.
   */
  ellipse: 9,
} as const;

export type ShapeKind = (typeof SHAPE)[keyof typeof SHAPE];

/** Floats per instance: rect, colour, second colour, kind and parameters. */
export const SHAPE_STRIDE = 16;

/**
 * The shapes of one draw call, packed for the GPU: one instance per shape,
 * {@link SHAPE_STRIDE} floats each. The buffer grows as needed and is reused
 * between frames, so a frame allocates nothing.
 */
export class ShapeBatch {
  private data = new Float32Array(SHAPE_STRIDE * 256);
  public count = 0;

  public clear(): void {
    this.count = 0;
  }

  /** The packed instances, a view on the internal buffer. */
  public get instances(): Float32Array {
    return this.data.subarray(0, this.count * SHAPE_STRIDE);
  }

  public push(
    kind: ShapeKind,
    rect: Rect,
    color: Rgb,
    alpha = 1,
    color2: Rgb = color,
    alpha2 = alpha,
    p0 = 0,
    p1 = 0,
    p2 = 0
  ): void {
    if ((this.count + 1) * SHAPE_STRIDE > this.data.length) {
      const grown = new Float32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    const d = this.data;
    let i = this.count * SHAPE_STRIDE;
    d[i++] = rect.x;
    d[i++] = rect.y;
    d[i++] = rect.width;
    d[i++] = rect.height;
    d[i++] = color[0] / 255;
    d[i++] = color[1] / 255;
    d[i++] = color[2] / 255;
    d[i++] = alpha;
    d[i++] = color2[0] / 255;
    d[i++] = color2[1] / 255;
    d[i++] = color2[2] / 255;
    d[i++] = alpha2;
    d[i++] = kind;
    d[i++] = p0;
    d[i++] = p1;
    d[i] = p2;
    this.count++;
  }
}

/**
 * Everything drawn between the floor and the colonies: the drifting specks,
 * the walls with their lit edge, and the gates and sliding walls - striped
 * when closed, a blinking outline while open.
 */
export function pushBackground(
  batch: ShapeBatch,
  theme: ArenaTheme,
  motes: Motes,
  walls: readonly Rect[],
  dynamicWalls: readonly DynamicWall[]
): void {
  motes.forEach((x, y, alpha) =>
    batch.push(SHAPE.rect, { x, y, width: 1, height: 1 }, theme.motes, alpha)
  );
  pushBlobs(batch, walls, darker(theme.wall), theme);
  for (const wall of walls) {
    if (wall.round) {
      continue;
    }
    batch.push(SHAPE.rect, wall, theme.wall);
    batch.push(
      SHAPE.rect,
      { x: wall.x, y: wall.y, width: wall.width, height: 1 },
      theme.wallEdge
    );
    batch.push(
      SHAPE.rect,
      { x: wall.x, y: wall.y, width: 1, height: wall.height },
      theme.wallEdge
    );
  }
  // Living tissue rather than machinery: rimmed in the frame colour.
  pushBlobs(batch, dynamicWalls, theme.border, theme);
  for (const wall of dynamicWalls) {
    if (wall.round) {
      continue;
    }
    if (wall.solid) {
      batch.push(
        SHAPE.hazard,
        wall,
        theme.border,
        1,
        theme.rim,
        0.75,
        HAZARD_TILE
      );
      continue;
    }
    const blink = gateBlink(wall.warning, motes.timeSec);
    batch.push(
      SHAPE.rect,
      wall,
      theme.border,
      openGateFill(wall.warning, blink)
    );
    batch.push(SHAPE.outline, wall, theme.border, openGateOutline(blink));
  }
}

/** Scratch for one blob's ellipse - `push` copies it straight away. */
const blobShape: Rect = { x: 0, y: 0, width: 0, height: 0 };

/** The round walls among these, pass by pass - see `blobLayer`. */
function pushBlobs(
  batch: ShapeBatch,
  walls: readonly Rect[],
  rim: Rgb,
  theme: ArenaTheme
): void {
  for (let layer = 0; layer < BLOB_LAYERS; layer++) {
    const color = blobColor(layer, rim, theme);
    for (const wall of walls) {
      if (wall.round) {
        batch.push(
          SHAPE.disc,
          blobLayer(layer, wall, blobShape),
          color,
          BLOB_ALPHA[layer]
        );
      }
    }
  }
}

/**
 * Everything drawn over the colonies: the drops of jam - a halo, a shadow,
 * the glossy drop and its highlight - and the crosshairs with their boost
 * rings.
 */
export function pushForeground(
  batch: ShapeBatch,
  drops: readonly JamDrop[],
  cursors: readonly CursorShape[],
  /** Cells per base cell - the jam and the crosshairs are as big on every grid. */
  unit: number
): void {
  for (const { jam, x, y, radius, halo } of drops) {
    const haloRadius = radius + (1.5 + halo) * unit;
    batch.push(
      SHAPE.disc,
      square(x, y, haloRadius),
      jam.light,
      0.12 + 0.12 * halo
    );
    batch.push(
      SHAPE.disc,
      ellipse(x + 0.4, y + 0.6, radius, radius * 0.8),
      [0, 0, 0],
      0.35
    );
    // Squashed a little, like a drop sitting on the agar.
    batch.push(
      SHAPE.jam,
      ellipse(x, y, radius, radius * 0.88),
      jam.body,
      1,
      jam.light,
      1,
      darkerPacked(jam.body)
    );
    batch.push(
      SHAPE.disc,
      ellipse(
        x - radius * 0.38,
        y - radius * 0.4,
        radius * 0.28,
        radius * 0.18
      ),
      [255, 255, 255],
      0.8,
      [255, 255, 255],
      0.8,
      -0.6
    );
  }

  for (const cursor of cursors) {
    const color: Rgb = [cursor.color[0], cursor.color[1], cursor.color[2]];
    const alpha = (cursor.color[3] ?? 255) / 255;
    for (const bar of crosshairBars(cursor, unit)) {
      batch.push(SHAPE.rect, bar, color, alpha);
    }
    if (cursor.boostLeft != null) {
      const radius = boostRingRadius(cursor.boostLeft) * unit;
      // Room for the line around the circle.
      batch.push(
        SHAPE.ring,
        square(cursor.x, cursor.y, radius + unit),
        color,
        alpha,
        color,
        alpha,
        radius,
        1.5 * unit
      );
    }
  }
}

/**
 * A layer of the weapons' effects - see `WeaponFx` - one instance per
 * mark.
 */
export function pushWeaponMarks(batch: ShapeBatch, layer: MarkLayer): void {
  for (let i = 0; i < layer.count; i++) {
    const mark = layer.at(i);
    const { x, y, radius, size, angle, color, color2, alpha } = mark;
    switch (mark.kind) {
      case 'glow':
        batch.push(SHAPE.glow, square(x, y, radius), color, alpha);
        break;
      case 'ring':
        batch.push(
          SHAPE.ring,
          square(x, y, radius + size),
          color,
          alpha,
          color,
          alpha,
          radius,
          size
        );
        break;
      case 'hex':
        batch.push(
          SHAPE.hex,
          square(x, y, radius + size),
          color,
          alpha,
          color,
          alpha,
          angle,
          size,
          radius
        );
        break;
      case 'ellipse':
        batch.push(
          SHAPE.ellipse,
          square(x, y, Math.max(radius, size)),
          color,
          alpha,
          color2,
          alpha,
          angle,
          radius,
          size
        );
        break;
      case 'field':
        batch.push(
          SHAPE.field,
          square(x, y, radius),
          color,
          alpha,
          color2,
          alpha,
          WEAPON_CODE[mark.weapon],
          mark.timeSec,
          mark.growth
        );
        break;
    }
  }
}

/** Scratch for a shape's box - `push` copies it straight away. */
const box: Rect = { x: 0, y: 0, width: 0, height: 0 };

/** A square centred on a point, in {@link box}. */
function square(x: number, y: number, half: number): Rect {
  return ellipse(x, y, half, half);
}

/** The box around an ellipse, in {@link box}. */
function ellipse(x: number, y: number, rx: number, ry: number): Rect {
  box.x = x - rx;
  box.y = y - ry;
  box.width = rx * 2;
  box.height = ry * 2;
  return box;
}

/**
 * The darkest colour of a jam drop's gradient, packed into one float - the
 * instance has room for two colours only, so the third rides in `p0`.
 */
function darkerPacked(body: Rgb): number {
  const [r, g, b] = darker(body).map((channel) => Math.round(channel));
  return r * 65536 + g * 256 + b;
}
