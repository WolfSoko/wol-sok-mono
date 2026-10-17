import { isSteering } from './state/geometry';
import {
  arenaPointFromClient,
  knobOffset,
  nearestFreeCrosshair,
  steeringVector,
} from './touch-controls';

const ARENA_WIDTH = 320;
const ARENA_HEIGHT = 140;

/** The canvas as CSS stretches it on a phone: same aspect, 2x the size. */
const stretched = { left: 20, top: 100, width: 640, height: 280 };

describe('arenaPointFromClient', () => {
  it('scales a touch on the stretched canvas back to arena coordinates', () => {
    const point = arenaPointFromClient(
      20 + 320,
      100 + 140,
      stretched,
      ARENA_WIDTH,
      ARENA_HEIGHT
    );

    expect(point).toEqual({ x: 160, y: 70 });
  });

  it('maps the corners of the element onto the corners of the arena', () => {
    expect(
      arenaPointFromClient(20, 100, stretched, ARENA_WIDTH, ARENA_HEIGHT)
    ).toEqual({ x: 0, y: 0 });
    expect(
      arenaPointFromClient(660, 380, stretched, ARENA_WIDTH, ARENA_HEIGHT)
    ).toEqual({ x: ARENA_WIDTH, y: ARENA_HEIGHT });
  });

  it('keeps a finger that slides off the canvas inside the arena', () => {
    const point = arenaPointFromClient(
      -500,
      9999,
      stretched,
      ARENA_WIDTH,
      ARENA_HEIGHT
    );

    expect(point).toEqual({ x: 0, y: ARENA_HEIGHT });
  });

  it('returns null while the element has no layout', () => {
    expect(
      arenaPointFromClient(
        10,
        10,
        { left: 0, top: 0, width: 0, height: 0 },
        ARENA_WIDTH,
        ARENA_HEIGHT
      )
    ).toBeNull();
  });
});

describe('nearestFreeCrosshair', () => {
  const crosshairs = [
    { id: 0, x: 80, y: 70 },
    { id: 1, x: 240, y: 70 },
  ];

  it('grabs the crosshair the finger landed next to', () => {
    expect(nearestFreeCrosshair(crosshairs, { x: 90, y: 70 }, new Set())).toBe(
      0
    );
    expect(nearestFreeCrosshair(crosshairs, { x: 230, y: 70 }, new Set())).toBe(
      1
    );
  });

  it('gives the second finger the other crosshair, even when it is further', () => {
    // Both players reach for the same side; the first finger already holds 0.
    expect(
      nearestFreeCrosshair(crosshairs, { x: 85, y: 70 }, new Set([0]))
    ).toBe(1);
  });

  it('returns null once every crosshair is held', () => {
    expect(
      nearestFreeCrosshair(crosshairs, { x: 160, y: 70 }, new Set([0, 1]))
    ).toBeNull();
  });
});

describe('steeringVector', () => {
  const origin = { x: 100, y: 100 };
  const radius = 50;

  it('rests while the finger has not moved', () => {
    expect(steeringVector(origin, origin, radius)).toEqual({ x: 0, y: 0 });
  });

  it('ignores a nudge inside the dead zone', () => {
    const vector = steeringVector(origin, { x: 105, y: 100 }, radius);

    expect(isSteering(vector)).toBe(false);
  });

  it('is pushed all the way at the rim of the base', () => {
    expect(steeringVector(origin, { x: 150, y: 100 }, radius)).toEqual({
      x: 1,
      y: 0,
    });
  });

  it('never grows beyond the rim', () => {
    const vector = steeringVector(origin, { x: 100, y: 400 }, radius);

    expect(vector).toEqual({ x: 0, y: 1 });
  });

  it('grows linearly between the dead zone and the rim', () => {
    // Half way between the dead zone (7.5px) and the rim (50px) along -x.
    const vector = steeringVector(origin, { x: 100 - 28.75, y: 100 }, radius);

    expect(vector.x).toBeCloseTo(-0.5);
    expect(vector.y).toBeCloseTo(0);
  });

  it('keeps the direction of a diagonal pull', () => {
    const vector = steeringVector(origin, { x: 140, y: 140 }, radius);

    expect(vector.x).toBeCloseTo(vector.y);
    expect(Math.hypot(vector.x, vector.y)).toBeLessThanOrEqual(1);
  });
});

describe('knobOffset', () => {
  const origin = { x: 100, y: 100 };

  it('follows the finger inside the base', () => {
    expect(knobOffset(origin, { x: 120, y: 90 }, 50)).toEqual({
      x: 20,
      y: -10,
    });
  });

  it('stops at the rim once the finger pulls further', () => {
    const offset = knobOffset(origin, { x: 100, y: 300 }, 50);

    expect(offset).toEqual({ x: 0, y: 50 });
  });
});
