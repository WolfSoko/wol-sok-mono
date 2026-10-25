import {
  type ReplayHeader,
  TICKS_PER_SEC,
} from '@wolsok/feat-lazy-bac-game/engine';
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
  const header = (levelId: string, ladder?: number) =>
    ({
      levelId,
      difficulty: 'hard',
      balanceVersion: 12,
      ...(ladder === undefined ? {} : { ladder }),
    }) as ReplayHeader;

  it('keeps a ladder level by its id, per difficulty and computer', () => {
    expect(
      levelStatsId(levelStatsKey(header('quarantine', 1), 'computer'))
    ).toBe('quarantine_hard_b12_l1');
    expect(levelStatsKey(header('quarantine'), 'computer')).toEqual({
      level: 'quarantine',
      difficulty: 'hard',
      balanceVersion: 12,
      ladder: 0,
    });
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
