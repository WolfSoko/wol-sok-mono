import { arenaTheme } from '../../arena/arena-theme';
import { levelMusic, LEVEL_MUSIC } from '../../sound/level-music';
import { getMap } from '../game-maps';
import { getLevel, isLevelId, LEVELS } from '../levels';
import { Rect, stampRect } from '../maps';
import {
  generatedLevel,
  generatedLevelId,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  parseGeneratedId,
} from './generate-level';
import { checkLayout, isPlayable } from './layout-check';
import { RECIPE_IDS } from './recipes';

const WIDTH = 320;
const HEIGHT = 180;

function walls(id: string): Rect[] {
  return generatedLevel(id)?.map.createWalls(WIDTH, HEIGHT) ?? [];
}

function grid(rects: readonly Rect[]): Uint8Array {
  const cells = new Uint8Array(WIDTH * HEIGHT);
  for (const rect of rects) {
    stampRect(cells, WIDTH, HEIGHT, rect, 1);
  }
  return cells;
}

describe('generated levels', () => {
  describe('ids', () => {
    it('name the recipe, the seed and the difficulty, and read back', () => {
      const id = generatedLevelId({
        recipe: 'cave',
        seed: 4096,
        difficulty: 7,
      });

      expect(id).toBe('gen:cave:4096:7');
      expect(parseGeneratedId(id)).toEqual({
        recipe: 'cave',
        seed: 4096,
        difficulty: 7,
      });
    });

    it.each([
      'corridors',
      'gen:maze:1:5',
      'gen:cave:1:0',
      'gen:cave:1:11',
      'gen:cave:99999999999:5',
      'gen:cave:-1:5',
      'gen:cave:1:5:extra',
    ])('refuse %s', (id) => {
      expect(parseGeneratedId(id)).toBeNull();
      expect(generatedLevel(id)).toBeNull();
    });
  });

  describe.each(RECIPE_IDS)('the %s recipe', (recipe) => {
    it.each([MIN_DIFFICULTY, 5, MAX_DIFFICULTY])(
      'lays out a playable arena at difficulty %i, whatever the seed',
      (difficulty) => {
        for (let seed = 1; seed <= 20; seed++) {
          const layout = walls(generatedLevelId({ recipe, seed, difficulty }));

          expect(layout.length).toBeGreaterThan(0);
          expect(isPlayable(checkLayout(layout, WIDTH, HEIGHT))).toBe(true);
        }
      }
    );

    it('mirrors the arena through its centre', () => {
      const cells = grid(
        walls(generatedLevelId({ recipe, seed: 3, difficulty: 5 }))
      );

      for (let index = 0; index < cells.length; index++) {
        expect(cells[cells.length - 1 - index]).toBe(cells[index]);
      }
    });

    it('lays out the same arena for the same seed, another for another', () => {
      const id = generatedLevelId({ recipe, seed: 77, difficulty: 5 });
      const other = generatedLevelId({ recipe, seed: 78, difficulty: 5 });

      expect(walls(id)).toEqual(walls(id));
      expect(grid(walls(id))).not.toEqual(grid(walls(other)));
    });
  });

  it('tightens the rules and the medallions with the difficulty', () => {
    const calm = getLevel('gen:field:5:1');
    const frantic = getLevel('gen:field:5:10');

    expect(frantic.balance?.aggression).toBeGreaterThan(
      calm.balance?.aggression ?? 0
    );
    expect(frantic.medal.silverSec).toBeLessThan(calm.medal.silverSec);
    expect(frantic.crosshairSpeed).toBeGreaterThan(calm.crosshairSpeed ?? 0);
  });

  describe('as a level of the game', () => {
    const id = 'gen:corridor:12345:4';

    it('is a level with a name, a map and its own tune', () => {
      const level = getLevel(id);

      expect(isLevelId(id)).toBe(true);
      expect(level.id).toBe(id);
      expect(level.name).toMatch(/^\w+ \w+$/);
      expect(getMap(level.mapId).createWalls(640, 360).length).toBeGreaterThan(
        0
      );
      expect(levelMusic(id).seed).toBe(12345);
    });

    it('borrows the look and the sound of a hand-made level of its style', () => {
      const family = generatedLevel(id)?.family ?? '';

      expect(LEVELS.some((level) => level.id === family)).toBe(true);
      expect(arenaTheme(id)).toBe(arenaTheme(family));
      expect(levelMusic(id)).toEqual({ ...LEVEL_MUSIC[family], seed: 12345 });
    });
  });
});

describe('checkLayout', () => {
  it('finds no way through a wall from edge to edge', () => {
    const report = checkLayout(
      [{ x: 150, y: 0, width: 20, height: HEIGHT }],
      WIDTH,
      HEIGHT
    );

    expect(report.detour).toBeNull();
    expect(isPlayable(report)).toBe(false);
  });

  it('finds a start spot taken by a wall', () => {
    const report = checkLayout(
      [{ x: 75, y: 85, width: 10, height: 10 }],
      WIDTH,
      HEIGHT
    );

    expect(report.spawnsFree).toBe(false);
  });

  it('measures how far round the walls the way goes', () => {
    const open = checkLayout([], WIDTH, HEIGHT);

    expect(open.detour).toBe(1);
    expect(open.wallShare).toBe(0);
  });
});
