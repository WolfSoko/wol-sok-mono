import type { Replay } from '@wolsok/feat-lazy-bac-game/engine';
import { Engine, loadEngine } from '../engine';
import {
  bytesOf,
  ladderComputerPlan,
  ladderPlan,
  recordedReplay,
} from '../testing/replays';
import { isFeat, rerunReplay, scoreOf, timeline } from './verify';

let engine: Engine;

beforeAll(async () => {
  engine = await loadEngine();
});

/** A replay as stored and read back - packed, deflated and parsed. */
async function stored(replay: Replay): Promise<Replay | null> {
  return engine.replayFromBytes(new Uint8Array(await bytesOf(replay)), {
    stored: true,
  });
}

describe('rerunReplay', () => {
  it('verifies a replay that plays out as recorded', async () => {
    const replay = await recordedReplay(await ladderPlan());
    const rerun = rerunReplay(engine, await stored(replay));
    expect(rerun.state).toBe('verified');
    expect(rerun.summary).toEqual({
      sizes: expect.any(Array),
      endedBy: 'forfeit',
      winnerSeat: 1,
      ticks: replay.header.ticks,
      timeline: {
        left: expect.any(Array),
        right: expect.any(Array),
      },
    });
    expect(rerun.summary?.timeline.left).toHaveLength(2);
    // A lost match against the computer earns no medallion.
    expect(rerun.medal).toBeNull();
  });

  it("verifies a match against the ladder's computer (replay version 4)", async () => {
    const replay = await recordedReplay(await ladderComputerPlan());
    expect(replay.header.version).toBe(engine.LADDER_REPLAY_VERSION);
    const rerun = rerunReplay(engine, await stored(replay));
    expect(rerun.state).toBe('verified');
    expect(rerun.summary?.ticks).toBe(replay.header.ticks);
  });

  it('judges the medallion of a won match against the computer', async () => {
    const replay = await recordedReplay(await ladderPlan());
    const won = {
      ...replay,
      header: {
        ...replay.header,
        outcome: { endedBy: 'forfeit' as const, winnerSeat: 0 },
      },
    };
    const rerun = rerunReplay(engine, await stored(won));
    expect(rerun.state).toBe('verified');
    // Won in 2 s without a boost and never smaller than the computer.
    expect(rerun.medal).toBe('platinum');
  });

  it('calls a replay whose checksum differs unverified, never more', async () => {
    const replay = await recordedReplay(await ladderPlan());
    const forged = {
      ...replay,
      header: { ...replay.header, checksum: (replay.header.checksum ?? 0) + 1 },
    };
    expect(rerunReplay(engine, await stored(forged)).state).toBe('unverified');
  });

  it('calls a claimed win the simulation did not reach unverified', async () => {
    const replay = await recordedReplay(await ladderPlan());
    const forged = {
      ...replay,
      header: {
        ...replay.header,
        outcome: { endedBy: 'annihilation' as const, winnerSeat: 0 },
      },
    };
    expect(rerunReplay(engine, await stored(forged)).state).toBe('unverified');
  });

  it('cannot play a replay of another balance', async () => {
    const replay = await recordedReplay(await ladderPlan());
    const old = {
      ...replay,
      header: { ...replay.header, balanceVersion: engine.BALANCE_VERSION - 1 },
    };
    expect(rerunReplay(engine, await stored(old)).state).toBe(
      'balance-mismatch'
    );
  });

  it('finds no replay in broken bytes', async () => {
    const rerun = rerunReplay(
      engine,
      await engine.replayFromBytes(new Uint8Array([1, 2, 3]), { stored: true })
    );
    expect(rerun).toEqual({ state: 'unverified', replay: null });
  });
});

describe('timeline', () => {
  it('keeps at most 360 samples per seat', () => {
    const samples = Array.from({ length: 1000 }, (_, i) => [i, 2 * i]);
    const { left, right } = timeline(samples);
    expect(left.length).toBeLessThanOrEqual(360);
    expect(right).toHaveLength(left.length);
    expect(left[0]).toBe(0);
  });
});

describe('scores and feats', () => {
  it('scores only a verified re-run', () => {
    expect(
      scoreOf(
        engine,
        { state: 'unverified', replay: null },
        {
          online: true,
          feat: true,
        }
      )
    ).toEqual({ score: 0, reasons: [] });
  });

  it('takes a feat only from a win against the computer on hard or a boss', () => {
    const rerun = {
      state: 'verified' as const,
      replay: null,
      lowestRatio: 0.8,
    };
    const doc = {
      kind: 'computer' as const,
      levelId: 'quarantine',
      difficulty: 'hard',
      winnerSeat: 0,
    };
    expect(isFeat(engine, doc, rerun)).toBe(true);
    expect(isFeat(engine, { ...doc, difficulty: 'normal' }, rerun)).toBe(
      engine.getLevel('quarantine').boss != null
    );
    expect(isFeat(engine, { ...doc, winnerSeat: 1 }, rerun)).toBe(false);
    expect(isFeat(engine, doc, { ...rerun, lowestRatio: 0.3 })).toBe(false);
    expect(isFeat(engine, { ...doc, kind: 'online' }, rerun)).toBe(false);
  });
});
