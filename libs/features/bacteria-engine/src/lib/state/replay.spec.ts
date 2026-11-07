import { matchChecksum } from './checksum';
import { arenaSize, SIM_RESOLUTIONS } from './arena-size';
import { TICKS_PER_SEC } from './fixed-tick';
import { BALANCE_VERSION } from './game-balance';
import { MatchEngine } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import {
  canPlayBack,
  EVOLVED_REPLAY_VERSION,
  GHOST_REPLAY_VERSION,
  GPU_INT_REPLAY_VERSION,
  MAX_TICKS,
  parseReplay,
  playbackRefusal,
  type PlaybackRefusal,
  playReplay,
  Replay,
  replayEngine,
  replayOf,
  replayRun,
  REPLAY_VERSION,
  savedRegardless,
  simGridOf,
} from './replay';
import { onlineReplayId } from './replay-id';

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

  it('saves online and ranked matches whatever the settings say', () => {
    const header = replayOf(PLAN, 'cpu', 10, {
      steers: [],
      drags: [],
      boosts: [],
      weapons: [],
    }).header;
    expect(savedRegardless(header)).toBe(false);
    expect(savedRegardless({ ...header, roomCode: 'ABCD', n: 1 })).toBe(true);
    expect(
      savedRegardless({
        ...header,
        attempt: { id: 'd_2026-10-26_1', at: 0 },
      })
    ).toBe(true);
  });

  describe('playbackRefusal', () => {
    const { replay } = record(PLAN, 10);
    const { header } = replay;

    it('lets a recorded match play back', () => {
      expect(playbackRefusal(replay)).toBeNull();
    });

    it.each<[string, Partial<Replay['header']>, PlaybackRefusal]>([
      [
        'another balance table',
        { balanceVersion: BALANCE_VERSION + 1 },
        'balance',
      ],
      ['the ghost format', { version: GHOST_REPLAY_VERSION }, 'format'],
      ['an unknown format', { version: 0 }, 'format'],
      // The recorded match is format 2, which records `cpu` only.
      ['a ruleset its format lacks', { simulation: 'gpu-int' }, 'ruleset'],
      ['another ladder computer', { ladder: -1 }, 'ladder'],
      // A format that records the float GPU, so only the GPU refuses it.
      [
        'the float GPU',
        { version: EVOLVED_REPLAY_VERSION, simulation: 'gpu' },
        'gpu',
      ],
      [
        'another balance table in an unknown format',
        { balanceVersion: BALANCE_VERSION - 1, version: 0 },
        'balance',
      ],
    ])('refuses %s', (_, change, refusal) => {
      const other = { ...replay, header: { ...header, ...change } };

      expect(playbackRefusal(other)).toBe(refusal);
      expect(canPlayBack(other)).toBe(false);
    });
  });

  describe('canPlayBack, replayEngine and replayRun', () => {
    it('tell what plays back, as playReplay does', () => {
      const { replay } = record(PLAN, 10);
      const refused = [
        { ...replay.header, simulation: 'gpu' as const },
        { ...replay.header, version: GHOST_REPLAY_VERSION },
        { ...replay.header, balanceVersion: BALANCE_VERSION + 1 },
        { ...replay.header, ladder: -1 },
      ].map((header) => ({ ...replay, header }));

      expect(canPlayBack(replay)).toBe(true);
      for (const other of refused) {
        expect(canPlayBack(other)).toBe(false);
        expect(replayEngine(other)).toBeNull();
        expect(replayRun(other)).toBeNull();
        expect(playReplay(other)).toBeNull();
      }
    });

    it('give a run that plays the match as recorded, tick by tick', () => {
      const { engine, replay } = record(PLAN, 400);
      const seconds: unknown[] = [];

      const run = replayRun(replay, {
        onSecond: (sizes) => seconds.push(sizes),
      });
      expect(run).not.toBeNull();
      try {
        while (run !== null && !run.over) {
          run.advance(1);
        }
        expect(run?.result()).toMatchObject({
          ticks: engine.tickCount,
          checksum: matchChecksum(engine.players),
        });
        expect(seconds).toHaveLength(Math.floor(400 / TICKS_PER_SEC));
      } finally {
        run?.dispose();
      }
    });
  });

  describe('replayRun on a GPU that fails to set up', () => {
    it('plays on IntSimulation, tells it once and asks the GPU no more', () => {
      const { replay } = record(PLAN, 60);
      const gpuInt = {
        ...replay,
        header: {
          ...replay.header,
          simulation: 'gpu-int' as const,
          version: GPU_INT_REPLAY_VERSION,
        },
      };
      const straight = replayRun(gpuInt);
      const factory = jest.fn(() => {
        throw new Error('Incomplete render target');
      });
      const failures: unknown[] = [];
      const run = replayRun(gpuInt, {
        gpuInt: factory,
        onGpuFailure: (error) => failures.push(error),
      });
      if (run === null || straight === null) {
        throw new Error('The replay did not play');
      }
      try {
        run.advance(30);
        run.seek(10);
        run.advance(Infinity);
        straight.advance(10);

        expect(failures).toHaveLength(1);
        expect(factory).toHaveBeenCalledTimes(1);
        expect(run.result().checksum).toBe(straight.result().checksum);
      } finally {
        run.dispose();
        straight.dispose();
      }
    });
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

    it('reads back the whole header of a gpu-int match, the attempt with it', () => {
      const { engine } = record({ ...ONLINE, headStart: 0 }, 120);
      const replay = replayOf(
        ONLINE,
        'gpu-int',
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

    it('takes a ranked attempt on the gpu-int ruleset only', () => {
      const { engine } = record({ ...ONLINE, headStart: 0 }, 60);
      const extras = {
        outcome: { endedBy: 'forfeit' as const, winnerSeat: 1 },
        checksum: matchChecksum(engine.players),
        attempt: { id: 'd_2026-10-23_2', at: 1_761_220_000_000 },
      };
      const of = (simulation: 'cpu' | 'gpu-int') =>
        JSON.parse(
          JSON.stringify(
            replayOf(
              ONLINE,
              simulation,
              engine.tickCount,
              engine.recorded,
              extras
            )
          )
        ) as unknown;

      expect(parseReplay(of('cpu'), { stored: true })).toBeNull();
      expect(parseReplay(of('gpu-int'), { stored: true })?.header).toEqual(
        expect.objectContaining({
          version: GPU_INT_REPLAY_VERSION,
          simulation: 'gpu-int',
        })
      );
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

    it.each(SIM_RESOLUTIONS.map(({ id }) => id))(
      'stores a match at simulation resolution "%s", with its outcome',
      (grid) => {
        const plan = { ...PLAN, ...arenaSize(grid) };
        const { engine, replay } = record(plan, 10);
        const stored = replayOf(plan, 'cpu', 10, engine.recorded, {
          outcome: { endedBy: 'time', winnerSeat: null },
          checksum: matchChecksum(engine.players),
        });

        expect(simGridOf(plan)).toBe(grid);
        expect(parseReplay(stored, { stored: true })).toEqual(stored);
        // Without its outcome it is no replay to keep.
        expect(parseReplay(replay, { stored: true })).toBeNull();
      }
    );

    it('stores nothing on an arena no simulation resolution has', () => {
      const { engine, replay } = record(PLAN, 10);
      const extras = {
        outcome: { endedBy: 'time' as const, winnerSeat: null },
        checksum: matchChecksum(engine.players),
      };

      // 320 x 140 is no grid of the level.
      expect(simGridOf(PLAN)).toBeNull();
      expect(
        parseReplay(
          { ...replay, header: { ...replay.header, ...extras } },
          { stored: true }
        )
      ).toBeNull();
      expect(parseReplay(replay)).toEqual(replay);
    });

    it('stores an online match only on the online grid, the one it is played on', () => {
      const high = { ...ONLINE, ...arenaSize('high') };
      const { engine } = record(high, 10);
      const online = replayOf(high, 'cpu', 10, engine.recorded, {
        roomCode: 'K7QPXM',
        n: 1,
        outcome: { endedBy: 'time', winnerSeat: null },
        checksum: matchChecksum(engine.players),
      });

      expect(parseReplay(online, { stored: true })).toBeNull();
      expect(parseReplay(online)).toEqual(online);
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
  });

  describe('onlineReplayId', () => {
    it('is the same for the same match, and another for any other', () => {
      const id = onlineReplayId('K7QPXM', 1, 42);

      expect(onlineReplayId('K7QPXM', 1, 42)).toBe(id);
      expect(onlineReplayId('K7QPXM', 2, 42)).not.toBe(id);
      expect(onlineReplayId('K7QPXN', 1, 42)).not.toBe(id);
      expect(onlineReplayId('K7QPXM', 1, 43)).not.toBe(id);
    });
  });
});
