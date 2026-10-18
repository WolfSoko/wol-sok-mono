import { arenaSize, renderScale, scaleRect } from './arena-size';
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
