import { isSteering } from './state/geometry';
import {
  arenaPointFromClient,
  nearestFreeCrosshair,
  Pinch,
  steeringVector,
} from './touch-controls';

const ARENA_WIDTH = 320;
const ARENA_HEIGHT = 140;
const WHOLE = { x: 0, y: 0, width: ARENA_WIDTH, height: ARENA_HEIGHT };

/** The canvas as CSS stretches it on a phone: same aspect, 2x the size. */
const stretched = { left: 20, top: 100, width: 640, height: 280 };

describe('arenaPointFromClient', () => {
  it('scales a touch on the stretched canvas back to arena coordinates', () => {
    const point = arenaPointFromClient(20 + 320, 100 + 140, stretched, WHOLE);

    expect(point).toEqual({ x: 160, y: 70 });
  });

  it('maps the corners of the element onto the corners of the arena', () => {
    expect(arenaPointFromClient(20, 100, stretched, WHOLE)).toEqual({
      x: 0,
      y: 0,
    });
    expect(arenaPointFromClient(660, 380, stretched, WHOLE)).toEqual({
      x: ARENA_WIDTH,
      y: ARENA_HEIGHT,
    });
  });

  it('keeps a finger that slides off the canvas inside the arena', () => {
    const point = arenaPointFromClient(-500, 9999, stretched, WHOLE);

    expect(point).toEqual({ x: 0, y: ARENA_HEIGHT });
  });

  it('maps a touch onto the part of the arena the camera shows', () => {
    const view = { x: 100, y: 40, width: 160, height: 70 };

    expect(arenaPointFromClient(20 + 320, 100 + 140, stretched, view)).toEqual({
      x: 180,
      y: 75,
    });
    expect(arenaPointFromClient(-500, 9999, stretched, view)).toEqual({
      x: 100,
      y: 110,
    });
  });

  it('returns null while the element has no layout', () => {
    expect(
      arenaPointFromClient(
        10,
        10,
        { left: 0, top: 0, width: 0, height: 0 },
        WHOLE
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
  const radius = 50;

  it('rests while the finger has not moved', () => {
    expect(steeringVector({ x: 0, y: 0 }, radius)).toEqual({ x: 0, y: 0 });
  });

  it('ignores a nudge inside the dead zone', () => {
    const vector = steeringVector({ x: 5, y: 0 }, radius);

    expect(isSteering(vector)).toBe(false);
  });

  it('is pushed all the way at the rim of the base', () => {
    expect(steeringVector({ x: 50, y: 0 }, radius)).toEqual({ x: 1, y: 0 });
  });

  it('never grows beyond the rim', () => {
    const vector = steeringVector({ x: 0, y: 300 }, radius);

    expect(vector).toEqual({ x: 0, y: 1 });
  });

  it('grows linearly between the dead zone and the rim', () => {
    // Half way between the dead zone (7.5px) and the rim (50px) along -x.
    const vector = steeringVector({ x: -28.75, y: 0 }, radius);

    expect(vector.x).toBeCloseTo(-0.5);
    expect(vector.y).toBeCloseTo(0);
  });

  it('keeps the direction of a diagonal pull', () => {
    const vector = steeringVector({ x: 40, y: 40 }, radius);

    expect(vector.x).toBeCloseTo(vector.y);
    expect(Math.hypot(vector.x, vector.y)).toBeLessThanOrEqual(1);
  });
});

describe('Pinch', () => {
  function pinched(): Pinch {
    const pinch = new Pinch();
    pinch.down(1, { x: 100, y: 100 });
    pinch.down(2, { x: 200, y: 100 });
    pinch.start(2);
    return pinch;
  }

  it('zooms by how much the gap between the two fingers grew', () => {
    const pinch = pinched();

    expect(pinch.move(2, { x: 300, y: 100 })).toBeCloseTo(2);
    expect(pinch.move(1, { x: 200, y: 100 })).toBeCloseTo(0.5);
  });

  it('starts only with exactly two fingers on the arena', () => {
    const one = new Pinch();
    one.down(1, { x: 0, y: 0 });
    expect(one.start(1)).toBe(false);

    const three = pinched();
    three.down(3, { x: 50, y: 50 });
    expect(three.start(3)).toBe(false);
    expect(three.pinches(3)).toBe(false);
    expect(three.pinches(1)).toBe(true);
  });

  it('leaves a finger that does not pinch alone', () => {
    const pinch = new Pinch();
    pinch.down(1, { x: 100, y: 100 });

    expect(pinch.move(1, { x: 300, y: 100 })).toBe(1);
    expect(pinch.pinches(1)).toBe(false);
  });

  it('keeps the finger left on the screen out of play until it is lifted', () => {
    const pinch = pinched();
    pinch.up(1);

    expect(pinch.pinches(2)).toBe(true);
    expect(pinch.move(2, { x: 400, y: 100 })).toBe(1);

    pinch.up(2);
    expect(pinch.pinches(2)).toBe(false);
  });
});
