import { isSteering } from './state/geometry';
import {
  arenaPointFromClient,
  clientPointFromElement,
  elementPointFromClient,
  nearestFreeCrosshair,
  seatTurn,
  steeringVector,
  turnBack,
  turnPoint,
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

describe('seatTurn', () => {
  it('leaves a single player alone', () => {
    expect(seatTurn(0, 1, false)).toBe(0);
    expect(seatTurn(0, 1, true)).toBe(0);
  });

  it('turns both seats a quarter towards the ends of a phone lying across', () => {
    expect(seatTurn(0, 2, false)).toBe(90);
    expect(seatTurn(1, 2, false)).toBe(270);
  });

  it('turns the top seat upside down on an upright phone', () => {
    expect(seatTurn(0, 2, true)).toBe(0);
    expect(seatTurn(1, 2, true)).toBe(180);
  });
});

/** The point with every -0 made a plain 0, which `toEqual` tells apart. */
function plain(point: { x: number; y: number }): { x: number; y: number } {
  return { x: point.x + 0, y: point.y + 0 };
}

describe('turnPoint', () => {
  it('turns right into down, a quarter clockwise', () => {
    expect(plain(turnPoint({ x: 1, y: 0 }, 90))).toEqual({ x: 0, y: 1 });
    expect(plain(turnPoint({ x: 1, y: 0 }, 180))).toEqual({ x: -1, y: 0 });
    expect(plain(turnPoint({ x: 1, y: 0 }, 270))).toEqual({ x: 0, y: -1 });
    expect(plain(turnPoint({ x: 1, y: 0 }, 0))).toEqual({ x: 1, y: 0 });
  });

  it('is undone by turning back', () => {
    for (const turn of [0, 90, 180, 270] as const) {
      expect(
        turnPoint(turnPoint({ x: 3, y: 5 }, turn), turnBack(turn))
      ).toEqual({ x: 3, y: 5 });
    }
  });
});

describe('elementPointFromClient', () => {
  // A zone of 240 by 150 at the left edge, turned a quarter: on the screen it
  // is 150 wide and 240 tall.
  const turned = { left: 0, top: 0, width: 150, height: 240 };

  it('measures from the corner of an element that is not turned', () => {
    const bounds = { left: 100, top: 200, width: 160, height: 240 };

    expect(elementPointFromClient({ x: 140, y: 260 }, bounds, 0)).toEqual({
      x: 40,
      y: 60,
    });
  });

  it('finds the left end of a turned zone at the top of the screen', () => {
    expect(elementPointFromClient({ x: 75, y: 0 }, turned, 90)).toEqual({
      x: 0,
      y: 75,
    });
    expect(elementPointFromClient({ x: 75, y: 240 }, turned, 270)).toEqual({
      x: 0,
      y: 75,
    });
  });

  it('is undone by the way back', () => {
    for (const turn of [0, 90, 180, 270] as const) {
      const client = { x: 20, y: 50 };
      const point = elementPointFromClient(client, turned, turn);

      expect(clientPointFromElement(point, turned, turn)).toEqual(client);
    }
  });
});
