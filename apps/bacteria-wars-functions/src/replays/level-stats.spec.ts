import {
  generatedLevelId,
  type Replay,
  type ReplayHeader,
  TICKS_PER_SEC,
} from '@wolsok/feat-lazy-bac-game/engine';
import { FieldValue } from 'firebase-admin/firestore';
import { levelStatsCounts, levelStatsId, statsLevel } from './level-stats';

const one = FieldValue.increment(1);

function replay(
  header: Partial<ReplayHeader>,
  weapons: Replay['inputs']['weapons'] = []
): Replay {
  return {
    header: {
      levelId: 'quarantine',
      difficulty: 'normal',
      ticks: 90 * TICKS_PER_SEC,
      outcome: { endedBy: 'annihilation', winnerSeat: 0 },
      ...header,
    } as ReplayHeader,
    inputs: { steers: [], drags: [], boosts: [], weapons },
  };
}

describe('levelStatsId', () => {
  const header = (levelId: string, ladder?: number) =>
    ({
      levelId,
      difficulty: 'hard',
      balanceVersion: 12,
      ...(ladder === undefined ? {} : { ladder }),
    }) as ReplayHeader;

  it('keeps a ladder level by its id, per difficulty and computer', () => {
    expect(levelStatsId(header('quarantine', 1), 'computer')).toBe(
      'quarantine_hard_b12_l1'
    );
    expect(levelStatsId(header('quarantine'), 'computer')).toBe(
      'quarantine_hard_b12_l0'
    );
  });

  it('takes a generated level by its style and heat, daily and endless apart', () => {
    const levelId = generatedLevelId({
      recipe: 'cave',
      seed: 42,
      difficulty: 6,
    });
    expect(statsLevel(levelId, 'computer')).toBe('gen-cave-6');
    expect(statsLevel(levelId, 'daily')).toBe('daily-6');
    expect(statsLevel(levelId, 'endless')).toBe('endless-6');
  });
});

describe('levelStatsCounts', () => {
  it('counts a plain win, and how long it took', () => {
    expect(levelStatsCounts(replay({}))).toEqual({
      attempts: one,
      wins: one,
      plainWins: one,
      durations: { lt2m: one },
    });
  });

  it('counts a loss and a draw without a win', () => {
    expect(
      levelStatsCounts(
        replay({ outcome: { endedBy: 'time', winnerSeat: 1 }, ticks: 30 })
      )
    ).toEqual({ attempts: one, losses: one, durations: { lt1m: one } });
    expect(
      levelStatsCounts(
        replay({
          outcome: { endedBy: 'time', winnerSeat: null },
          ticks: 700 * TICKS_PER_SEC,
        })
      )
    ).toEqual({ attempts: one, draws: one, durations: { ge10m: one } });
  });

  it("counts a plain player's win as plain, whatever the ladder's computer brings", () => {
    const plain = { genes: {}, weapon: null } as never;
    const computer = { genes: {}, weapon: 'lysis' } as never;
    expect(levelStatsCounts(replay({ loadouts: [plain, computer] }))).toEqual({
      attempts: one,
      wins: one,
      plainWins: one,
      durations: { lt2m: one },
    });
  });

  it('counts an evolved win and the weapon carried', () => {
    const loadout = { genes: {}, weapon: 'lysis' } as never;
    expect(levelStatsCounts(replay({ loadouts: [loadout, loadout] }))).toEqual({
      attempts: one,
      wins: one,
      evolved: one,
      evolvedWins: one,
      durations: { lt2m: one },
      weapons: { lysis: one },
    });
  });
});
