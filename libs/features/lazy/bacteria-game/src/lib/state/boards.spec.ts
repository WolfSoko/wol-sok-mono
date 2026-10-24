import { defaultProfile } from '../social/profile';
import {
  atHourOf,
  BOARD_CUT,
  boardAvatar,
  boardTag,
  compareRows,
  BoardEntry,
  competitionRanks,
  countXp,
  dailyBoardId,
  dailySort,
  endlessSort,
  formatTag,
  isBoardId,
  onlineSort,
  parseBoardId,
  isVisible,
  posesAsLabel,
  showsName,
  TOP_ROWS,
  topRows,
  XP_FULL_COUNT,
  XP_FULL_COUNT_BEFORE,
  XpLedger,
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

  describe('top rows', () => {
    const entry = (
      entryId: string,
      sort: number,
      status: BoardEntry['status'],
      atHour = 0
    ): BoardEntry & { entryId: string } => ({
      entryId,
      sort,
      atHour,
      status,
      name: null,
      tag: boardTag(entryId),
      avatar: boardAvatar(entryId),
      show: { ticks: 0, won: true },
    });

    it('share positions between ties and leave hidden entries out', () => {
      const rows = topRows(
        [
          entry('d', 10, 'counted'),
          entry('b', 20, 'counted', 3),
          entry('h', 25, 'hidden'),
          entry('c', 20, 'counted', 1),
          entry('a', 30, 'counted'),
        ],
        0
      );
      expect(rows.map((row) => [row.entryId, row.pos])).toEqual([
        ['a', 1],
        ['c', 2],
        ['b', 2],
        ['d', 4],
      ]);
      expect(rows.every((row) => row.rank === undefined)).toBe(true);
    });

    it('rank verified entries among themselves, inside the cut only', () => {
      const rows = topRows(
        [
          entry('p', 100, 'provisional'),
          ...Array.from({ length: 12 }, (_, i) =>
            entry(`v${i}`, 90 - i, 'verified')
          ),
        ],
        BOARD_CUT.daily
      );
      expect(rows[0]).toMatchObject({ entryId: 'p', pos: 1 });
      expect(rows[0].rank).toBeUndefined();
      expect(rows[1]).toMatchObject({ entryId: 'v0', pos: 2, rank: 1 });
      expect(rows[10]).toMatchObject({ entryId: 'v9', rank: 10 });
      expect(rows[11].rank).toBeUndefined();
    });

    it('hold at most TOP_ROWS', () => {
      const entries = Array.from({ length: TOP_ROWS + 5 }, (_, i) =>
        entry(`e${i}`, i, 'counted')
      );
      expect(topRows(entries, 0)).toHaveLength(TOP_ROWS);
    });

    it('show names on checked entries only, and hidden ones never', () => {
      expect(showsName('counted')).toBe(true);
      expect(showsName('verified')).toBe(true);
      expect(showsName('provisional')).toBe(false);
      expect(showsName('stale')).toBe(false);
      expect(showsName('hidden')).toBe(false);
      expect(isVisible('stale')).toBe(true);
      expect(isVisible('hidden')).toBe(false);
    });
  });

  describe('XP ledger', () => {
    const HOUR = 3_600_000;
    const NOW = Date.UTC(2027, 0, 10, 12);
    const NEW_ACCOUNT = XP_FULL_COUNT_BEFORE + 1;

    it('counts a new account at the hourly cap', () => {
      expect(countXp(null, 9_000, NOW, NEW_ACCOUNT)).toEqual({
        counted: 2_000,
        claimed: 9_000,
        lastAt: NOW,
        firstAt: NOW,
        risenToday: 2_000,
        todayDay: '2027-01-10',
      });
    });

    it('counts a player from before the boards up to 25,000 at once', () => {
      const before = XP_FULL_COUNT_BEFORE - 1;
      expect(countXp(null, 40_000, NOW, before).counted).toBe(XP_FULL_COUNT);
      expect(countXp(null, 900, NOW, before).counted).toBe(900);
    });

    it('rises by 2,000 plus 3,000 an hour since the last change', () => {
      const first = countXp(null, 50_000, NOW, NEW_ACCOUNT);
      const later = countXp(first, 50_000, NOW + 2 * HOUR, NEW_ACCOUNT);
      expect(later.counted - first.counted).toBe(2_000 + 2 * 3_000);
    });

    it('never rises more than 20,000 gross in a UTC day', () => {
      let ledger: XpLedger = countXp(null, 0, NOW - 11 * HOUR, NEW_ACCOUNT);
      ledger = countXp(ledger, 100_000, NOW, NEW_ACCOUNT);
      expect(ledger.counted).toBe(20_000);
      // A fall gives no room back.
      ledger = countXp(ledger, 0, NOW + HOUR, NEW_ACCOUNT);
      expect(ledger.counted).toBe(0);
      ledger = countXp(ledger, 100_000, NOW + 2 * HOUR, NEW_ACCOUNT);
      expect(ledger.counted).toBe(0);
      // The next day starts over.
      ledger = countXp(ledger, 100_000, NOW + 14 * HOUR, NEW_ACCOUNT);
      expect(ledger.counted).toBeGreaterThan(0);
      expect(ledger.todayDay).toBe('2027-01-11');
    });

    it('follows a reset progress down, and keeps the time while nothing rises', () => {
      const first = countXp(null, 1_500, NOW, NEW_ACCOUNT);
      expect(countXp(first, 200, NOW + HOUR, NEW_ACCOUNT).counted).toBe(200);
      const same = countXp(first, 1_500, NOW + HOUR, NEW_ACCOUNT);
      expect(same.lastAt).toBe(first.lastAt);
    });

    it('takes whole XP only', () => {
      expect(() => countXp(null, 1.5, NOW, NEW_ACCOUNT)).toThrow(RangeError);
    });
  });
});
