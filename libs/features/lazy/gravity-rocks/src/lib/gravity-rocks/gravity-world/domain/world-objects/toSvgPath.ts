import { Vector2d } from '@wolsok/utils-math';
import { Force, SpringForce } from './force';
import { SvgPath, TrailSegment } from './svg-path';

/** Number of chunks a trail is split into to fake a fading, tapering tail. */
export const TRAIL_SEGMENT_COUNT = 16;
const TRAIL_MAX_OPACITY = 0.8;
const TRAIL_MIN_WIDTH_RATIO = 0.15;

export function toSvgPath(force: Force): SvgPath | null {
  if (force instanceof SpringForce) {
    const { x, y } = force.wo.pos;
    const { x: x2, y: y2 } = force.springEnd;
    return { id: force.id, path: `M${x} ${y} ${x2} ${y2}` };
  }
  return null;
}

export function svgPathForVelocity(
  id: string,
  pos: Vector2d,
  vel: Vector2d
): SvgPath {
  const { x, y } = pos;
  const { x: x2, y: y2 } = pos.add(vel);
  return { id, path: `M${x} ${y} ${x2} ${y2}` };
}

/**
 * Turns a recorded trail (oldest point first) into a few overlapping segments.
 * The newer a segment, the wider and more opaque it is drawn.
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
  const pointsPerSegment: number = Math.max(
    2,
    Math.ceil(trail.length / Math.max(1, segmentCount))
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
        2
      ),
    });
  }
  return segments;
}

function toPolylinePath(points: readonly Vector2d[]): string {
  return points
    .map(({ x, y }, i) => `${i === 0 ? 'M' : 'L'}${round(x, 1)} ${round(y, 1)}`)
    .join(' ');
}

function round(value: number, digits: number): number {
  const factor: number = 10 ** digits;
  return Math.round(value * factor) / factor;
}
