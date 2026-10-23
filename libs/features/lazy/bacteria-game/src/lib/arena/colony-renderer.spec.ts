import { gameBalance } from '../state/game-balance';
import { Point } from '../state/geometry';
import { Bacteria } from '../state/player.model';
import { BacteriaLook } from '../settings.service';
import { COLONY_COLORS } from '../state/colony-colors';

import {
  cellBubble,
  colonyDensity,
  createImageDataFromBacterias,
  hatchPattern,
  latticeTile,
  LOOK_TUNING,
  paintColony,
  shimmerAt,
  SLIME_SCALE,
  slimeRegion,
} from './colony-renderer';
import { Rect } from '../state/maps';

const { CELL_MIN, CELL_SPACING } = LOOK_TUNING;

const WIDTH = 40;
const HEIGHT = 20;
const ORANGE = [255, 100, 20, 255];

/** A filled disc of full energy bacteria. */
function blob(cx: number, cy: number, radius: number): Bacteria[] {
  const result: Bacteria[] = [];
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
        result.push({ x, y, energy: gameBalance.maxEnergy });
      }
    }
  }
  return result;
}

const WHOLE: Rect = { x: 0, y: 0, width: WIDTH, height: HEIGHT };

function slime(
  bacterias: Bacteria[],
  shimmerTimeSec: number | null = null,
  view: Rect = WHOLE,
  look: Exclude<BacteriaLook, 'pixels'> = 'slime',
  timeSec = 0
) {
  const target: Point = { x: 30, y: 10 };
  const region = slimeRegion(bacterias, view, WIDTH, HEIGHT);
  const cells = WIDTH * HEIGHT;
  const density = new Float32Array(cells);
  const heat = new Float32Array(cells);
  const hot = colonyDensity(
    density,
    heat,
    new Float32Array(cells),
    WIDTH,
    HEIGHT,
    bacterias,
    gameBalance,
    region ?? undefined
  );
  const data = new Uint8ClampedArray(cells * SLIME_SCALE * SLIME_SCALE * 4);
  if (region == null) {
    return data;
  }
  const shimmer =
    shimmerTimeSec == null
      ? null
      : { timeSec: shimmerTimeSec, target, unit: 1 };
  paintColony(
    look,
    data,
    density,
    hot ? heat : null,
    WIDTH,
    HEIGHT,
    ORANGE,
    shimmer,
    1,
    region,
    region,
    timeSec
  );
  return data;
}

/** Every look's pixels inside and outside a colony. */
function withLook(look: Exclude<BacteriaLook, 'pixels'>) {
  const data = slime(blob(20, 10, 6), null, WHOLE, look);
  return { data, inside: pixelsWithin(data, 20, 10, 4) };
}

const brightness = ([r, g, b]: number[]) => r + g + b;

/** The layer pixels of the arena cells inside a disc around a point. */
function pixelsWithin(
  data: Uint8ClampedArray,
  cx: number,
  cy: number,
  radius: number
): number[][] {
  const pixels: number[][] = [];
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
        pixels.push(at(data, x, y));
      }
    }
  }
  return pixels;
}

/** The RGBA of the slime pixel at an arena position. */
function at(data: Uint8ClampedArray, x: number, y: number): number[] {
  const index = (y * SLIME_SCALE * WIDTH * SLIME_SCALE + x * SLIME_SCALE) * 4;
  return Array.from(data.slice(index, index + 4));
}

describe('paintSlime', () => {
  it('covers a colony and leaves the floor around it clear', () => {
    const data = slime(blob(20, 10, 5));

    expect(at(data, 20, 10)[3]).toBeGreaterThan(200);
    expect(at(data, 2, 2)[3]).toBe(0);
    expect(at(data, 38, 18)[3]).toBe(0);
  });

  it('melts neighbours into one blob without a gap between them', () => {
    const data = slime([...blob(15, 10, 3), ...blob(22, 10, 3)]);

    // The cell halfway between the two discs holds no bacterium.
    expect(at(data, 18, 10)[3]).toBeGreaterThan(100);
  });

  it('keeps the colour of the colony', () => {
    const [r, g, b] = at(slime(blob(20, 10, 5)), 22, 12);

    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('paints what is in view as it paints the whole arena', () => {
    const colony = [...blob(8, 10, 4), ...blob(30, 9, 6)];
    const view: Rect = { x: 12.5, y: 3.25, width: 20, height: 9 };

    const whole = slime(colony);
    const cut = slime(colony, null, view);

    for (let y = 3; y <= 12; y++) {
      for (let x = 12; x <= 33; x++) {
        expect(at(cut, x, y)).toEqual(at(whole, x, y));
      }
    }
  });

  it('paints nothing of a colony out of view', () => {
    const view: Rect = { x: 20, y: 0, width: 20, height: 20 };

    expect(slimeRegion(blob(5, 10, 3), view, WIDTH, HEIGHT)).toBeNull();
  });

  it('lights a boosted colony up', () => {
    const plain = slime(blob(20, 10, 6));
    const boosted = slime(blob(20, 10, 6), 0.3);
    const light = (data: Uint8ClampedArray) =>
      data.reduce(
        (sum, value, index) => (index % 4 === 3 ? sum : sum + value),
        0
      );

    expect(light(boosted)).toBeGreaterThan(light(plain));
  });
});

describe('paintCells', () => {
  it('draws glossy cells in the colour of the colony on a dark base', () => {
    const { inside } = withLook('cells');

    // The base is the colony's colour darkened; a cell's light spot is
    // brighter than the colour, its rim darker, all of it still orange.
    const levels = inside.map(brightness);
    expect(Math.max(...levels)).toBeGreaterThan(brightness(ORANGE));
    expect(Math.min(...levels)).toBeLessThan(brightness(ORANGE) * 0.5);
    for (const [red, green, blue] of inside) {
      expect(red).toBeGreaterThan(green);
      expect(green).toBeGreaterThan(blue);
    }
  });
});

describe.each<Exclude<BacteriaLook, 'pixels'>>([
  'cells',
  'honeycomb',
  'crystal',
  'neon',
  'ink',
  'bubbles',
])('the %s look', (look) => {
  it('covers a colony in its colour and leaves the floor around it clear', () => {
    const { data, inside } = withLook(look);

    for (const pixel of inside) {
      expect(pixel[3]).toBeGreaterThan(150);
      // Still orange, however light or dark the look makes it.
      expect(pixel[0]).toBeGreaterThanOrEqual(pixel[1]);
      expect(pixel[1]).toBeGreaterThanOrEqual(pixel[2]);
    }
    expect(at(data, 20, 1)[3]).toBe(0);
    expect(at(data, 2, 10)[3]).toBe(0);
  });

  it('lights a boosted colony up', () => {
    const plain = slime(blob(20, 10, 6), null, WHOLE, look);
    const boosted = slime(blob(20, 10, 6), 0.3, WHOLE, look);

    const sum = (data: Uint8ClampedArray) =>
      pixelsWithin(data, 20, 10, 4).reduce(
        (total, pixel) => total + brightness(pixel),
        0
      );
    expect(sum(boosted)).toBeGreaterThan(sum(plain));
  });
});

describe('paintTiles', () => {
  it('lays tiles with seams between them', () => {
    for (const look of ['honeycomb', 'crystal'] as const) {
      const { inside } = withLook(look);
      const levels = inside.map(brightness);
      // Faces and seams differ clearly in brightness.
      expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(150);
    }
  });

  it('sets the honeycomb tiles on the lattice and the crystal facets off it', () => {
    const field = new Float32Array(WIDTH * HEIGHT).fill(1);
    const honeycomb = latticeTile(3, 2, 2.8, false, field, WIDTH, HEIGHT);
    const crystal = latticeTile(3, 2, 2.8, true, field, WIDTH, HEIGHT);
    const next = latticeTile(4, 2, 2.8, true, field, WIDTH, HEIGHT);
    const strayed = Math.hypot(
      crystal.x - honeycomb.x,
      crystal.y - honeycomb.y
    );

    expect(honeycomb.x).toBeCloseTo(3.5 * 2.8);
    expect(honeycomb.y).toBeCloseTo(2.5 * 2.8 * 0.866);
    expect(strayed).toBeGreaterThan(0);
    expect(strayed).toBeLessThan(2.8 * 0.6);
    expect(crystal.shade).not.toBeCloseTo(next.shade, 3);
    expect(honeycomb.density).toBe(1);
  });
});

describe('paintBubbles', () => {
  it('floats snippets inside the bubbles that move with the time', () => {
    const bacterias = blob(20, 10, 7);
    const now = pixelsWithin(
      slime(bacterias, null, WHOLE, 'bubbles'),
      20,
      10,
      5
    );
    const later = pixelsWithin(
      slime(bacterias, null, WHOLE, 'bubbles', 2),
      20,
      10,
      5
    );

    const moved = now.filter(
      (pixel, i) => brightness(pixel) !== brightness(later[i])
    );
    expect(moved.length).toBeGreaterThan(0);
  });
});

describe('paintNeon', () => {
  it('glows at the outline and stays dark inside', () => {
    const { data } = withLook('neon');
    // The outline lies about where the slime's edge is, the body well inside.
    const edge = Math.max(
      ...[2, 3, 4, 5, 6].map((y) => brightness(at(data, 20, y)))
    );
    const body = brightness(at(data, 20, 10));

    expect(edge).toBeGreaterThan(body * 2);
    expect(body).toBeGreaterThan(0);
  });
});

describe('paintInk', () => {
  it('hatches the body in two tones inside a dark outline', () => {
    const { data, inside } = withLook('ink');
    const levels = new Set(
      inside.map((pixel) => Math.round(brightness(pixel)))
    );

    const outline = Math.min(
      ...[2, 3, 4, 5, 6].map((y) => brightness(at(data, 20, y)))
    );

    expect(levels.size).toBeGreaterThanOrEqual(2);
    expect(outline).toBeLessThan(Math.max(...inside.map(brightness)) * 0.5);
  });
});

describe('hatchPattern', () => {
  it('hatches every colour of the palette in a pattern of its own', () => {
    const patterns = COLONY_COLORS.map(({ rgb }) =>
      JSON.stringify(hatchPattern([...rgb, 255]))
    );

    expect(new Set(patterns).size).toBe(COLONY_COLORS.length);
  });

  it('hatches along a unit vector', () => {
    const { direction } = hatchPattern([255, 100, 20, 255]);

    expect(Math.hypot(...direction)).toBeCloseTo(1, 6);
  });
});

describe('slimeRegion', () => {
  it('reaches further past the view for a look that asks for it', () => {
    const view: Rect = { x: 10, y: 0, width: 10, height: HEIGHT };
    const bacterias = blob(20, 10, 8);

    const slime = slimeRegion(bacterias, view, WIDTH, HEIGHT);
    const lattice = slimeRegion(bacterias, view, WIDTH, HEIGHT, 3);

    expect(slime).not.toBeNull();
    // Past the view's right edge, where the colony goes on.
    expect(lattice?.maxX).toBe((slime?.maxX ?? 0) + 3);
    // On the left the bacteria end first, which cuts both the same.
    expect(lattice?.minX).toBe(slime?.minX);
  });
});

describe('cellBubble', () => {
  const field = (value: number) => new Float32Array(WIDTH * HEIGHT).fill(value);

  it('grows a cell with the density under it', () => {
    const thin = cellBubble(3, 2, CELL_SPACING, field(0.2), WIDTH, HEIGHT);
    const dense = cellBubble(3, 2, CELL_SPACING, field(1), WIDTH, HEIGHT);

    expect(thin).not.toBeNull();
    expect(dense).not.toBeNull();
    expect(dense?.radius).toBeGreaterThan(thin?.radius ?? Infinity);
    expect(dense?.radius).toBeLessThan(CELL_SPACING);
    // The same lattice point sits at the same place however dense it is.
    expect([dense?.x, dense?.y]).toEqual([thin?.x, thin?.y]);
  });

  it('leaves out a cell where the colony is too thin for one', () => {
    expect(
      cellBubble(3, 2, CELL_SPACING, field(CELL_MIN / 2), WIDTH, HEIGHT)
    ).toBeNull();
  });

  it('spaces the cells by the unit, so they are as big on a finer grid', () => {
    const base = cellBubble(3, 2, CELL_SPACING, field(1), WIDTH, HEIGHT);
    const fine = cellBubble(3, 2, CELL_SPACING * 2, field(1), WIDTH, HEIGHT);

    expect(fine?.radius).toBeCloseTo((base?.radius ?? 0) * 2);
    expect(fine?.x).toBeCloseTo((base?.x ?? 0) * 2);
  });
});

describe('createImageDataFromBacterias', () => {
  it('draws one pixel per bacterium in the colour of the colony', () => {
    const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);

    createImageDataFromBacterias(data, WIDTH, ORANGE, [
      { x: 3, y: 2, energy: gameBalance.maxEnergy },
    ]);

    const index = (2 * WIDTH + 3) * 4;
    expect(Array.from(data.slice(index, index + 4))).toEqual(ORANGE);
  });
});

describe('shimmerAt', () => {
  const target = { x: 50, y: 30 };

  it('runs its waves towards the crosshair', () => {
    const now = { timeSec: 1, target, unit: 1 };
    const later = { ...now, timeSec: 1.1 };
    // The waves travel 9 / 0.35 cells a second.
    const travelled = (9 / 0.35) * 0.1;

    expect(shimmerAt(80, 30, now)).toBeCloseTo(
      shimmerAt(80 - travelled, 30, later)
    );
    expect(shimmerAt(50, 0, now)).toBeCloseTo(shimmerAt(50, travelled, later));
  });

  it('is the same all around the crosshair', () => {
    const shimmer = { timeSec: 0.7, target, unit: 1 };

    expect(shimmerAt(40, 30, shimmer)).toBeCloseTo(shimmerAt(60, 30, shimmer));
    expect(shimmerAt(50, 20, shimmer)).toBeCloseTo(shimmerAt(50, 40, shimmer));
  });

  it('keeps the waves as wide on a finer grid', () => {
    const base = { timeSec: 0.4, target, unit: 1 };
    const fine = { timeSec: 0.4, target: { x: 100, y: 60 }, unit: 2 };

    expect(shimmerAt(170, 60, fine)).toBeCloseTo(shimmerAt(85, 30, base));
  });
});
