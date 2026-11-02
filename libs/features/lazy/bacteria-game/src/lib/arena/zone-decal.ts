import {
  kindOfCode,
  stampZones,
  Zone,
  ZONE_CODE,
  ZoneKind,
} from '../state/zones';
import { coversPoint } from '../state/maps';
import { hash, mix } from './canvas-math';
import { Rgb } from './arena-theme';
import { ZONE_COLORS } from './zone-look';

/** How opaque a zone is inside, and along its rim. */
const FILL = 0.24;
const RIM = 0.8;

/** The finest the zone layer is painted, in pixels per arena cell. */
const MAX_LAYER_SCALE = 4;

/** Base cells between two marks scattered over a zone. */
const MARK_SPACING = 13;

/**
 * A mark as rows of pixels: a letter per pixel, `.` for none - the letters
 * pick the colours in {@link MARK_COLORS}.
 */
type Sprite = readonly string[];

/**
 * What each kind of zone is strewn with, so it reads at a glance: pills on
 * antibiotic - medicine, harmful - bubbles of food on agar, crystals on
 * ice, flames on heat, and little flags on the zone to hold.
 */
const MARKS: Readonly<Partial<Record<ZoneKind, readonly Sprite[]>>> = {
  antibiotic: [
    ['.rrww.', 'rrrwww', '.rrww.'],
    ['.r.', 'rrr', 'rrr', 'www', 'www', '.w.'],
  ],
  agar: [['.lll.', 'l...l', 'l.h.l', 'l...l', '.lll.']],
  ice: [['l.l.l', '.lll.', 'lllll', '.lll.', 'l.l.l']],
  heat: [['..y..', '.yy..', '.yoy.', 'ooyoo', '.ooo.']],
  hill: [['wwww', 'www.', 'ww..', 'w...', 'w...']],
};

/** The colour of each letter of a mark; `l` is the zone's colour, lighter. */
const MARK_COLORS: Readonly<Record<string, Rgb>> = {
  r: [235, 60, 75],
  w: [245, 245, 250],
  h: [255, 255, 255],
  y: [255, 230, 120],
  o: [255, 120, 40],
};

/** The zones as an image of their own, laid over the floor. */
export interface ZoneLayer {
  /** Straight alpha RGBA, `scale` pixels per arena cell along each side. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Whole pixels per cell for a layer of what never moves (the zones, the
 * walls) - finer than {@link MAX_LAYER_SCALE} adds nothing a softened edge
 * would show, and costs.
 */
export function layerScale(scale: number): number {
  return Math.min(MAX_LAYER_SCALE, Math.max(1, Math.round(scale)));
}

/**
 * Paints the zones as a layer over the floor, `scale` pixels per arena cell
 * - finer than the cells, so the edges come out smooth: each zone tinted in
 * its colour with a bright rim along its edge, organic as the blobs it is
 * made of, and strewn with its mark. The edge is worked out at that finer
 * scale, then softened by a pixel, which antialiases it. Pure and seeded by
 * position, so the same zones always look the same. Null without zones.
 */
export function paintZoneLayer(
  width: number,
  height: number,
  zones: readonly Zone[],
  scale: number,
  /** Cells per base cell - the marks are as big on every grid. */
  unit: number
): ZoneLayer | null {
  if (zones.length === 0) {
    return null;
  }
  const s = layerScale(scale);
  const cells = new Uint8Array(width * height);
  stampZones(cells, width, height, zones);
  const cellAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : cells[y * width + x];

  // The zone under each fine pixel: the cell's, inside a zone - worked out
  // anew only along an edge, where a cell's neighbours differ.
  const layerW = width * s;
  const layerH = height * s;
  const codes = new Uint8Array(layerW * layerH);
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const code = cells[cy * width + cx];
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1 && !edge; dx++) {
          edge = cellAt(cx + dx, cy + dy) !== code;
        }
      }
      for (let sy = 0; sy < s; sy++) {
        for (let sx = 0; sx < s; sx++) {
          const x = cx * s + sx;
          const y = cy * s + sy;
          codes[y * layerW + x] = edge
            ? zoneCodeAt(zones, (x + 0.5) / s, (y + 0.5) / s)
            : code;
        }
      }
    }
  }
  const codeAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= layerW || y >= layerH ? 0 : codes[y * layerW + x];

  const data = new Uint8ClampedArray(layerW * layerH * 4);
  const rim = Math.max(1, Math.round(s * 0.75));
  for (let y = 0; y < layerH; y++) {
    for (let x = 0; x < layerW; x++) {
      const code = codes[y * layerW + x];
      const kind = kindOfCode(code);
      if (kind === undefined) {
        continue;
      }
      const onRim =
        codeAt(x - rim, y) !== code ||
        codeAt(x + rim, y) !== code ||
        codeAt(x, y - rim) !== code ||
        codeAt(x, y + rim) !== code;
      put(data, (y * layerW + x) * 4, ZONE_COLORS[kind], onRim ? RIM : FILL);
    }
  }

  // As big and as far apart on every grid: in base cells, not grid cells.
  const spacing = MARK_SPACING * unit;
  const markPixel = Math.max(1, Math.round(unit * s));
  for (let gy = 0; gy * spacing < height; gy++) {
    for (let gx = 0; gx * spacing < width; gx++) {
      // A jitter per spot, from its place alone.
      const x = Math.round((gx + 0.25 + 0.5 * hash(gx, gy, 1)) * spacing * s);
      const y = Math.round((gy + 0.25 + 0.5 * hash(gx, gy, 2)) * spacing * s);
      const code = codeAt(x, y);
      const kind = kindOfCode(code);
      const sprites = kind === undefined ? undefined : MARKS[kind];
      if (sprites === undefined) {
        continue;
      }
      const sprite = sprites[Math.floor(hash(gx, gy, 3) * sprites.length)];
      stamp(data, layerW, codeAt, code, x, y, sprite, markPixel);
    }
  }
  return { data: soften(data, layerW, layerH), width: layerW, height: layerH };
}

/** The code of the zone over a point of the arena - the last one wins. */
function zoneCodeAt(zones: readonly Zone[], x: number, y: number): number {
  for (let i = zones.length - 1; i >= 0; i--) {
    if (coversPoint(zones[i], x, y)) {
      return ZONE_CODE[zones[i].kind];
    }
  }
  return 0;
}

/**
 * Puts a mark centred on a spot - only where all of it, and a pixel round
 * it, lies inside the same zone, so no mark hangs over a rim.
 */
function stamp(
  data: Uint8ClampedArray,
  width: number,
  codeAt: (x: number, y: number) => number,
  code: number,
  centreX: number,
  centreY: number,
  sprite: Sprite,
  pixel: number
): void {
  const spriteW = sprite[0].length * pixel;
  const spriteH = sprite.length * pixel;
  const left = centreX - Math.floor(spriteW / 2);
  const top = centreY - Math.floor(spriteH / 2);
  const margin = pixel;
  for (let y = top - margin; y < top + spriteH + margin; y += margin) {
    for (let x = left - margin; x < left + spriteW + margin; x += margin) {
      if (codeAt(x, y) !== code) {
        return;
      }
    }
  }
  const kind = kindOfCode(code) as ZoneKind;
  const light = mix(ZONE_COLORS[kind], [255, 255, 255], 0.5);
  for (let y = 0; y < spriteH; y++) {
    const row = sprite[Math.floor(y / pixel)];
    for (let x = 0; x < spriteW; x++) {
      const letter = row[Math.floor(x / pixel)];
      if (letter === '.') {
        continue;
      }
      const color = letter === 'l' ? light : MARK_COLORS[letter];
      put(data, ((top + y) * width + left + x) * 4, color, 0.95);
    }
  }
}

function put(
  data: Uint8ClampedArray,
  index: number,
  color: Rgb,
  alpha: number
): void {
  data[index] = color[0];
  data[index + 1] = color[1];
  data[index + 2] = color[2];
  data[index + 3] = alpha * 255;
}

/**
 * The layer blurred by a pixel - premultiplied, so a colour never bleeds
 * from an empty pixel - which smooths every edge.
 */
function soften(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const premultiplied = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    premultiplied[i] = data[i] * a;
    premultiplied[i + 1] = data[i + 1] * a;
    premultiplied[i + 2] = data[i + 2] * a;
    premultiplied[i + 3] = data[i + 3];
  }
  // Across, into a scratch buffer, then down, back into the first one.
  const scratch = new Float32Array(data.length);
  blur(premultiplied, scratch, width, height, 1, 0);
  blur(scratch, premultiplied, width, height, 0, 1);
  for (let i = 0; i < data.length; i += 4) {
    const a = premultiplied[i + 3];
    const k = a > 0 ? 255 / a : 0;
    data[i] = premultiplied[i] * k;
    data[i + 1] = premultiplied[i + 1] * k;
    data[i + 2] = premultiplied[i + 2] * k;
    data[i + 3] = a;
  }
  return data;
}

/** A [1 2 1] blur along one axis, from `source` into `target`. */
function blur(
  source: Float32Array,
  target: Float32Array,
  width: number,
  height: number,
  dx: number,
  dy: number
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = (Math.max(0, y - dy) * width + Math.max(0, x - dx)) * 4;
      const b =
        (Math.min(height - 1, y + dy) * width + Math.min(width - 1, x + dx)) *
        4;
      for (let c = 0; c < 4; c++) {
        target[i + c] = (source[a + c] + 2 * source[i + c] + source[b + c]) / 4;
      }
    }
  }
}
