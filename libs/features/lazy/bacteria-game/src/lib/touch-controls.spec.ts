import { arenaPointFromClient, nearestFreeCrosshair } from './touch-controls';

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
