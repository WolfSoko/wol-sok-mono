import { generatedLevel, LEVELS } from '@wolsok/feat-shared-bacteria-engine';
import { arenaTheme } from './arena-theme';

describe('arena theme', () => {
  describe('of a generated level', () => {
    const id = 'gen:corridor:12345:4';

    it('borrows the look of a hand-made level of its style', () => {
      const family = generatedLevel(id)?.family ?? '';

      expect(LEVELS.some((level) => level.id === family)).toBe(true);
      expect(arenaTheme(id)).toBe(arenaTheme(family));
    });
  });
});
