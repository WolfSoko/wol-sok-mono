import { Vector2d } from '@wolsok/utils-math';

export interface SvgPath {
  id: string;
  path: string;
}

/**
 * One chunk of a planet trail. Splitting a trail into a handful of chunks lets
 * the tail fade out and taper towards its oldest end with plain SVG strokes.
 */
export interface TrailSegment extends SvgPath {
  color: string;
  opacity: number;
  width: number;
}

/** Number of chunks a trail is split into to fake a fading, tapering tail. */
export const TRAIL_SEGMENT_COUNT = 16;
/**
 * How far ahead a velocity arrow reaches, in years. Drawing the velocity
 * itself would put the earth's arrow six AU across the world; eighteen days
 * of travel is a length that fits, and one that means something: where the
 * body will be shortly.
 */
export const VELOCITY_ARROW_YEARS = 0.05;
/** Digits kept in a path, enough for AU to stay smooth under deep zoom. */
const PATH_DIGITS = 5;
const TRAIL_MAX_OPACITY = 0.8;
const TRAIL_MIN_WIDTH_RATIO = 0.15;

export function svgPathForVelocity(
  id: string,
  pos: Vector2d,
  vel: Vector2d
): SvgPath {
  const { x, y } = pos;
  const { x: x2, y: y2 } = pos.add(vel.mul(VELOCITY_ARROW_YEARS));
  return { id, path: `M${x} ${y} ${x2} ${y2}` };
}

/**
 * Turns a recorded trail (oldest point first) into at most `segmentCount`
 * overlapping segments. The newer a segment, the wider and more opaque it is
 * drawn.
 */
export function trailToSvgSegments(
  id: string,
  trail: readonly Vector2d[],
  color: string,
  maxWidth: number,
  segmentCount: number = TRAIL_SEGMENT_COUNT
): TrailSegment[] {
  if (trail.length < 2 || maxWidth <= 0) {
    return [];
  }
  // segments share a point with their neighbour, so they cover one point more
  // than the intervals they span
  const pointsPerSegment: number = Math.max(
    2,
    Math.ceil((trail.length - 1) / Math.max(1, segmentCount)) + 1
  );
  const segments: TrailSegment[] = [];
  const lastIndex: number = trail.length - 1;
  // segments overlap by one point so there are no gaps between them
  for (let start = 0; start < lastIndex; start += pointsPerSegment - 1) {
    const points: readonly Vector2d[] = trail.slice(
      start,
      start + pointsPerSegment
    );
    if (points.length < 2) {
      break;
    }
    // 0 for the oldest, 1 for the newest part of the trail
    const age: number = (start + points.length - 1) / lastIndex;
    segments.push({
      id: `${id}-trail-${start}`,
      path: toPolylinePath(points),
      color,
      opacity: round(TRAIL_MAX_OPACITY * age, 2),
      width: round(
        maxWidth * (TRAIL_MIN_WIDTH_RATIO + (1 - TRAIL_MIN_WIDTH_RATIO) * age),
        PATH_DIGITS
      ),
    });
  }
  return segments;
}

/** Joins the points into an svg polyline path, rounded to keep it short. */
function toPolylinePath(points: readonly Vector2d[]): string {
  return points
    .map(
      ({ x, y }, i) =>
        `${i === 0 ? 'M' : 'L'}${round(x, PATH_DIGITS)} ${round(y, PATH_DIGITS)}`
    )
    .join(' ');
}

/** Rounds to the given number of decimal digits. */
function round(value: number, digits: number): number {
  const factor: number = 10 ** digits;
  return Math.round(value * factor) / factor;
}
