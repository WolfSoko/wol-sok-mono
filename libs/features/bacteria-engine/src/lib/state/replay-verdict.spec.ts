import { recordedReplay } from '../../testing/recorded-replay';
import * as replayModule from './replay';
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
  const played = replayModule.playReplay(ended);

  it('verifies a replay that plays to its claimed end', () => {
    // The cases below each change one field of exactly this end.
    expect(header.outcome).toEqual({ endedBy: 'annihilation', winnerSeat: 1 });

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
    // Only the header changes: the re-run is the one the verified case
    // played, so this checks the comparison without playing again.
    const play = jest.spyOn(replayModule, 'playReplay').mockReturnValue(played);

    const verdict = replayVerdict(tampered(ended, change));

    expect(verdict).toEqual({ state: 'unverified', result: played });
    play.mockRestore();
  });

  it('cannot confirm a match that had not ended when it was recorded', () => {
    // Given up after 90 ticks: the device claims a forfeit the re-run cannot see.
    expect(replayVerdict(recordedReplay()).state).toBe('unverified');
  });

  it('never plays a replay of another balance table', () => {
    const play = jest.spyOn(replayModule, 'playReplay');

    expect(
      replayVerdict(
        tampered(ended, { balanceVersion: header.balanceVersion - 1 })
      )
    ).toEqual({ state: 'balance-mismatch' });
    expect(play).not.toHaveBeenCalled();
    play.mockRestore();
  });

  it('calls a replay of another balance table a mismatch, whatever else is wrong', () => {
    const play = jest.spyOn(replayModule, 'playReplay');

    expect(
      replayVerdict(
        tampered(ended, {
          balanceVersion: header.balanceVersion - 1,
          simulation: 'gpu',
        })
      )
    ).toEqual({ state: 'balance-mismatch' });
    expect(play).not.toHaveBeenCalled();
    play.mockRestore();
  });

  it.each<[string, Partial<ReplayHeader>]>([
    ['the float GPU', { simulation: 'gpu' }],
    ['an unknown format', { version: 0 }],
    ['another ladder computer', { ladder: -1 }],
  ])('cannot play a replay of %s', (_, change) => {
    expect(replayVerdict(tampered(ended, change))).toEqual({
      state: 'unplayable',
    });
  });
});
