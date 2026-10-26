import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BALANCE_VERSION } from './game-balance';
import { GPU_INT_REPLAY_VERSION, parseReplay, playReplay } from './replay';

/**
 * What the committed replay comes to, by balance version (ADR 0011). Bots
 * and neutral colonies are simulated again on playback, so any change to
 * how a tick plays - the bots, the neutral colonies, the levels, the maps,
 * the simulation - changes it. Such a change retires every stored replay:
 * raise `BALANCE_VERSION` (which `NET_VERSION` follows), play the fixture
 * again and add its result under the new version.
 */
const GOLDEN: Readonly<
  Record<
    number,
    { checksum: number; ticks: number; sizes: number[]; outcome: null }
  >
> = {
  5: { checksum: 196095863, ticks: 360, sizes: [1579, 1687], outcome: null },
  // The CPU's rules did not change with the gpu-int ruleset.
  6: { checksum: 196095863, ticks: 360, sizes: [1579, 1687], outcome: null },
};

/**
 * What the same fixture comes to on the `gpu-int` ruleset (ADR 0015), played
 * on `IntSimulation` - bit for bit what a GPU that passed the self-test
 * plays. It retires with the same changes, and with any change to the
 * integer passes too (see `golden-gpu-sim.json`).
 */
const GPU_INT_GOLDEN: Readonly<
  Record<
    number,
    { checksum: number; ticks: number; sizes: number[]; outcome: null }
  >
> = {
  6: { checksum: 3330364408, ticks: 360, sizes: [1500, 1975], outcome: null },
};

const FIXTURE = join(__dirname, 'golden-replay.json');

describe('the golden replay', () => {
  it('plays out as it did on this balance version', () => {
    const expected = GOLDEN[BALANCE_VERSION];
    if (expected === undefined) {
      throw new Error(
        `No golden result for BALANCE_VERSION ${BALANCE_VERSION}: play golden-replay.json and add one.`
      );
    }
    const fixture = parseReplay(JSON.parse(readFileSync(FIXTURE, 'utf8')));
    expect(fixture).not.toBeNull();
    if (fixture === null) {
      return;
    }

    // The fixture is played on the current balance, whatever it says.
    const result = playReplay({
      ...fixture,
      header: { ...fixture.header, balanceVersion: BALANCE_VERSION },
    });

    expect(result).toEqual(
      expect.objectContaining({
        checksum: expected.checksum,
        ticks: expected.ticks,
        outcome: expected.outcome,
      })
    );
    expect(result?.players.map((player) => player.bacteriaCount)).toEqual(
      expected.sizes
    );
  });
});

describe('the golden replay on the gpu-int ruleset', () => {
  it('plays out on IntSimulation as it did on this balance version', () => {
    const expected = GPU_INT_GOLDEN[BALANCE_VERSION];
    if (expected === undefined) {
      throw new Error(
        `No gpu-int golden result for BALANCE_VERSION ${BALANCE_VERSION}: play golden-replay.json as gpu-int and add one.`
      );
    }
    const fixture = parseReplay(JSON.parse(readFileSync(FIXTURE, 'utf8')));
    expect(fixture).not.toBeNull();
    if (fixture === null) {
      return;
    }

    const result = playReplay({
      ...fixture,
      header: {
        ...fixture.header,
        version: GPU_INT_REPLAY_VERSION,
        simulation: 'gpu-int',
        balanceVersion: BALANCE_VERSION,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        checksum: expected.checksum,
        ticks: expected.ticks,
        outcome: expected.outcome,
      })
    );
    expect(result?.players.map((player) => player.bacteriaCount)).toEqual(
      expected.sizes
    );
  });
});
