/**
 * The loading wave as pure math, shared by the 2D canvas renderer and
 * mirrored by the WebGL shaders' header (`webgl/shader-program.ts`).
 *
 * The wave front is a circle. From the `'left'` origin its centre lies left
 * of the element, at mid-height: a ripple from off-screen whose arc crosses
 * the element, and how round it is (`frontRoundness`) sets the circle's
 * radius. From the `'center'` origin it grows from the element's middle: a
 * ripple from a stone dropped there. Its radius grows at an even speed, so
 * the front sweeps across until the lit tail behind it has left the element
 * at every row, then starts again.
 * Every length is in CSS pixels, every time in milliseconds.
 */

/**
 * How round the front is by default: its ends lag its middle by half of
 * `min(height / 2, width)`.
 */
export const DEFAULT_FRONT_ROUNDNESS = 0.5;
/**
 * The largest radius of the front's circle, times the element's larger
 * side: a straight front (`frontRoundness` 0) gets this one, which keeps the
 * shader's floats exact.
 */
const MAX_RADIUS_SIDES = 50;
/** distance behind the front over which a dot dims to 1/e, in dot spacings */
const FALLOFF_SPACINGS = 1.5;
/** how lit a dot stays once the front passed it, as in the video */
export const AFTERGLOW = 0.45;
/** share of a sweep after which a passed dot's afterglow starts to fade */
export const AFTERGLOW_FADE_START = 0.45;
/** distance ahead of the front over which a dot lights up, in dot spacings */
const RISE_SPACINGS = 0.25;
/** length of the bright tail behind the front, in dot spacings */
const TAIL_SPACINGS = 4;
/**
 * The most dots a grid holds: a tiny spacing on a large host is widened
 * rather than creating millions of dots each frame.
 */
export const MAX_DOTS = 20_000;
/** the farthest a lit dot is pushed along the wave, in dot spacings */
const MAX_PUSH_SPACINGS = 0.15;
/**
 * How many dots `autoscale: true` keeps across the host's shorter side: a
 * smaller host gets a finer grid rather than a row or two of dots.
 */
export const MIN_DOTS_ACROSS = 6;
/**
 * The smallest dot `autoscale` shrinks to, in CSS pixels: smaller, a dot
 * would vanish between the device pixels.
 */
export const MIN_DOT_SIZE = 1;

/**
 * How the dot grid follows the host's size: `true` makes it finer where the
 * host's shorter side holds fewer than `MIN_DOTS_ACROSS` dots, a number
 * scales spacing and dot size by that factor, `false` keeps them as asked.
 */
export type Autoscale = boolean | number;

/**
 * Where the wave comes from: `'left'` sweeps it across from the left edge,
 * `'center'` lets it grow from the element's middle.
 */
export type WaveOrigin = 'left' | 'center';

export interface WaveGeometry {
  readonly width: number;
  readonly height: number;
  readonly dotSpacing: number;
  /** diameter of a dot at rest, scaled with the spacing */
  readonly dotSize: number;
  readonly sweepMs: number;
  readonly centerX: number;
  readonly centerY: number;
  /** the front's radius at the start of a sweep: it touches the left edge */
  readonly startRadius: number;
  /** the front's radius at the end of a sweep: the tail left every row */
  readonly endRadius: number;
  /** how far the front's radius grows in one sweep */
  readonly travel: number;
  /** distance behind the front over which a dot dims to 1/e */
  readonly falloff: number;
  /** distance ahead of the front over which a dot lights up */
  readonly rise: number;
  /** length of the lit tail behind the front */
  readonly tail: number;
  /** the farthest a lit dot is pushed along the wave */
  readonly maxPush: number;
}

export interface WaveGeometryOptions {
  readonly dotSpacing: number;
  /** diameter of a dot at rest, in CSS pixels */
  readonly dotSize: number;
  readonly sweepMs: number;
  /** how the grid follows the host's size; unset, it keeps the asked one */
  readonly autoscale?: Autoscale;
  /** where the wave comes from; `'left'` when unset */
  readonly origin?: WaveOrigin;
  /**
   * 0 (a straight front) to 1: how far the front's ends lag its middle, as a
   * share of `min(height / 2, width)`; `DEFAULT_FRONT_ROUNDNESS` when unset.
   * Only the `'left'` origin has it.
   */
  readonly frontRoundness?: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Displacement {
  readonly dx: number;
  readonly dy: number;
}

export function waveGeometry(
  width: number,
  height: number,
  {
    dotSpacing: askedSpacing,
    dotSize: askedSize,
    sweepMs,
    autoscale = false,
    origin = 'left',
    frontRoundness = DEFAULT_FRONT_ROUNDNESS,
  }: WaveGeometryOptions
): WaveGeometry {
  const grid = scaledGrid(width, height, askedSpacing, askedSize, autoscale);
  const dotSpacing = spacingWithinDotLimit(width, height, grid.dotSpacing);
  const tail = TAIL_SPACINGS * dotSpacing;
  const circle =
    origin === 'center'
      ? centredCircle(width, height, tail)
      : circleFromLeft(width, height, dotSpacing, frontRoundness, tail);
  return {
    width,
    height,
    dotSpacing,
    dotSize: grid.dotSize,
    sweepMs,
    ...circle,
    travel: circle.endRadius - circle.startRadius,
    falloff: FALLOFF_SPACINGS * dotSpacing,
    rise: RISE_SPACINGS * dotSpacing,
    tail,
    maxPush: MAX_PUSH_SPACINGS * dotSpacing,
  };
}

type FrontCircle = Pick<
  WaveGeometry,
  'centerX' | 'centerY' | 'startRadius' | 'endRadius'
>;

/**
 * The circle left of the element: its arc touches the left edge at
 * mid-height at the start, and the tail left every row at the end.
 */
function circleFromLeft(
  width: number,
  height: number,
  dotSpacing: number,
  frontRoundness: number,
  tail: number
): FrontCircle {
  const distance = frontCircleRadius(width, height, dotSpacing, frontRoundness);
  return {
    centerX: -distance,
    centerY: height / 2,
    startRadius: distance,
    endRadius: Math.hypot(distance + width + tail, height / 2),
  };
}

/** the circle at the element's middle, until the tail left every corner */
function centredCircle(
  width: number,
  height: number,
  tail: number
): FrontCircle {
  return {
    centerX: width / 2,
    centerY: height / 2,
    startRadius: 0,
    endRadius: Math.hypot(width / 2, height / 2) + tail,
  };
}

/** the asked spacing and dot size, scaled as `autoscale` says */
function scaledGrid(
  width: number,
  height: number,
  dotSpacing: number,
  dotSize: number,
  autoscale: Autoscale
): Pick<WaveGeometry, 'dotSpacing' | 'dotSize'> {
  const spacing = scaledSpacing(width, height, dotSpacing, autoscale);
  if (spacing === dotSpacing) {
    return { dotSpacing, dotSize };
  }
  const scaledSize = (dotSize * spacing) / dotSpacing;
  return {
    dotSpacing: spacing,
    dotSize: Math.max(Math.min(dotSize, MIN_DOT_SIZE), scaledSize),
  };
}

function scaledSpacing(
  width: number,
  height: number,
  dotSpacing: number,
  autoscale: Autoscale
): number {
  if (typeof autoscale === 'number') {
    return Number.isFinite(autoscale) && autoscale > 0
      ? dotSpacing * autoscale
      : dotSpacing;
  }
  const shorterSide = Math.min(width, height);
  // an empty host has no grid to fit, and a factor of 0 would end every sweep
  if (!autoscale || shorterSide <= 0) {
    return dotSpacing;
  }
  return Math.min(dotSpacing, shorterSide / MIN_DOTS_ACROSS);
}

/**
 * The radius of the circle whose arc across the element's height lags at
 * its ends by the sagitta `frontRoundness × min(height / 2, width)`:
 * `R = (a² + s²) / (2s)` with `a = height / 2`, capped for a straight front.
 */
function frontCircleRadius(
  width: number,
  height: number,
  dotSpacing: number,
  frontRoundness: number
): number {
  const maxRadius = MAX_RADIUS_SIDES * Math.max(width, height, dotSpacing);
  const halfHeight = height / 2;
  const sagitta = frontRoundness * Math.min(halfHeight, width);
  if (sagitta <= 0) {
    return maxRadius;
  }
  return Math.min(
    maxRadius,
    (halfHeight * halfHeight + sagitta * sagitta) / (2 * sagitta)
  );
}

/** how many dots a grid of this spacing holds, rows times columns */
function dotCount(width: number, height: number, spacing: number): number {
  const along = (length: number) =>
    length <= 0 ? 0 : Math.max(0, Math.ceil(length / spacing - 0.5));
  return along(width) * along(height);
}

/** the asked spacing, widened until the grid holds at most `MAX_DOTS` */
function spacingWithinDotLimit(
  width: number,
  height: number,
  askedSpacing: number
): number {
  let spacing = Math.max(askedSpacing, Math.sqrt((width * height) / MAX_DOTS));
  // the rows and columns round up: widen a little more where they still do
  while (dotCount(width, height, spacing) > MAX_DOTS) {
    spacing *= 1.01;
  }
  return spacing;
}

/** the share of the current sweep that has passed, 0 up to (not including) 1 */
export function sweepPhase(geometry: WaveGeometry, elapsedMs: number): number {
  const { sweepMs } = geometry;
  return (((elapsedMs % sweepMs) + sweepMs) % sweepMs) / sweepMs;
}

/** the front's radius at the time `elapsedMs` */
export function frontRadius(geometry: WaveGeometry, elapsedMs: number): number {
  return (
    geometry.startRadius + geometry.travel * sweepPhase(geometry, elapsedMs)
  );
}

/** how far the dot lies behind the front: negative ahead of it */
function distanceBehindFront(
  x: number,
  y: number,
  elapsedMs: number,
  geometry: WaveGeometry
): number {
  const fromCenter = Math.hypot(x - geometry.centerX, y - geometry.centerY);
  return frontRadius(geometry, elapsedMs) - fromCenter;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The bright part of the wave: 1 right behind the front, dimming
 * exponentially further behind, 0 ahead of it.
 */
function frontGlow(behind: number, geometry: WaveGeometry): number {
  return (
    smoothstep(-geometry.rise, 0, behind) *
    Math.exp(-Math.max(behind, 0) / geometry.falloff)
  );
}

/** whether a sweep went before this one, whose afterglow and echo show */
export function hasPreviousSweep(
  geometry: WaveGeometry,
  elapsedMs: number
): boolean {
  return elapsedMs >= geometry.sweepMs;
}

/**
 * What stays lit once the front passed: `AFTERGLOW` for the first part of a
 * sweep, then fading out until the next front arrives. Ahead of the front a
 * dot still glows from the sweep before, if there was one.
 */
function afterglow(
  behind: number,
  geometry: WaveGeometry,
  elapsedMs: number
): number {
  if (behind < 0 && !hasPreviousSweep(geometry, elapsedMs)) {
    return 0;
  }
  const sincePassed =
    (behind >= 0 ? behind : behind + geometry.travel) / geometry.travel;
  return AFTERGLOW * (1 - smoothstep(AFTERGLOW_FADE_START, 1, sincePassed));
}

/**
 * How much the wave lights the dot at `(x, y)`: 1 right behind the front,
 * dimming over a few spacings to the afterglow of the dots it passed, which
 * fades out again until the next front comes. On the first sweep nothing
 * ahead of the front is lit.
 */
export function waveIntensity(
  x: number,
  y: number,
  elapsedMs: number,
  geometry: WaveGeometry
): number {
  const behind = distanceBehindFront(x, y, elapsedMs, geometry);
  return Math.max(
    frontGlow(behind, geometry),
    afterglow(behind, geometry, elapsedMs)
  );
}

/**
 * How far the wave pushes the dot at `(x, y)` away from the circle's centre:
 * nothing at rest, most at one falloff behind the front.
 */
export function dotDisplacement(
  x: number,
  y: number,
  elapsedMs: number,
  geometry: WaveGeometry
): Displacement {
  const behind = distanceBehindFront(x, y, elapsedMs, geometry);
  if (behind <= 0) {
    return { dx: 0, dy: 0 };
  }
  const scaled = behind / geometry.falloff;
  const push = geometry.maxPush * scaled * Math.exp(1 - scaled);
  const toX = x - geometry.centerX;
  const toY = y - geometry.centerY;
  const length = Math.hypot(toX, toY);
  // a dot right at a centred front's middle has no way out
  if (length === 0) {
    return { dx: 0, dy: 0 };
  }
  return { dx: (push * toX) / length, dy: (push * toY) / length };
}

/** the centres of the grid's dots, row by row, each centred in its cell */
export function dotCenters({
  width,
  height,
  dotSpacing,
}: Pick<WaveGeometry, 'width' | 'height' | 'dotSpacing'>): Point[] {
  const centers: Point[] = [];
  // an empty host has no dots, however small the spacing
  if (width <= 0 || height <= 0) {
    return centers;
  }
  for (let y = dotSpacing / 2; y < height; y += dotSpacing) {
    for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
      centers.push({ x, y });
    }
  }
  return centers;
}
