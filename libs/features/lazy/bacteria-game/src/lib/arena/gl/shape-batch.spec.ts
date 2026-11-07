import { WEAPON_CODE, WEAPONS } from '@wolsok/feat-shared-bacteria-engine';
import { arenaTheme } from '../arena-theme';
import { JamDrop } from '../jam';
import { Motes } from '../motes';
import { MarkLayer } from '../weapon-fx';
import { DishAmbience } from '../ambience';
import {
  pushAmbience,
  pushDynamicWalls,
  pushMotes,
  pushWalls,
  pushForeground,
  pushWeaponMarks,
  SHAPE,
  SHAPE_STRIDE,
  ShapeBatch,
} from './shape-batch';

/** Where an instance keeps its kind, and after it the parameters `p0` to `p2`. */
const KIND_OFFSET = 12;
const PARAMS_OFFSET = 13;

/** The kind of every instance in the batch, in drawing order. */
function kinds(batch: ShapeBatch): number[] {
  const result: number[] = [];
  for (let i = 0; i < batch.count; i++) {
    result.push(batch.instances[i * SHAPE_STRIDE + KIND_OFFSET]);
  }
  return result;
}

/** The floats of one instance. */
function instance(batch: ShapeBatch, index: number): number[] {
  return Array.from(
    batch.instances.subarray(index * SHAPE_STRIDE, (index + 1) * SHAPE_STRIDE)
  );
}

/** The rect of one instance, as x, y, width and height. */
function rectOf(batch: ShapeBatch, index: number): number[] {
  return instance(batch, index).slice(0, 4);
}

/** The parameters `p0`, `p1` and `p2` of one instance. */
function paramsOf(batch: ShapeBatch, index: number): number[] {
  return instance(batch, index).slice(PARAMS_OFFSET);
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

describe('pushWalls', () => {
  const theme = arenaTheme('pistons');

  it('draws a wall with its two lit edges', () => {
    const batch = new ShapeBatch();

    pushWalls(batch, theme, [{ x: 0, y: 0, width: 8, height: 20 }]);

    expect(kinds(batch)).toEqual([SHAPE.rect, SHAPE.rect, SHAPE.rect]);
  });
});

describe('pushDynamicWalls', () => {
  const theme = arenaTheme('pistons');

  it('draws a closed gate striped and an open one outlined', () => {
    const batch = new ShapeBatch();

    pushDynamicWalls(batch, theme, new Motes(320, 140), [
      { x: 10, y: 10, width: 8, height: 20, solid: true, warning: 0 },
      { x: 30, y: 10, width: 8, height: 20, solid: false, warning: 0.5 },
    ]);

    expect(kinds(batch)).toEqual([SHAPE.hazard, SHAPE.rect, SHAPE.outline]);
  });
});

describe('pushMotes', () => {
  const theme = arenaTheme('pistons');

  it('draws one cell per drifting speck', () => {
    const batch = new ShapeBatch();
    const motes = new Motes(320, 140);
    motes.reset(theme);

    pushMotes(batch, theme, motes);

    expect(batch.count).toBe(theme.moteCount);
  });
});

describe('pushAmbience', () => {
  it('draws every bubble in view as film, rim and spot, in three rounds', () => {
    const batch = new ShapeBatch();
    const ambience = new DishAmbience(320, 180, () => 0.5);
    const view = { x: 0, y: 0, width: 320, height: 180 };
    let bubbles = 0;
    ambience.forEachBubble(view, () => bubbles++);

    pushAmbience(batch, ambience, view, 1 / 3);

    expect(bubbles).toBeGreaterThan(0);
    expect(kinds(batch)).toEqual([
      ...Array<number>(bubbles).fill(SHAPE.disc),
      ...Array<number>(bubbles).fill(SHAPE.ring),
      ...Array<number>(bubbles).fill(SHAPE.disc),
    ]);
  });

  it('draws no bubble out of view', () => {
    const batch = new ShapeBatch();
    const ambience = new DishAmbience(320, 180, () => 0.5);

    pushAmbience(
      batch,
      ambience,
      { x: 1000, y: 1000, width: 10, height: 10 },
      1 / 3
    );

    expect(batch.count).toBe(0);
  });
});

describe('pushForeground', () => {
  /** The base grid: a cell per base cell. */
  const BASE_UNIT = 1;

  const drop: JamDrop = {
    jam: { body: [200, 20, 55], light: [255, 120, 140] },
    x: 10,
    y: 10,
    radius: 3,
    halo: 0.5,
  };

  it('draws a drop of jam as halo, shadow, drop and highlight', () => {
    const batch = new ShapeBatch();

    pushForeground(batch, [drop], [], BASE_UNIT);

    expect(kinds(batch)).toEqual([
      SHAPE.disc,
      SHAPE.disc,
      SHAPE.jam,
      SHAPE.disc,
    ]);
  });

  it('packs the dark end of the jam gradient into the first parameter', () => {
    const batch = new ShapeBatch();

    pushForeground(batch, [drop], [], BASE_UNIT);

    // 200, 20, 55 darkened to 110, 11, 30.
    expect(paramsOf(batch, 2)[0]).toBe(110 * 65536 + 11 * 256 + 30);
  });

  it('rings a crosshair only while its boost runs', () => {
    const batch = new ShapeBatch();

    pushForeground(
      batch,
      [],
      [
        { x: 50, y: 50, color: [255, 0, 0, 255], boostLeft: null },
        { x: 90, y: 50, color: [0, 0, 255, 255], boostLeft: 0.5 },
      ],
      BASE_UNIT
    );

    expect(kinds(batch)).toEqual([
      SHAPE.rect,
      SHAPE.rect,
      SHAPE.rect,
      SHAPE.rect,
      SHAPE.ring,
    ]);
  });

  describe('on a grid of two cells per base cell', () => {
    /** Expected values below are worked out by hand for this unit. */
    const DOUBLE_UNIT = 2;

    /** Off the diagonal, so swapped coordinates show. */
    const offDiagonalDrop: JamDrop = { ...drop, y: 20 };

    it('widens the halo of a drop by the unit', () => {
      const batch = new ShapeBatch();

      pushForeground(batch, [offDiagonalDrop], [], DOUBLE_UNIT);

      // Radius 3 + (1.5 + 0.5) * 2 = 7 around (10, 20); 5 at the base unit.
      expect(rectOf(batch, 0)).toEqual([3, 13, 14, 14]);
    });

    it('keeps the shadow, the drop and its highlight as big as the drop', () => {
      const base = new ShapeBatch();
      const doubled = new ShapeBatch();

      pushForeground(base, [offDiagonalDrop], [], BASE_UNIT);
      pushForeground(doubled, [offDiagonalDrop], [], DOUBLE_UNIT);

      for (const index of [1, 2, 3]) {
        expect(rectOf(doubled, index)).toEqual(rectOf(base, index));
      }
    });

    it('draws the crosshair bars twice as long and thick', () => {
      const batch = new ShapeBatch();

      pushForeground(
        batch,
        [],
        [{ x: 50, y: 30, color: [255, 0, 0, 255], boostLeft: null }],
        DOUBLE_UNIT
      );

      expect(rectOf(batch, 0)).toEqual([38, 29, 26, 4]);
      expect(rectOf(batch, 1)).toEqual([49, 18, 4, 26]);
    });

    it('draws the boost ring twice as wide, with room for its line', () => {
      const batch = new ShapeBatch();

      pushForeground(
        batch,
        [],
        // A quarter left: an inverted boost would give another radius.
        [{ x: 90, y: 40, color: [0, 0, 255, 255], boostLeft: 0.25 }],
        DOUBLE_UNIT
      );

      const ring = 2;
      expect(kinds(batch)[ring]).toBe(SHAPE.ring);
      // Radius (9 + 4 * (1 - 0.25)) * 2 = 24, plus a unit of room: half 26.
      expect(rectOf(batch, ring)).toEqual([64, 14, 52, 52]);
      // The radius and the line width, 1.5 * 2.
      expect(paramsOf(batch, ring)).toEqual([24, 3, 0]);
    });
  });
});

describe('pushWeaponMarks', () => {
  it('turns each mark into an instance of its shape', () => {
    const layer = new MarkLayer();
    layer.add('glow', 10, 20, 4, [255, 255, 255], 0.5);
    layer.add('ring', 10, 20, 6, [255, 255, 255], 1).size = 2;
    const hex = layer.add('hex', 30, 40, 3, [0, 255, 0], 1);
    hex.size = 0.5;
    hex.angle = 0.25;
    const petal = layer.add('ellipse', 50, 50, 5, [255, 0, 0], 1);
    petal.size = 1;
    petal.angle = 1.5;
    const field = layer.add('field', 60, 30, 20, [0, 0, 255], 0.75);
    field.weapon = 'cryo-pulse';
    field.timeSec = 3;
    field.growth = 0.5;
    const batch = new ShapeBatch();

    pushWeaponMarks(batch, layer);

    expect(kinds(batch)).toEqual([
      SHAPE.glow,
      SHAPE.ring,
      SHAPE.hex,
      SHAPE.ellipse,
      SHAPE.field,
    ]);
    // A glow fills the square around its circle.
    expect(rectOf(batch, 0)).toEqual([6, 16, 8, 8]);
    // A ring has room for its line.
    expect(rectOf(batch, 1)).toEqual([2, 12, 16, 16]);
    expect(paramsOf(batch, 1)).toEqual([6, 2, 0]);
    // A hexagon: its turn, its line and its corners.
    expect(paramsOf(batch, 2)).toEqual([0.25, 0.5, 3]);
    // An ellipse turned any way fits the square of its long radius.
    expect(rectOf(batch, 3)).toEqual([45, 45, 10, 10]);
    expect(paramsOf(batch, 3)).toEqual([1.5, 5, 1]);
    // A field: the weapon, its clock and how far it has spread.
    expect(paramsOf(batch, 4)).toEqual([WEAPON_CODE['cryo-pulse'], 3, 0.5]);
    expect(instance(batch, 4)[7]).toBeCloseTo(0.75);
  });

  it("numbers each weapon's field as the simulation's shaders do", () => {
    const layer = new MarkLayer();
    for (const { id } of WEAPONS) {
      layer.add('field', 60, 30, 20, [0, 0, 255], 1).weapon = id;
    }
    const batch = new ShapeBatch();

    pushWeaponMarks(batch, layer);

    expect(WEAPONS.map((_, i) => paramsOf(batch, i)[0])).toEqual(
      WEAPONS.map(({ id }) => WEAPON_CODE[id])
    );
    expect(new Set(Object.values(WEAPON_CODE)).size).toBe(WEAPONS.length);
  });
});
