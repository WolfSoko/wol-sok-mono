import { arenaTheme } from '../arena-theme';
import { JamDrop } from '../colony-renderer';
import { Motes } from '../motes';
import {
  pushBackground,
  pushForeground,
  SHAPE,
  SHAPE_STRIDE,
  ShapeBatch,
} from './shape-batch';

/** The kind of every instance in the batch, in drawing order. */
function kinds(batch: ShapeBatch): number[] {
  const result: number[] = [];
  for (let i = 0; i < batch.count; i++) {
    result.push(batch.instances[i * SHAPE_STRIDE + 12]);
  }
  return result;
}

describe('ShapeBatch', () => {
  it('packs a rect, two colours, the kind and its parameters', () => {
    const batch = new ShapeBatch();

    batch.push(
      SHAPE.ring,
      { x: 1, y: 2, width: 3, height: 4 },
      [255, 0, 51],
      0.5,
      [0, 255, 0],
      0.25,
      7,
      1.5
    );

    const expected = [
      1,
      2,
      3,
      4,
      1,
      0,
      0.2,
      0.5,
      0,
      1,
      0,
      0.25,
      SHAPE.ring,
      7,
      1.5,
      0,
    ];
    // Float32 storage: 51 / 255 is only nearly 0.2.
    Array.from(batch.instances).forEach((value, index) =>
      expect(value).toBeCloseTo(expected[index], 6)
    );
  });

  it('grows past its first buffer and starts over on clear', () => {
    const batch = new ShapeBatch();
    for (let i = 0; i < 1000; i++) {
      batch.push(SHAPE.rect, { x: i, y: 0, width: 1, height: 1 }, [0, 0, 0]);
    }

    expect(batch.count).toBe(1000);
    expect(batch.instances[999 * SHAPE_STRIDE]).toBe(999);

    batch.clear();
    expect(batch.instances.length).toBe(0);
  });
});

describe('pushBackground', () => {
  const theme = arenaTheme('pistons');

  it('draws a wall with its two lit edges, a closed gate striped and an open one outlined', () => {
    const batch = new ShapeBatch();
    const motes = new Motes(320, 140);

    pushBackground(
      batch,
      theme,
      motes,
      [{ x: 0, y: 0, width: 8, height: 20 }],
      [
        { x: 10, y: 10, width: 8, height: 20, solid: true, warning: 0 },
        { x: 30, y: 10, width: 8, height: 20, solid: false, warning: 0.5 },
      ]
    );

    expect(kinds(batch)).toEqual([
      SHAPE.rect,
      SHAPE.rect,
      SHAPE.rect,
      SHAPE.hazard,
      SHAPE.rect,
      SHAPE.outline,
    ]);
  });

  it('draws one cell per drifting speck', () => {
    const batch = new ShapeBatch();
    const motes = new Motes(320, 140);
    motes.reset(theme);

    pushBackground(batch, theme, motes, [], []);

    expect(batch.count).toBe(theme.moteCount);
  });
});

describe('pushForeground', () => {
  const drop: JamDrop = {
    jam: { body: [200, 20, 55], light: [255, 120, 140] },
    x: 10,
    y: 10,
    radius: 3,
    halo: 0.5,
  };

  it('draws a drop of jam as halo, shadow, drop and highlight', () => {
    const batch = new ShapeBatch();

    pushForeground(batch, [drop], []);

    expect(kinds(batch)).toEqual([
      SHAPE.disc,
      SHAPE.disc,
      SHAPE.jam,
      SHAPE.disc,
    ]);
  });

  it('packs the dark end of the jam gradient into the first parameter', () => {
    const batch = new ShapeBatch();

    pushForeground(batch, [drop], []);

    // 200, 20, 55 darkened to 110, 11, 30.
    expect(batch.instances[2 * SHAPE_STRIDE + 13]).toBe(
      110 * 65536 + 11 * 256 + 30
    );
  });

  it('rings a crosshair only while its boost runs', () => {
    const batch = new ShapeBatch();

    pushForeground(
      batch,
      [],
      [
        { x: 50, y: 50, color: [255, 0, 0, 255], boostLeft: null },
        { x: 90, y: 50, color: [0, 0, 255, 255], boostLeft: 0.5 },
      ]
    );

    expect(kinds(batch)).toEqual([
      SHAPE.rect,
      SHAPE.rect,
      SHAPE.rect,
      SHAPE.rect,
      SHAPE.ring,
    ]);
  });
});
