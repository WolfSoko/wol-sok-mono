import { paintArenaBackground } from './arena-renderer';
import { arenaTheme } from './arena-theme';
import { LEVELS } from '../state/levels';

const WIDTH = 64;
const HEIGHT = 32;

function paint(levelId: string): Uint8ClampedArray {
  return paintArenaBackground(
    new Uint8ClampedArray(WIDTH * HEIGHT * 4),
    WIDTH,
    HEIGHT,
    arenaTheme(levelId)
  );
}

function brightness(data: Uint8ClampedArray, x: number, y: number): number {
  const index = (y * WIDTH + x) * 4;
  return data[index] + data[index + 1] + data[index + 2];
}

describe('paintArenaBackground', () => {
  it.each(LEVELS.map((level) => [level.name, level.id] as const))(
    '%s paints an opaque floor with a bright frame',
    (_name, levelId) => {
      const data = paint(levelId);

      for (let i = 3; i < data.length; i += 4) {
        expect(data[i]).toBe(255);
      }
      // The outermost ring stands out from the floor just inside it.
      expect(brightness(data, 0, HEIGHT / 2)).toBeGreaterThan(
        brightness(data, 4, HEIGHT / 2) + 60
      );
      expect(brightness(data, WIDTH / 2, HEIGHT - 1)).toBeGreaterThan(
        brightness(data, WIDTH / 2, HEIGHT - 5) + 60
      );
    }
  );

  it('paints the same floor every time', () => {
    expect(paint('serpentine')).toEqual(paint('serpentine'));
  });

  it('gives every level a look of its own', () => {
    const borders = new Set(
      LEVELS.map((level) => arenaTheme(level.id).border.join(','))
    );

    expect(borders.size).toBe(LEVELS.length);
  });
});
