import { Lockstep } from './lockstep';
import { NetMessage } from './net-message';
import {
  matchChecksum,
  MatchEngine,
  MatchPlan,
  onlineReplayId,
  parseReplay,
  planMatch,
  playReplay,
  replayOf,
  replayOutcome,
} from '@wolsok/feat-shared-bacteria-engine';

const ONLINE: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'two-players',
  difficulty: 'hard',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 180,
  seed: 1234,
};

describe('an online replay', () => {
  it('plays an online match back from both seats as recorded', () => {
    const plan: MatchPlan = { ...ONLINE, seed: 777 };
    const outbox: NetMessage[] = [];
    const host = new Lockstep(0, (message) => outbox.push(message));
    // The guest's device only sends here: its inputs reach the host.
    const guest = new Lockstep(1, (message) => {
      if (message.k === 'in') {
        host.putRemote(message.t, message);
      }
    });
    const { spawns, options } = planMatch(plan, null, {
      seat: 0,
      drivers: host.drivers(),
    });
    const engine = new MatchEngine(spawns, options);
    const ticks = 240;
    for (let tick = 0; tick < ticks && engine.outcome() == null; tick++) {
      const angle = tick / 20;
      guest.putLocal(
        tick,
        { x: Math.cos(angle), y: Math.sin(angle) },
        null,
        tick === 100
      );
      host.putLocal(
        tick,
        tick < 50 ? { x: 1, y: 1 } : { x: 0, y: 0 },
        tick === 120 ? { x: 200.3, y: 61.9 } : null,
        tick === 80
      );
      expect(host.ready(tick)).toBe(true);
      engine.tick(plan.width, plan.height);
    }
    const checksum = matchChecksum(engine.players);
    const replay = replayOf(plan, 'cpu', engine.tickCount, engine.recorded, {
      roomCode: 'K7QPXM',
      n: 1,
      outcome: replayOutcome(engine.outcome()) ?? {
        endedBy: 'forfeit',
        winnerSeat: 0,
      },
      checksum,
    });

    const stored = parseReplay(JSON.parse(JSON.stringify(replay)), {
      stored: true,
    });
    const result = stored === null ? null : playReplay(stored);

    expect(stored).toEqual(replay);
    expect(replay.inputs.steers.some(([, seat]) => seat === 1)).toBe(true);
    expect(replay.inputs.drags).toEqual([[120 + 6, 0, 200.25, 62]]);
    expect(result?.checksum).toBe(checksum);
    expect(result?.outcome).toEqual(engine.outcome());
    expect(result?.ticks).toBe(engine.tickCount);
    expect(onlineReplayId('K7QPXM', 1, plan.seed)).toMatch(/^o_[0-9a-f]{16}$/);
  });
});
