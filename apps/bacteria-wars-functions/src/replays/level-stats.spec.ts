import {
  generatedLevelId,
  type Replay,
  type ReplayHeader,
  TICKS_PER_SEC,
} from '@wolsok/feat-lazy-bac-game/engine';
import { FieldValue } from 'firebase-admin/firestore';
import { levelStatsCounts, levelStatsId } from './level-stats';

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
  it('keeps a ladder level by its id, per difficulty', () => {
    expect(
      levelStatsId({ levelId: 'quarantine', difficulty: 'hard' }, 'computer')
    ).toBe('quarantine_hard');
  });

  it('takes a generated level by its style and heat, daily and endless apart', () => {
    const levelId = generatedLevelId({
      recipe: 'cave',
      seed: 42,
      difficulty: 6,
    });
    const header = { levelId, difficulty: 'easy' };
    expect(levelStatsId(header, 'computer')).toBe('gen-cave-6_easy');
    expect(levelStatsId(header, 'daily')).toBe('daily-6_easy');
    expect(levelStatsId(header, 'endless')).toBe('endless-6_easy');
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
