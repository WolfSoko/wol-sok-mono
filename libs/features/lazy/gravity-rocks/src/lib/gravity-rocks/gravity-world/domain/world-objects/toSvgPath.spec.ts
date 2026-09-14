import { vec2, Vector2d } from '@wolsok/utils-math';
import { SpringForce } from './force';
import { TrailSegment } from './svg-path';
import {
  VELOCITY_ARROW_YEARS,
  svgPathForVelocity,
  toSvgPath,
  trailToSvgSegments,
} from './toSvgPath';
import { WorldObject } from './world-object';

describe('toSvgPath', () => {
  it('should draw a spring force from the object to the spring end', () => {
    const force = new SpringForce(new WorldObject(vec2(10, 20), undefined, 1));
    force.updateSpringEnd(vec2(30, 40));

    expect(toSvgPath(force)?.path).toBe('M10 20 30 40');
  });

  it('should draw where the velocity takes an object next', () => {
    // the arrow is the travel of `VELOCITY_ARROW_YEARS`, not the velocity
    // itself, which at solar system speeds would cross the whole world
    expect(svgPathForVelocity('id', vec2(1, 2), vec2(4, 8)).path).toBe(
      `M1 2 ${1 + 4 * VELOCITY_ARROW_YEARS} ${2 + 8 * VELOCITY_ARROW_YEARS}`
    );
  });
});

describe('trailToSvgSegments', () => {
  /** Straight trail of evenly spaced points, oldest first. */
  function trailOf(pointCount: number): Vector2d[] {
    return Array.from({ length: pointCount }, (_, i) => vec2(i * 10, 0));
  }

  it('should not draw a trail of less than two points', () => {
    expect(trailToSvgSegments('p', [], 'red', 10)).toEqual([]);
    expect(trailToSvgSegments('p', [vec2(0, 0)], 'red', 10)).toEqual([]);
  });

  it('should not draw a trail without a width', () => {
    expect(trailToSvgSegments('p', trailOf(10), 'red', 0)).toEqual([]);
  });

  it('should draw a single segment for a short trail', () => {
    const segments: TrailSegment[] = trailToSvgSegments(
      'p',
      [vec2(0, 0), vec2(10, 20)],
      'red',
      8
    );

    expect(segments).toEqual([
      {
        id: 'p-trail-0',
        path: 'M0 0 L10 20',
        color: 'red',
        opacity: 0.8,
        width: 8,
      },
    ]);
  });

  it('should split a long trail into the requested number of segments', () => {
    const segments: TrailSegment[] = trailToSvgSegments(
      'p',
      trailOf(41),
      'red',
      10,
      4
    );

    expect(segments).toHaveLength(4);
    expect(segments.map((s) => s.id)).toEqual([
      'p-trail-0',
      'p-trail-10',
      'p-trail-20',
      'p-trail-30',
    ]);
  });

  it('should never return more segments than requested', () => {
    for (const pointCount of [2, 3, 12, 41, 42, 60, 100, 150]) {
      for (const segmentCount of [1, 4, 16]) {
        const segments: TrailSegment[] = trailToSvgSegments(
          'p',
          trailOf(pointCount),
          'red',
          10,
          segmentCount
        );

        expect(segments.length).toBeLessThanOrEqual(segmentCount);
        // the whole trail is still covered, up to its newest point
        expect(segments[segments.length - 1].path).toContain(
          `L${(pointCount - 1) * 10} 0`
        );
      }
    }
  });

  it('should keep the requested segment count for an uneven trail', () => {
    // 42 points do not divide evenly into 4 segments
    const segments: TrailSegment[] = trailToSvgSegments(
      'p',
      trailOf(42),
      'red',
      10,
      4
    );

    expect(segments).toHaveLength(4);
    expect(segments[segments.length - 1].path).toContain('L410 0');
  });

  it('should let the segments overlap so there are no gaps', () => {
    const segments: TrailSegment[] = trailToSvgSegments(
      'p',
      trailOf(9),
      'red',
      10,
      4
    );

    const ends = segments.map((s) => s.path.split(' ').slice(-2).join(' '));
    const starts = segments.map((s) => s.path.split(' ').slice(0, 2).join(' '));
    expect(starts.slice(1)).toEqual(
      ends.slice(0, -1).map((end) => end.replace('L', 'M'))
    );
  });

  it('should fade and taper towards the oldest end of the trail', () => {
    const segments: TrailSegment[] = trailToSvgSegments(
      'p',
      trailOf(41),
      'red',
      10,
      4
    );

    expect(segments.map((s) => s.opacity)).toEqual([0.2, 0.4, 0.6, 0.8]);
    const widths = segments.map((s) => s.width);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(widths[widths.length - 1]).toBe(10);
  });

  it('should keep the newest point of the trail', () => {
    const segments: TrailSegment[] = trailToSvgSegments(
      'p',
      trailOf(41),
      'red',
      10,
      4
    );

    expect(segments[segments.length - 1].path).toContain('L400 0');
  });
});
