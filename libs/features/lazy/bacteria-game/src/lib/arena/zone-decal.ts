import { scaleOf } from '../state/arena-size';
import { stampZones, Zone, ZONE_CODE, ZoneKind } from '../state/zones';
import { Rgb } from './arena-theme';
import { ZONE_COLORS } from './zone-look';

/** How opaque a zone is inside, and along its rim. */
const FILL = 0.24;
const RIM = 0.8;

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

const KIND_OF_CODE: readonly (ZoneKind | undefined)[] = (() => {
  const kinds: (ZoneKind | undefined)[] = [];
  for (const [kind, code] of Object.entries(ZONE_CODE)) {
    kinds[code] = kind as ZoneKind;
  }
  return kinds;
})();

/** The zones as an image of their own, laid over the floor. */
export interface ZoneLayer {
  /** Straight alpha RGBA, `scale` pixels per arena cell along each side. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
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
  scale: number
): ZoneLayer | null {
  if (zones.length === 0) {
    return null;
  }
  const s = Math.max(1, Math.round(scale));
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
      const edge =
        cellAt(cx - 1, cy) !== code ||
        cellAt(cx + 1, cy) !== code ||
        cellAt(cx, cy - 1) !== code ||
        cellAt(cx, cy + 1) !== code;
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
      const kind = KIND_OF_CODE[code];
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

  const unit = Math.max(1, Math.round(scaleOf(width)));
  const spacing = MARK_SPACING * unit;
  for (let gy = 0; gy * spacing < height; gy++) {
    for (let gx = 0; gx * spacing < width; gx++) {
      // A jitter per spot, from its place alone.
      const jitter = hash(gx, gy);
      const x = Math.round(
        (gx + 0.25 + (0.5 * (jitter & 0xff)) / 255) * spacing * s
      );
      const y = Math.round(
        (gy + 0.25 + (0.5 * ((jitter >>> 8) & 0xff)) / 255) * spacing * s
      );
      const code = codeAt(x, y);
      const kind = KIND_OF_CODE[code];
      const sprites = kind === undefined ? undefined : MARKS[kind];
      if (sprites === undefined) {
        continue;
      }
      const sprite = sprites[(jitter >>> 16) % sprites.length];
      stamp(data, layerW, codeAt, code, x, y, sprite, unit * s);
    }
  }
  return { data: soften(data, layerW, layerH), width: layerW, height: layerH };
}

/** The code of the zone over a point of the arena - the last one wins. */
function zoneCodeAt(zones: readonly Zone[], x: number, y: number): number {
  for (let i = zones.length - 1; i >= 0; i--) {
    const zone = zones[i];
    if (
      x < zone.x ||
      y < zone.y ||
      x >= zone.x + zone.width ||
      y >= zone.y + zone.height
    ) {
      continue;
    }
    if (zone.round) {
      const dx = (x - zone.x - zone.width / 2) / (zone.width / 2);
      const dy = (y - zone.y - zone.height / 2) / (zone.height / 2);
      if (dx * dx + dy * dy > 1) {
        continue;
      }
    }
    return ZONE_CODE[zone.kind];
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
  const kind = KIND_OF_CODE[code] as ZoneKind;
  const light = lighter(ZONE_COLORS[kind]);
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
  const blurred = blur(
    blur(premultiplied, width, height, 1, 0),
    width,
    height,
    0,
    1
  );
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = blurred[i + 3];
    if (a <= 0) {
      continue;
    }
    const k = 255 / a;
    out[i] = blurred[i] * k;
    out[i + 1] = blurred[i + 1] * k;
    out[i + 2] = blurred[i + 2] * k;
    out[i + 3] = a;
  }
  return out;
}

/** A [1 2 1] blur along one axis. */
function blur(
  data: Float32Array,
  width: number,
  height: number,
  dx: number,
  dy: number
): Float32Array {
  const out = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const ax = Math.max(0, x - dx);
      const ay = Math.max(0, y - dy);
      const bx = Math.min(width - 1, x + dx);
      const by = Math.min(height - 1, y + dy);
      const a = (ay * width + ax) * 4;
      const b = (by * width + bx) * 4;
      for (let c = 0; c < 4; c++) {
        out[i + c] = (data[a + c] + 2 * data[i + c] + data[b + c]) / 4;
      }
    }
  }
  return out;
}

function lighter([r, g, b]: Rgb): Rgb {
  return [r + (255 - r) * 0.5, g + (255 - g) * 0.5, b + (255 - b) * 0.5];
}

/** A well mixed 32 bit number for a spot of the grid. */
function hash(x: number, y: number): number {
  let h = Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}
