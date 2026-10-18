import { gameBalance } from '../state/game-balance';
import { Point } from '../state/geometry';
import { Bacteria } from '../state/player.model';
import {
  colonyDensity,
  createImageDataFromBacterias,
  paintSlime,
  shimmerAt,
  SLIME_SCALE,
} from './colony-renderer';

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

function slime(bacterias: Bacteria[], shimmerTimeSec: number | null = null) {
  const target: Point = { x: 30, y: 10 };
  const cells = WIDTH * HEIGHT;
  const density = new Float32Array(cells);
  const heat = new Float32Array(cells);
  const hot = colonyDensity(
    density,
    heat,
    new Float32Array(cells),
    WIDTH,
    HEIGHT,
    bacterias
  );
  const data = new Uint8ClampedArray(cells * SLIME_SCALE * SLIME_SCALE * 4);
  paintSlime(
    data,
    density,
    hot ? heat : null,
    WIDTH,
    HEIGHT,
    ORANGE,
    shimmerTimeSec == null ? null : { timeSec: shimmerTimeSec, target, unit: 1 }
  );
  return data;
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

  it('lights a boosted colony up', () => {
    const plain = slime(blob(20, 10, 6));
    const boosted = slime(blob(20, 10, 6), 0.3);
    const brightness = (data: Uint8ClampedArray) =>
      data.reduce(
        (sum, value, index) => (index % 4 === 3 ? sum : sum + value),
        0
      );

    expect(brightness(boosted)).toBeGreaterThan(brightness(plain));
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
