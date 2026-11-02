import {
  playReplay,
  type ReplayResult,
} from '@wolsok/feat-lazy-bac-game/engine';
import { dailyReplay } from '../testing/daily-replay';
import { TIMELINE_POINTS, verifyReplay } from './verify';

// A whole match takes long on IntSimulation: the engine's own specs
// (golden-replay) check what it plays; this checks what is compared.
jest.mock('@wolsok/feat-lazy-bac-game/engine', () => ({
  ...jest.requireActual('@wolsok/feat-lazy-bac-game/engine'),
  playReplay: jest.fn(),
}));

const played = (extra: Partial<ReplayResult> = {}) =>
  ({
    ticks: 3_600,
    checksum: 1,
    outcome: { winner: { id: 0 }, reason: 'annihilation' },
    players: [{ bacteriaCount: 40 }, { bacteriaCount: 0 }],
    samples: Array.from({ length: 1_000 }, (_, i) => [i, 1_000 - i]),
    ...extra,
  }) as unknown as ReplayResult;

describe('verifyReplay', () => {
  beforeEach(() => jest.mocked(playReplay).mockReset());

  it('verifies a replay that plays to its claimed end, and sums it up', () => {
    jest.mocked(playReplay).mockReturnValue(played());
    let t = 0;
    const verdict = verifyReplay(dailyReplay(), () => (t += 5));
    expect(verdict).toMatchObject({
      state: 'verified',
      ms: 5,
      summary: {
        ticks: 3_600,
        endedBy: 'annihilation',
        winnerSeat: 0,
        sizes: [40, 0],
      },
    });
    expect(verdict.summary?.timeline.length).toBeLessThanOrEqual(
      2 * TIMELINE_POINTS
    );
    expect(verdict.summary?.timeline.slice(0, 4)).toEqual([0, 1_000, 3, 997]);
  });

  it('cannot confirm another checksum, length or outcome', () => {
    for (const result of [
      played({ checksum: 2 }),
      played({ ticks: 3_599 }),
      played({ outcome: null }),
    ]) {
      jest.mocked(playReplay).mockReturnValue(result);
      expect(verifyReplay(dailyReplay()).state).toBe('unverified');
    }
    jest.mocked(playReplay).mockReturnValue(null);
    expect(verifyReplay(dailyReplay()).state).toBe('unverified');
  });

  it("judges the human's medallion in a match against the computer, never online", () => {
    const human = { id: 0, isBot: false, bacteriaCount: 40, lost: 0 };
    const bot = { id: 1, isBot: true, bacteriaCount: 0, lost: 99 };
    const match = (winner: typeof human | typeof bot) =>
      played({
        players: [human, bot],
        outcome: { winner, reason: 'annihilation' },
      } as never);
    jest.mocked(playReplay).mockReturnValue(match(human));
    expect(verifyReplay(dailyReplay()).medal).toEqual(expect.any(String));
    jest.mocked(playReplay).mockReturnValue(match(bot));
    const lost = { endedBy: 'annihilation', winnerSeat: 1 } as const;
    expect(verifyReplay(dailyReplay({ outcome: lost })).medal).toBeNull();
    jest.mocked(playReplay).mockReturnValue(match(human));
    expect(
      verifyReplay(dailyReplay({ mode: 'two-players' })).medal
    ).toBeUndefined();
  });

  it('never plays a replay of another balance table', () => {
    expect(verifyReplay(dailyReplay({ balanceVersion: 1 })).state).toBe(
      'balance-mismatch'
    );
    expect(playReplay).not.toHaveBeenCalled();
  });
});
