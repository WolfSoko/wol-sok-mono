import { Lockstep } from '../net/lockstep';
import { NetMessage } from '../net/net-message';
import { matchChecksum } from './checksum';
import { TICKS_PER_SEC } from './fixed-tick';
import { BALANCE_VERSION } from './game-balance';
import { MatchEngine } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import {
  EVOLVED_REPLAY_VERSION,
  GHOST_REPLAY_VERSION,
  isEvolvedReplay,
  LADDER_REPLAY_VERSION,
  MAX_TICKS,
  parseReplay,
  playReplay,
  Replay,
  replayOf,
  replayOutcome,
  REPLAY_VERSION,
} from './replay';
import { onlineReplayId, REPLAY_ID } from './replay-id';

const PLAN: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'vs-computer',
  difficulty: 'hard',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 140,
  seed: 1234,
};

/** Plays a match with a human who steers, drags and boosts. */
function record(
  plan: MatchPlan,
  ticks: number
): { engine: MatchEngine; replay: Replay } {
  const { spawns, options } = planMatch(plan);
  const engine = new MatchEngine(spawns, options);
  for (let tick = 0; tick < ticks && engine.outcome() == null; tick++) {
    engine.setSteering(0, tick < 60 ? { x: 1, y: 0.5 } : { x: 0, y: 0 });
    if (tick === 90) {
      engine.setDragTarget(0, 200, 30);
    }
    if (tick === 150) {
      engine.boost(0);
    }
    engine.tick(plan.width, plan.height);
  }
  return {
    engine,
    replay: replayOf(plan, 'cpu', engine.tickCount, engine.recorded),
  };
}

describe('replay', () => {
  it('plays a recorded match out the same', () => {
    const { engine, replay } = record(PLAN, 600);

    const result = playReplay(replay);

    // Only what changed: the push, letting go, the drag and the boost.
    expect(replay.inputs).toEqual({
      steers: [
        [0, 0, 1, 0.5],
        [60, 0, 0, 0],
      ],
      drags: [[90, 0, 200, 30]],
      boosts: [[150, 0]],
      weapons: [],
    });
    expect(result?.ticks).toBe(engine.tickCount);
    expect(result?.players).toEqual(engine.players);
  });

  it('plays a match against another seed out differently', () => {
    const { engine, replay } = record(PLAN, 300);

    const result = playReplay({
      ...replay,
      header: { ...replay.header, seed: PLAN.seed + 1 },
    });

    expect(result?.players).not.toEqual(engine.players);
  });

  it('plays a match with neutral colonies out the same', () => {
    const plan: MatchPlan = {
      ...PLAN,
      levelId: 'quarantine',
      width: 320,
      height: 180,
    };
    const { engine, replay } = record(plan, 300);

    const result = playReplay(replay);

    expect(result?.players).toEqual(engine.players);
    expect(result?.players).toHaveLength(2);
  });

  it('plays a match between two players out the same', () => {
    const plan: MatchPlan = { ...PLAN, mode: 'two-players', headStart: 1 };
    const { engine, replay } = record(plan, 300);

    expect(playReplay(replay)?.players).toEqual(engine.players);
  });

  it('refuses a replay it would not play out the same', () => {
    const { replay } = record(PLAN, 10);

    expect(
      playReplay({ ...replay, header: { ...replay.header, simulation: 'gpu' } })
    ).toBeNull();
    expect(
      playReplay({ ...replay, header: { ...replay.header, version: 0 } })
    ).toBeNull();
    expect(
      playReplay({
        ...replay,
        header: { ...replay.header, balanceVersion: BALANCE_VERSION + 1 },
      })
    ).toBeNull();
  });

  describe('parseReplay', () => {
    it('reads back what was stored', () => {
      const { replay } = record(PLAN, 120);

      expect(parseReplay(JSON.parse(JSON.stringify(replay)))).toEqual(replay);
    });

    it.each([
      ['no header', { inputs: { steers: [], drags: [], boosts: [] } }],
      ['an unknown level', { levelId: 'nowhere' }],
      ['an unknown colour', { colors: ['orange', 'mauve'] }],
      ['a broken seed', { seed: 1.5 }],
      ['an unknown simulation', { simulation: 'quantum' }],
      ['the same colour twice', { colors: ['orange', 'orange'] }],
      ['no grid', { width: 0 }],
      ['a grid too big to build', { width: 100_000 }],
      ['an endless match', { ticks: 2 ** 40 }],
    ])('refuses a replay with %s', (_, change) => {
      const { replay } = record(PLAN, 10);
      const damaged =
        'inputs' in change
          ? change
          : { ...replay, header: { ...replay.header, ...change } };

      expect(parseReplay(damaged)).toBeNull();
    });

    it('refuses damaged inputs', () => {
      const { replay } = record(PLAN, 10);

      expect(
        parseReplay({
          ...replay,
          inputs: { moves: [[1, 0, 'x', 2]], boosts: [] },
        })
      ).toBeNull();
      expect(
        parseReplay({ ...replay, inputs: { moves: [], boosts: [[1]] } })
      ).toBeNull();
    });
  });

  describe('version 2', () => {
    const ONLINE: MatchPlan = {
      ...PLAN,
      mode: 'two-players',
      width: 320,
      height: 180,
    };

    it('writes CPU matches as version 2, with the seats', () => {
      const { replay } = record(PLAN, 10);

      expect(replay.header.version).toBe(REPLAY_VERSION);
      expect(replay.header.seats).toEqual([{ isBot: false }, { isBot: true }]);
    });

    it('writes GPU matches as version 1, good for a ghost race only', () => {
      const { engine } = record(PLAN, 10);
      const replay = replayOf(PLAN, 'gpu', 10, engine.recorded);

      expect(replay.header.version).toBe(GHOST_REPLAY_VERSION);
      expect(replay.header.seats).toBeUndefined();
      expect(parseReplay(replay)).toEqual(replay);
      expect(playReplay(replay)).toBeNull();
    });

    it('reads back the whole header, the attempt with it', () => {
      const { engine } = record({ ...ONLINE, headStart: 0 }, 120);
      const replay = replayOf(
        ONLINE,
        'cpu',
        engine.tickCount,
        engine.recorded,
        {
          roomCode: 'K7QPXM',
          n: 3,
          outcome: { endedBy: 'forfeit', winnerSeat: 1 },
          checksum: matchChecksum(engine.players),
          client: '2026.10.23-rc.1',
          attempt: { id: 'd_2026-10-23_2', at: 1_761_220_000_000 },
        }
      );

      const parsed = parseReplay(JSON.parse(JSON.stringify(replay)), {
        stored: true,
      });

      expect(parsed).toEqual(replay);
      expect(parsed?.header.attempt).toEqual({
        id: 'd_2026-10-23_2',
        at: 1_761_220_000_000,
      });
    });

    it('still reads version 1 replays, as ghosts', () => {
      const { replay } = record(PLAN, 120);
      const { seats: _seats, ...plain } = replay.header;
      const v1 = { ...replay, header: { ...plain, version: 1 } };

      expect(parseReplay(v1)).toEqual(v1);
      expect(parseReplay(v1, { stored: true })).toBeNull();
    });

    it('refuses a GPU replay and one longer than an hour', () => {
      const { replay } = record(PLAN, 10);

      expect(
        parseReplay({
          ...replay,
          header: { ...replay.header, simulation: 'gpu' },
        })
      ).toBeNull();
      expect(
        parseReplay({
          ...replay,
          header: { ...replay.header, ticks: MAX_TICKS + 1 },
        })
      ).toBeNull();
    });

    it('stores only what was played on the online grid, with its outcome', () => {
      const { engine, replay } = record(PLAN, 10);
      const extras = {
        outcome: { endedBy: 'time' as const, winnerSeat: null },
        checksum: matchChecksum(engine.players),
      };
      const onGrid = replayOf(
        { ...PLAN, width: 320, height: 180 },
        'cpu',
        10,
        engine.recorded,
        extras
      );

      expect(parseReplay(onGrid, { stored: true })).toEqual(onGrid);
      // 320 x 140 is no level's online grid.
      expect(
        parseReplay(
          { ...replay, header: { ...replay.header, ...extras } },
          { stored: true }
        )
      ).toBeNull();
      expect(parseReplay(replay, { stored: true })).toBeNull();
      expect(parseReplay(replay)).toEqual(replay);
    });

    it.each([
      ['a bot seat that played', { boosts: [[3, 1]] }],
      [
        'two steers of a seat in one tick',
        {
          steers: [
            [2, 0, 1, 0],
            [2, 0, 0, 1],
          ],
        },
      ],
      ['a push off the grid', { steers: [[2, 0, 0.3, 0]] }],
      ['a push out of reach', { steers: [[2, 0, 4, 0]] }],
      ['a drag outside the arena', { drags: [[2, 0, 321, 0]] }],
      ['a drag off the grid', { drags: [[2, 0, 10.1, 0]] }],
      ['an input after the end', { boosts: [[11, 0]] }],
    ])('refuses inputs with %s', (_, change) => {
      const { replay } = record(PLAN, 10);

      expect(
        parseReplay({ ...replay, inputs: { ...replay.inputs, ...change } })
      ).toBeNull();
    });

    it.each([
      [
        'seats of another mode',
        { seats: [{ isBot: false }, { isBot: false }] },
      ],
      ['a room against the computer', { roomCode: 'K7QPXM', n: 1 }],
      ['a room without a match number', { roomCode: 'K7QPXM' }],
      ['a broken outcome', { outcome: { endedBy: 'boredom', winnerSeat: 0 } }],
      ['a broken checksum', { checksum: -1 }],
      ['a client too long', { client: 'x'.repeat(33) }],
      ['a broken attempt', { attempt: { id: '../x', at: 1 } }],
    ])('refuses a header with %s', (_, change) => {
      const { replay } = record(PLAN, 10);

      expect(
        parseReplay({ ...replay, header: { ...replay.header, ...change } })
      ).toBeNull();
    });

    it('returns the colony sizes of every second it played', () => {
      const { engine, replay } = record(PLAN, 2 * TICKS_PER_SEC + 5);

      const result = playReplay(replay);

      expect(result?.samples).toHaveLength(2);
      expect(result?.checksum).toBe(matchChecksum(engine.players));
    });

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
      expect(onlineReplayId('K7QPXM', 1, plan.seed)).toMatch(
        /^o_[0-9a-f]{16}$/
      );
    });
  });

  describe('onlineReplayId', () => {
    it('is the same for the same match, and another for any other', () => {
      const id = onlineReplayId('K7QPXM', 1, 42);

      expect(onlineReplayId('K7QPXM', 1, 42)).toBe(id);
      expect(onlineReplayId('K7QPXM', 2, 42)).not.toBe(id);
      expect(onlineReplayId('K7QPXN', 1, 42)).not.toBe(id);
      expect(onlineReplayId('K7QPXM', 1, 43)).not.toBe(id);
    });

    it('makes ids the stored replay id pattern takes, as `l_` ids are', () => {
      expect(REPLAY_ID.test(onlineReplayId('K7QPXM', 1, 42))).toBe(true);
      expect(REPLAY_ID.test('l_AbC123xyz')).toBe(true);
      expect(REPLAY_ID.test('o_123')).toBe(false);
      expect(REPLAY_ID.test('l_a/b')).toBe(false);
    });
  });

  describe('isEvolvedReplay', () => {
    it('is true for the versions that may carry evolution, 3 and 4', () => {
      expect(isEvolvedReplay({ version: GHOST_REPLAY_VERSION })).toBe(false);
      expect(isEvolvedReplay({ version: REPLAY_VERSION })).toBe(false);
      expect(isEvolvedReplay({ version: EVOLVED_REPLAY_VERSION })).toBe(true);
      expect(isEvolvedReplay({ version: LADDER_REPLAY_VERSION })).toBe(true);
      expect(isEvolvedReplay({ version: 99 })).toBe(false);
    });
  });
});
