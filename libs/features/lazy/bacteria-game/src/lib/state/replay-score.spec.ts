import { TICKS_PER_SEC } from './fixed-tick';
import { SizeSample } from './match-engine';
import { replayScore } from './replay-score';

/** Samples for `seconds`, the sizes by seat from `at(second)`. */
function timeline(
  seconds: number,
  at: (second: number) => SizeSample
): SizeSample[] {
  return Array.from({ length: seconds }, (_, index) => at(index + 1));
}

const SHORT = 30 * TICKS_PER_SEC;

describe('replayScore', () => {
  it('scores a one-sided short match at nothing', () => {
    expect(
      replayScore({
        samples: timeline(30, (s) => [100 + s * 10, Math.max(0, 100 - s * 4)]),
        outcome: { endedBy: 'annihilation', winnerSeat: 0 },
        ticks: SHORT,
      })
    ).toEqual({ score: 0, reasons: [] });
  });

  it('finds a close finish by the share the loser held', () => {
    const { reasons } = replayScore({
      samples: timeline(30, () => [1000, 450]),
      outcome: { endedBy: 'hold', winnerSeat: 0 },
      ticks: SHORT,
    });

    expect(reasons).toEqual(['close']);
  });

  it('finds a close timed result within 10 %', () => {
    // 0.92 of the winner's colony - close either way; below 40 % it is not.
    expect(
      replayScore({
        samples: [[500, 460]],
        outcome: { endedBy: 'time', winnerSeat: 0 },
        ticks: SHORT,
      }).reasons
    ).toContain('close');
    expect(
      replayScore({
        samples: [[500, 0]],
        outcome: { endedBy: 'annihilation', winnerSeat: 0 },
        ticks: SHORT,
      }).reasons
    ).not.toContain('close');
  });

  it('finds a comeback after the first 20 seconds only', () => {
    const behindAt = (from: number) =>
      timeline(40, (s) =>
        s === from ? [100, 300] : s > 35 ? [400, 0] : [200, 200]
      );

    expect(
      replayScore({
        samples: behindAt(25),
        outcome: { endedBy: 'annihilation', winnerSeat: 0 },
        ticks: 40 * TICKS_PER_SEC,
      }).reasons
    ).toContain('comeback');
    expect(
      replayScore({
        samples: behindAt(10),
        outcome: { endedBy: 'annihilation', winnerSeat: 0 },
        ticks: 40 * TICKS_PER_SEC,
      }).reasons
    ).not.toContain('comeback');
  });

  it('counts three lead changes, ties keeping the lead', () => {
    const swings: SizeSample[] = [
      [10, 5],
      [5, 5],
      [5, 10],
      [10, 5],
    ];

    expect(
      replayScore({
        samples: swings,
        outcome: { endedBy: 'annihilation', winnerSeat: 0 },
        ticks: SHORT,
      }).reasons
    ).not.toContain('lead-changes');
    expect(
      replayScore({
        samples: [...swings, [5, 10], [5, 0]],
        outcome: { endedBy: 'annihilation', winnerSeat: 1 },
        ticks: SHORT,
      }).reasons
    ).toContain('lead-changes');
  });

  it('rewards a length between a minute and six', () => {
    const lasting = (seconds: number) =>
      replayScore({
        samples: [[10, 0]],
        outcome: { endedBy: 'annihilation', winnerSeat: 0 },
        ticks: seconds * TICKS_PER_SEC,
      }).reasons;

    expect(lasting(59)).not.toContain('length');
    expect(lasting(60)).toContain('length');
    expect(lasting(360)).toContain('length');
    expect(lasting(361)).not.toContain('length');
  });

  it('adds feats and agreed online matches, and caps the score at 100', () => {
    const everything = replayScore({
      samples: [
        ...timeline(25, () => [100, 300]),
        [300, 100],
        [100, 300],
        [300, 200],
      ],
      outcome: { endedBy: 'time', winnerSeat: 0 },
      ticks: 120 * TICKS_PER_SEC,
      online: true,
      feat: true,
    });

    expect(everything.reasons).toEqual([
      'close',
      'comeback',
      'lead-changes',
      'length',
      'feat',
      'online',
    ]);
    expect(everything.score).toBe(100);
  });
});
