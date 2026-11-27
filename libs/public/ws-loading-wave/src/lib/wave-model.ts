/**
 * The loading wave as pure math, shared by the 2D canvas renderer and
 * mirrored by the WebGL shader (`webgl/wave-shaders.ts`).
 *
 * The wave front is an arc of a circle whose centre lies far left of the
 * element, at mid-height: a ripple from off-screen. Its radius grows at an
 * even speed, so the front sweeps from the left edge until the lit tail
 * behind it has left the element at every row, then starts again.
 * Every length is in CSS pixels, every time in milliseconds.
 */

/** how far the circle's centre lies left of the element, times its larger side */
const CENTER_DISTANCE = 1.5;
/** distance behind the front over which a dot dims to 1/e, in dot spacings */
const FALLOFF_SPACINGS = 1;
/** distance ahead of the front over which a dot lights up, in dot spacings */
const RISE_SPACINGS = 0.25;
/** length of the visibly lit tail behind the front, in dot spacings */
const TAIL_SPACINGS = 3;
/** the farthest a lit dot is pushed along the wave, in dot spacings */
const MAX_PUSH_SPACINGS = 0.15;

export interface WaveGeometry {
  readonly width: number;
  readonly height: number;
  readonly dotSpacing: number;
  readonly sweepMs: number;
  readonly centerX: number;
  readonly centerY: number;
  /** the front's radius at the start of a sweep: it touches the left edge */
  readonly startRadius: number;
  /** the front's radius at the end of a sweep: the tail left every row */
  readonly endRadius: number;
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
  readonly sweepMs?: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Displacement {
  readonly dx: number;
  readonly dy: number;
}

const DEFAULT_SWEEP_MS = 1600;

export function waveGeometry(
  width: number,
  height: number,
  { dotSpacing, sweepMs = DEFAULT_SWEEP_MS }: WaveGeometryOptions
): WaveGeometry {
  const distance = CENTER_DISTANCE * Math.max(width, height, dotSpacing);
  const tail = TAIL_SPACINGS * dotSpacing;
  return {
    width,
    height,
    dotSpacing,
    sweepMs,
    centerX: -distance,
    centerY: height / 2,
    startRadius: distance,
    endRadius: Math.hypot(distance + width + tail, height / 2),
    falloff: FALLOFF_SPACINGS * dotSpacing,
    rise: RISE_SPACINGS * dotSpacing,
    tail,
    maxPush: MAX_PUSH_SPACINGS * dotSpacing,
  };
}

/** the share of the current sweep that has passed, 0 up to (not including) 1 */
export function sweepPhase(geometry: WaveGeometry, elapsedMs: number): number {
  const { sweepMs } = geometry;
  return (((elapsedMs % sweepMs) + sweepMs) % sweepMs) / sweepMs;
}

/** the front's radius at the time `elapsedMs` */
export function frontRadius(geometry: WaveGeometry, elapsedMs: number): number {
  const { startRadius, endRadius } = geometry;
  return (
    startRadius + (endRadius - startRadius) * sweepPhase(geometry, elapsedMs)
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
 * How much the wave lights the dot at `(x, y)`: 0 ahead of the front, 1 right
 * behind it, dimming exponentially further behind.
 */
export function waveIntensity(
  x: number,
  y: number,
  elapsedMs: number,
  geometry: WaveGeometry
): number {
  const behind = distanceBehindFront(x, y, elapsedMs, geometry);
  return (
    smoothstep(-geometry.rise, 0, behind) *
    Math.exp(-Math.max(behind, 0) / geometry.falloff)
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
  return { dx: (push * toX) / length, dy: (push * toY) / length };
}

/** the centres of the grid's dots, row by row, each centred in its cell */
export function dotCenters({
  width,
  height,
  dotSpacing,
}: Pick<WaveGeometry, 'width' | 'height' | 'dotSpacing'>): Point[] {
  const centers: Point[] = [];
  for (let y = dotSpacing / 2; y < height; y += dotSpacing) {
    for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
      centers.push({ x, y });
    }
  }
  return centers;
}
