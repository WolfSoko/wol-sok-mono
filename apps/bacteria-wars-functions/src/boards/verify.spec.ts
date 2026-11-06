import {
  type ReplayResult,
  replayVerdict,
  type ReplayVerdict,
} from '@wolsok/feat-shared-bacteria-engine';
import { dailyReplay } from '../testing/daily-replay';
import { TIMELINE_POINTS, verifyReplay } from './verify';

// A whole match takes long on IntSimulation: the engine's own specs
// (replay-verdict, golden-replay) check how it judges and plays; this
// checks what the boards keep of the verdict.
jest.mock('@wolsok/feat-shared-bacteria-engine', () => ({
  ...jest.requireActual('@wolsok/feat-shared-bacteria-engine'),
  replayVerdict: jest.fn(),
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

const verified = (result = played(), winnerSeat = 0): ReplayVerdict => ({
  state: 'verified',
  result,
  outcome: { endedBy: 'annihilation', winnerSeat },
});

describe('verifyReplay', () => {
  beforeEach(() => jest.mocked(replayVerdict).mockReset());

  it('sums up a verified replay and times the re-run', () => {
    jest.mocked(replayVerdict).mockReturnValue(verified());
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

  it.each<[string, ReplayVerdict, string]>([
    ['unverified', { state: 'unverified', result: played() }, 'unverified'],
    ['unplayable', { state: 'unplayable' }, 'unverified'],
    ['balance-mismatch', { state: 'balance-mismatch' }, 'balance-mismatch'],
  ])('stores the engine verdict %s as %s', (_, engine, state) => {
    jest.mocked(replayVerdict).mockReturnValue(engine);
    let t = 0;
    expect(verifyReplay(dailyReplay(), () => (t += 3))).toEqual({
      state,
      ms: 3,
    });
  });

  it("judges the human's medallion in a match against the computer, never online", () => {
    const human = { id: 0, isBot: false, bacteriaCount: 40, lost: 0 };
    const bot = { id: 1, isBot: true, bacteriaCount: 0, lost: 99 };
    const match = (winner: typeof human | typeof bot) =>
      played({
        players: [human, bot],
        outcome: { winner, reason: 'annihilation' },
      } as never);
    jest.mocked(replayVerdict).mockReturnValue(verified(match(human)));
    expect(verifyReplay(dailyReplay()).medal).toEqual(expect.any(String));
    jest.mocked(replayVerdict).mockReturnValue(verified(match(bot), 1));
    const lost = { endedBy: 'annihilation', winnerSeat: 1 } as const;
    expect(verifyReplay(dailyReplay({ outcome: lost })).medal).toBeNull();
    jest.mocked(replayVerdict).mockReturnValue(verified(match(human)));
    expect(
      verifyReplay(dailyReplay({ mode: 'two-players' })).medal
    ).toBeUndefined();
  });
});
