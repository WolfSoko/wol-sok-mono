import { Point } from './geometry';
import { Rect } from './maps';
import { flood, navGrid, travel, waypoint, withWalls } from './bot-navigation';
import { Zone } from './zones';

// The base arena: a grid cell is 4 arena cells across.
const WIDTH = 320;
const HEIGHT = 180;

/** A wall across the middle, from the top down to `gapAt`. */
function barrier(gapAt: number): Rect {
  return { x: 156, y: 0, width: 8, height: gapAt };
}

describe('bot navigation', () => {
  const from: Point = { x: 80, y: 40 };
  const to: Point = { x: 240, y: 40 };

  it('goes straight where nothing is in the way', () => {
    const field = flood(navGrid(WIDTH, HEIGHT, [], []), from);

    expect(waypoint(field, to)).toEqual(to);
    expect(travel(field, to)).toBeCloseTo(160, -1);
  });

  it('heads round a wall instead of into it', () => {
    const field = flood(navGrid(WIDTH, HEIGHT, [barrier(140)], []), from);

    const next = waypoint(field, to);

    // Down towards the gap under the wall, not straight across.
    expect(next.y).toBeGreaterThan(100);
    expect(next.x).toBeLessThanOrEqual(164);
    // The way round is longer than the straight line.
    expect(travel(field, to)).toBeGreaterThan(250);
  });

  it('cannot reach a spot walled in all round', () => {
    const box: Rect[] = [
      { x: 200, y: 20, width: 80, height: 6 },
      { x: 200, y: 60, width: 80, height: 6 },
      { x: 200, y: 20, width: 6, height: 46 },
      { x: 274, y: 20, width: 6, height: 46 },
    ];
    const field = flood(navGrid(WIDTH, HEIGHT, box, []), from);

    expect(travel(field, to)).toBe(Number.POSITIVE_INFINITY);
    // With nowhere to go, the crosshair is sent at the point itself.
    expect(waypoint(field, to)).toEqual(to);
  });

  it('goes round antibiotic when the way round is short', () => {
    const poison: Zone = {
      kind: 'antibiotic',
      x: 140,
      y: 20,
      width: 40,
      height: 40,
    };
    const field = flood(navGrid(WIDTH, HEIGHT, [], [poison]), from);

    const next = waypoint(field, to);

    expect(next).not.toEqual(to);
    expect(next.y < 20 || next.y > 60).toBe(true);
  });

  it('treats a gate that is shut as a wall', () => {
    const grid = navGrid(WIDTH, HEIGHT, [barrier(140)], []);
    const gate: Rect = { x: 156, y: 140, width: 8, height: 40 };

    const open = travel(flood(grid, from), to);
    const shut = travel(flood(withWalls(grid, [gate]), from), to);

    expect(open).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(shut).toBe(Number.POSITIVE_INFINITY);
  });

  it('starts from the nearest open spot when the colony sits on a wall', () => {
    const wall: Rect = { x: 60, y: 20, width: 40, height: 40 };
    const field = flood(navGrid(WIDTH, HEIGHT, [wall], []), from);

    expect(travel(field, to)).toBeLessThan(Number.POSITIVE_INFINITY);
  });
});
