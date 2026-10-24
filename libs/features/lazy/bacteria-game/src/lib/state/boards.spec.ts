import { defaultProfile } from '../social/profile';
import {
  atHourOf,
  BOARD_CUT,
  boardAvatar,
  boardTag,
  compareRows,
  competitionRanks,
  dailyBoardId,
  dailySort,
  endlessSort,
  formatTag,
  isBoardId,
  onlineSort,
  parseBoardId,
  posesAsLabel,
  XP_FULL_COUNT_BEFORE,
  xpRiseCap,
  xpSort,
} from './boards';
import { MAX_TICKS } from './replay';

/** True when every score beats the next one. */
function descending(sorts: number[]): boolean {
  return sorts.every((sort, i) => i === 0 || sorts[i - 1] > sort);
}

describe('boards', () => {
  describe('ids', () => {
    it('names the all-time boards by kind and a daily one by its day', () => {
      expect(parseBoardId('xp')).toEqual({ kind: 'xp' });
      expect(parseBoardId('online')).toEqual({ kind: 'online' });
      expect(parseBoardId('endless')).toEqual({ kind: 'endless' });
      expect(dailyBoardId('2026-10-23')).toBe('daily-2026-10-23');
      expect(parseBoardId('daily-2026-10-23')).toEqual({
        kind: 'daily',
        day: '2026-10-23',
      });
    });

    it('refuses anything else, and days that do not exist', () => {
      for (const id of [
        'daily',
        'daily-',
        'daily-2026-02-30',
        'daily-2026-13-01',
        'daily-26-10-23',
        'XP',
        'endless-2026-10-23',
        '',
      ]) {
        expect(isBoardId(id)).toBe(false);
      }
      expect(() => dailyBoardId('2026-02-30')).toThrow(RangeError);
    });
  });

  describe('scores', () => {
    it('rank XP as it is', () => {
      expect(xpSort(0)).toBe(0);
      expect(xpSort(12_345)).toBe(12_345);
      expect(() => xpSort(-1)).toThrow(RangeError);
      expect(() => xpSort(1.5)).toThrow(RangeError);
    });

    it('rank online by wins, then by fewer losses', () => {
      expect(onlineSort(42, 17)).toBe(42 * 1e6 + (1e6 - 1 - 17));
      expect(
        descending([
          onlineSort(3, 0),
          onlineSort(3, 1),
          onlineSort(2, 0),
          onlineSort(0, 0),
          onlineSort(0, 5),
        ])
      ).toBe(true);
      // Losses past the span all score alike, never into the wins.
      expect(onlineSort(1, 5_000_000)).toBe(onlineSort(1, 999_999));
      expect(onlineSort(1, 999_999)).toBeGreaterThan(onlineSort(0, 0));
    });

    it('rank a daily win above every loss, faster wins and longer losses first', () => {
      expect(dailySort(true, 3_600)).toBe(1e7 + MAX_TICKS - 3_600);
      expect(dailySort(false, 3_600)).toBe(3_600);
      expect(
        descending([
          dailySort(true, 1_000),
          dailySort(true, 2_000),
          dailySort(true, MAX_TICKS),
          dailySort(false, MAX_TICKS),
          dailySort(false, 100),
          dailySort(false, 0),
        ])
      ).toBe(true);
      expect(() => dailySort(true, MAX_TICKS + 1)).toThrow(RangeError);
    });

    it('rank endless by depth, then by fewer seconds', () => {
      expect(endlessSort(5, 600)).toBe(5 * 1e7 + (1e7 - 1 - 600));
      expect(
        descending([
          endlessSort(6, 9_000),
          endlessSort(5, 300),
          endlessSort(5, 301),
          endlessSort(1, 0),
          endlessSort(0, 0),
        ])
      ).toBe(true);
      expect(endlessSort(1, 1e9)).toBe(endlessSort(1, 1e7 - 1));
    });

    it('stay safe integers below 2^53, refusing what would not fit', () => {
      const big = [
        xpSort(Number.MAX_SAFE_INTEGER),
        onlineSort(9_000_000_000, 0),
        dailySort(true, 0),
        endlessSort(900_000_000, 0),
      ];
      for (const sort of big) {
        expect(Number.isSafeInteger(sort)).toBe(true);
        expect(sort).toBeLessThan(2 ** 53);
      }
      expect(() => onlineSort(10_000_000_000, 0)).toThrow(RangeError);
      expect(() => endlessSort(1_000_000_000, 0)).toThrow(RangeError);
    });

    it('order ties by the hour reached, then by entry id', () => {
      const rows = [
        { entryId: 'b', sort: 5, atHour: atHourOf(Date.UTC(2026, 9, 23, 9)) },
        { entryId: 'c', sort: 7, atHour: 10 },
        { entryId: 'a', sort: 5, atHour: atHourOf(Date.UTC(2026, 9, 23, 9)) },
        { entryId: 'd', sort: 5, atHour: 1 },
      ];

      expect([...rows].sort(compareRows).map((row) => row.entryId)).toEqual([
        'c',
        'd',
        'a',
        'b',
      ]);
      expect(atHourOf(Date.UTC(2026, 9, 23, 9, 59))).toBe(
        Date.UTC(2026, 9, 23, 9) / 3_600_000
      );
    });

    it('share ranks between ties (1, 2, 2, 4)', () => {
      expect(competitionRanks([9, 7, 7, 3, 3, 3, 1])).toEqual([
        1, 2, 2, 4, 4, 4, 7,
      ]);
      expect(competitionRanks([])).toEqual([]);
    });
  });

  describe('cuts', () => {
    it('verify the top 10 of daily and endless only', () => {
      expect(BOARD_CUT).toEqual({ xp: 0, online: 0, daily: 10, endless: 10 });
    });
  });

  describe('names', () => {
    it('derives a four-digit tag and a preset avatar from the entry id', () => {
      const tag = boardTag('Xy7Qp2LmN0aBcDeFgHiJ');

      expect(tag).toBe(boardTag('Xy7Qp2LmN0aBcDeFgHiJ'));
      expect(tag).toBeGreaterThanOrEqual(0);
      expect(tag).toBeLessThan(10_000);
      expect(formatTag(42)).toBe('0042');
      expect(formatTag(4821)).toBe('4821');
      expect(boardAvatar('Xy7Qp2LmN0aBcDeFgHiJ')).toBeLessThan(12);
      expect(new Set(['a', 'b', 'c', 'd', 'e'].map(boardTag)).size).toBe(5);
    });

    it('spots names posing as a label or a default name', () => {
      for (const name of [
        'Anonymous #4821',
        'anonym #12',
        'ANONYMOUS 0042',
        'Player 1234',
        ' player #0001 ',
        defaultProfile('some-uid').name,
      ]) {
        expect(posesAsLabel(name)).toBe(true);
      }
      for (const name of [
        'Ada',
        'Anonymous Coward',
        'Player One',
        'Player 12345',
      ]) {
        expect(posesAsLabel(name)).toBe(false);
      }
    });
  });

  describe('XP caps', () => {
    it('rise by 2,000 plus 3,000 an hour, at most 20,000 a day', () => {
      expect(xpRiseCap(0, 0)).toBe(2_000);
      expect(xpRiseCap(1, 0)).toBe(5_000);
      expect(xpRiseCap(0.5, 0)).toBe(3_500);
      expect(xpRiseCap(24, 0)).toBe(20_000);
      expect(xpRiseCap(24, 18_000)).toBe(2_000);
      expect(xpRiseCap(24, 20_000)).toBe(0);
      expect(xpRiseCap(24, 25_000)).toBe(0);
      expect(xpRiseCap(-3, 0)).toBe(2_000);
    });

    it('count in full only for progress from before the boards', () => {
      expect(Number.isSafeInteger(XP_FULL_COUNT_BEFORE)).toBe(true);
      expect(new Date(XP_FULL_COUNT_BEFORE).toISOString()).toMatch(
        /T00:00:00\.000Z$/
      );
    });
  });
});
