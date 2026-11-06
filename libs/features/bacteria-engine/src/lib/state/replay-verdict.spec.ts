import { recordedReplay } from '../../testing/recorded-replay';
import { type Replay, type ReplayHeader } from './replay';
import { replayVerdict } from './replay-verdict';

/** The replay with its header changed as `change` says. */
function tampered(replay: Replay, change: Partial<ReplayHeader>): Replay {
  return { ...replay, header: { ...replay.header, ...change } };
}

describe('replayVerdict', () => {
  // The human stands still, so the computer wipes them out after some 500
  // ticks: a match that ends, as the device recorded it.
  const ended = recordedReplay('meltdown', 600);
  const { header } = ended;

  it('verifies a replay that plays to its claimed end', () => {
    expect(header.outcome?.endedBy).toBe('annihilation');

    expect(replayVerdict(ended)).toMatchObject({
      state: 'verified',
      outcome: header.outcome,
      result: { ticks: header.ticks, checksum: header.checksum },
    });
  });

  it.each<[string, Partial<ReplayHeader>]>([
    ['another checksum', { checksum: (header.checksum ?? 0) + 1 }],
    ['another length', { ticks: header.ticks - 1 }],
    ['another way it ended', { outcome: { endedBy: 'time', winnerSeat: 1 } }],
    ['another winner', { outcome: { endedBy: 'annihilation', winnerSeat: 0 } }],
    ['no claimed outcome', { outcome: undefined }],
  ])('cannot confirm %s', (_, change) => {
    const verdict = replayVerdict(tampered(ended, change));

    expect(verdict.state).toBe('unverified');
    expect(verdict).toHaveProperty('result');
  });

  it('cannot confirm a match that had not ended when it was recorded', () => {
    // Given up after 90 ticks: the device claims a forfeit the re-run cannot see.
    expect(replayVerdict(recordedReplay()).state).toBe('unverified');
  });

  it('never plays a replay of another balance table', () => {
    expect(
      replayVerdict(
        tampered(ended, { balanceVersion: header.balanceVersion - 1 })
      )
    ).toEqual({ state: 'balance-mismatch' });
  });

  it.each<[string, Partial<ReplayHeader>]>([
    ['the float GPU', { simulation: 'gpu' }],
    ['an unknown format', { version: 0 }],
  ])('cannot play a replay of %s', (_, change) => {
    expect(replayVerdict(tampered(ended, change))).toEqual({
      state: 'unplayable',
    });
  });
});
