import { BALANCE_VERSION } from '../game-balance';
import { LADDER_VERSION } from '../difficulty-curve';
import {
  EVOLVED_REPLAY_VERSION,
  GHOST_REPLAY_VERSION,
  GPU_INT_REPLAY_VERSION,
  LADDER_REPLAY_VERSION,
  type PlaybackHeader,
  playbackRefusal,
  REPLAY_VERSION,
} from '../replay';
import { storedPlaybackOf, storedPlaybackRefusal } from './replay-playback';

const PLAIN: PlaybackHeader = {
  version: REPLAY_VERSION,
  balanceVersion: BALANCE_VERSION,
  simulation: 'cpu',
};

describe('storedPlaybackRefusal', () => {
  it.each<[string, PlaybackHeader]>([
    ['a playable plain match', PLAIN],
    [
      'a ladder match on the current ladder',
      {
        version: LADDER_REPLAY_VERSION,
        balanceVersion: BALANCE_VERSION,
        simulation: 'cpu',
        ladder: LADDER_VERSION,
      },
    ],
    [
      'a gpu-int match',
      {
        version: GPU_INT_REPLAY_VERSION,
        balanceVersion: BALANCE_VERSION,
        simulation: 'gpu-int',
      },
    ],
    ['another balance', { ...PLAIN, balanceVersion: BALANCE_VERSION - 1 }],
    ['the ghost format', { ...PLAIN, version: GHOST_REPLAY_VERSION }],
    ['an unknown format', { ...PLAIN, version: 0 }],
    ['a ruleset its format lacks', { ...PLAIN, simulation: 'gpu-int' }],
    ['an unknown ruleset', { ...PLAIN, simulation: 'quantum' }],
    [
      'another ladder',
      {
        version: LADDER_REPLAY_VERSION,
        balanceVersion: BALANCE_VERSION,
        simulation: 'cpu',
        ladder: LADDER_VERSION - 1,
      },
    ],
    [
      'the float GPU',
      { ...PLAIN, version: EVOLVED_REPLAY_VERSION, simulation: 'gpu' },
    ],
  ])('judges %s as its header would', (_, header) => {
    expect(storedPlaybackRefusal(storedPlaybackOf(header))).toBe(
      playbackRefusal(header)
    );
  });

  it('pins the refusals the table relies on', () => {
    expect(storedPlaybackRefusal(storedPlaybackOf(PLAIN))).toBeNull();
    expect(
      storedPlaybackRefusal(
        storedPlaybackOf({
          ...PLAIN,
          version: LADDER_REPLAY_VERSION,
          ladder: -1,
        })
      )
    ).toBe('ladder');
  });

  it('takes a record stored before the ladder was kept as the current ladder', () => {
    expect(
      storedPlaybackRefusal({
        replayVersion: LADDER_REPLAY_VERSION,
        balanceVersion: BALANCE_VERSION,
        simulation: 'cpu',
      })
    ).toBeNull();
  });

  it('stores the version as replayVersion, and no ladder for a header without one', () => {
    expect(storedPlaybackOf(PLAIN)).toEqual({
      balanceVersion: BALANCE_VERSION,
      replayVersion: REPLAY_VERSION,
      simulation: 'cpu',
    });
    expect(storedPlaybackOf(PLAIN)).not.toHaveProperty('ladder');
    expect(
      storedPlaybackOf({ ...PLAIN, version: LADDER_REPLAY_VERSION, ladder: 2 })
    ).toEqual(expect.objectContaining({ ladder: 2 }));
  });
});
