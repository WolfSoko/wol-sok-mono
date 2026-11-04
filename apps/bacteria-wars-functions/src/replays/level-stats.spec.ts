import {
  arenaSize,
  type ReplayHeader,
  type SimResolution,
  TICKS_PER_SEC,
} from '@wolsok/feat-shared-bacteria-engine';
import { FieldValue } from 'firebase-admin/firestore';
import { levelStatsCounts, levelStatsId, levelStatsKey } from './level-stats';

const one = FieldValue.increment(1);

const header = (fields: Partial<ReplayHeader>) =>
  ({
    levelId: 'quarantine',
    difficulty: 'normal',
    ticks: 90 * TICKS_PER_SEC,
    outcome: { endedBy: 'annihilation', winnerSeat: 0 },
    ...fields,
  }) as ReplayHeader;

describe('levelStatsKey', () => {
  const header = (
    levelId: string,
    ladder?: number,
    arena: { width: number; height: number } = arenaSize('normal')
  ) =>
    ({
      levelId,
      difficulty: 'hard',
      balanceVersion: 12,
      ...arena,
      ...(ladder === undefined ? {} : { ladder }),
    }) as ReplayHeader;

  it('keeps a ladder level by its id, per difficulty and computer', () => {
    expect(
      levelStatsId(levelStatsKey(header('quarantine', 1), 'computer'))
    ).toBe('quarantine_hard_b12_l1_gnormal');
    expect(levelStatsKey(header('quarantine'), 'computer')).toEqual({
      level: 'quarantine',
      difficulty: 'hard',
      balanceVersion: 12,
      ladder: 0,
      grid: 'normal',
    });
  });

  it('counts each simulation resolution apart, its grid in the id', () => {
    const id = (grid: SimResolution) =>
      levelStatsId(
        levelStatsKey(header('quarantine', 1, arenaSize(grid)), 'computer')
      );
    expect(id('normal')).toBe('quarantine_hard_b12_l1_gnormal');
    expect(id('low')).toBe('quarantine_hard_b12_l1_glow');
    expect(id('high')).toBe('quarantine_hard_b12_l1_ghigh');
    expect(id('ultra')).toBe('quarantine_hard_b12_l1_gultra');
    expect(
      levelStatsKey(header('quarantine', 1, arenaSize('ultra')), 'computer')
        .grid
    ).toBe('ultra');
  });

  it('keeps the online grid of balance version 7 under its id from before the split', () => {
    const key = levelStatsKey(header('quarantine', 1), 'computer');
    expect(levelStatsId({ ...key, balanceVersion: 7 })).toBe(
      'quarantine_hard_b7_l1'
    );
    expect(levelStatsId({ ...key, balanceVersion: 7, grid: 'high' })).toBe(
      'quarantine_hard_b7_l1_ghigh'
    );
  });

  it('refuses an arena that is no grid of its level', () => {
    expect(() =>
      levelStatsKey(
        header('quarantine', 1, { width: 320, height: 140 }),
        'computer'
      )
    ).toThrow('320x140 is no grid of quarantine');
  });

  it('takes a generated level by its recipe and difficulty, daily and endless apart', () => {
    const level = (kind: 'computer' | 'daily' | 'endless') =>
      levelStatsKey(header('gen:cave:42:6'), kind).level;
    expect(level('computer')).toBe('gen-cave-6');
    expect(level('daily')).toBe('daily-cave-6');
    expect(level('endless')).toBe('endless-cave-6');
  });
});

describe('levelStatsCounts', () => {
  it('counts a plain win, and how long it took', () => {
    expect(levelStatsCounts(header({}))).toEqual({
      attempts: one,
      wins: one,
      plainWins: one,
      durations: { lt2m: one },
    });
  });

  it('counts a loss and a draw without a win', () => {
    expect(
      levelStatsCounts(
        header({ outcome: { endedBy: 'time', winnerSeat: 1 }, ticks: 30 })
      )
    ).toEqual({ attempts: one, losses: one, durations: { lt1m: one } });
    expect(
      levelStatsCounts(
        header({
          outcome: { endedBy: 'time', winnerSeat: null },
          ticks: 700 * TICKS_PER_SEC,
        })
      )
    ).toEqual({ attempts: one, draws: one, durations: { ge10m: one } });
  });

  it("counts a plain player's win as plain, whatever the ladder's computer brings", () => {
    const plain = { genes: {}, weapon: null } as never;
    const computer = { genes: {}, weapon: 'lysis' } as never;
    expect(levelStatsCounts(header({ loadouts: [plain, computer] }))).toEqual({
      attempts: one,
      wins: one,
      plainWins: one,
      durations: { lt2m: one },
    });
  });

  it('counts an evolved win and the weapon carried', () => {
    const loadout = { genes: {}, weapon: 'lysis' } as never;
    expect(levelStatsCounts(header({ loadouts: [loadout, loadout] }))).toEqual({
      attempts: one,
      wins: one,
      evolved: one,
      evolvedWins: one,
      durations: { lt2m: one },
      weapons: { lysis: one },
    });
  });
});
