import { BALANCE_VERSION } from './game-balance';
import { MatchEngine } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import { parseReplay, playReplay, Replay, replayOf } from './replay';

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
});
