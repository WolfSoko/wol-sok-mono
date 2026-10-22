import {
  arenaSize,
  detailScale,
  renderScale,
  scaleOf,
  scaleRect,
} from './arena-size';
import { getLevel, gridScale, levelBalance, levelSize } from './levels';
import { GAME_MAPS } from './game-maps';
import { coversCell, Rect } from './maps';

/** The cells a wall covers that its mirror image does not. */
function asymmetricCells(walls: Rect[], width: number, height: number) {
  const solid = (x: number, y: number) =>
    walls.some((wall) => coversCell(wall, x, y));
  const cells: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (solid(x, y) !== solid(width - 1 - x, height - 1 - y)) {
        cells.push(`${x}:${y}`);
      }
    }
  }
  return cells;
}

describe('arena size', () => {
  it('makes a bigger map bigger, not finer', () => {
    expect(arenaSize('normal', 2)).toEqual({ width: 640, height: 360 });
    expect(arenaSize('ultra', 2)).toEqual({ width: 1280, height: 720 });
    // As many cells per base cell as a base map on the same grid.
    expect(scaleOf(1280, 2)).toBe(scaleOf(640));
  });

  it('draws a bigger map on the canvas of a base map, its zones as fine', () => {
    expect(
      arenaSize('normal', 2).width * renderScale('normal', 'medium', 2)
    ).toBe(960);
    expect(detailScale('normal', 'medium', 2)).toBe(
      renderScale('normal', 'medium')
    );
    // Up to a layer the GPU takes.
    expect(1280 * detailScale('ultra', 'full-hd', 4)).toBeLessThanOrEqual(4096);
  });

  it('gives a bigger map room for more bacteria, the rest as on a base map', () => {
    const expanse = getLevel('expanse');
    expect(levelSize(expanse)).toBe(2);
    expect(gridScale(expanse, 640)).toBe(1);

    const big = levelBalance(expanse, 1);
    const base = levelBalance({ ...expanse, mapId: 'open-field' }, 1);
    expect(big.maxBacteriaPerPlayer).toBe(4 * base.maxBacteriaPerPlayer);
    expect(big.maxTotalBacteria).toBe(4 * base.maxTotalBacteria);
    expect(big.startBacteriaRadius).toBe(base.startBacteriaRadius);
    expect(big.nutrientRadius).toBe(base.nutrientRadius);
  });

  it('lays a bigger map out on its own base, the same on every grid', () => {
    const expanse = GAME_MAPS.find(({ id }) => id === 'expanse');
    const base = expanse?.createWalls(640, 360) ?? [];
    const ultra = expanse?.createWalls(1280, 720) ?? [];

    expect(base.length).toBeGreaterThan(10);
    expect(ultra).toHaveLength(base.length);
    expect(ultra[0].x).toBe(base[0].x * 2);
  });

  it('keeps the arena 16:9 and on whole cells at every resolution', () => {
    expect(arenaSize('low')).toEqual({ width: 256, height: 144 });
    expect(arenaSize('normal')).toEqual({ width: 320, height: 180 });
    expect(arenaSize('high')).toEqual({ width: 480, height: 270 });
    expect(arenaSize('ultra')).toEqual({ width: 640, height: 360 });
  });

  it('draws the arena at the canvas width that is asked for', () => {
    for (const sim of ['low', 'normal', 'high', 'ultra'] as const) {
      expect(arenaSize(sim).width * renderScale(sim, 'full-hd')).toBe(1920);
      expect(arenaSize(sim).width * renderScale(sim, 'medium')).toBe(960);
    }
  });

  it('grows a rect on whole cells and keeps its other fields', () => {
    expect(
      scaleRect({ x: 3, y: 4, width: 5, height: 6, round: true }, 2)
    ).toEqual({ x: 6, y: 8, width: 10, height: 12, round: true });
  });

  it.each(['low', 'high', 'ultra'] as const)(
    'keeps every map point symmetric on the %s grid',
    (resolution) => {
      const { width, height } = arenaSize(resolution);
      for (const map of GAME_MAPS) {
        const walls = [
          ...map.createWalls(width, height),
          ...(map.createDynamicWalls?.(width, height, 1.3) ?? []),
        ];
        expect({
          map: map.id,
          cells: asymmetricCells(walls, width, height),
        }).toEqual({ map: map.id, cells: [] });
      }
    }
  );
});
