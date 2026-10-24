import { TICKS_PER_SEC } from './fixed-tick';
import { GhostController, GhostInputs, SeatDriver } from './ghost';
import { MatchEngine, MatchOptions, SizeSample } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import { replayOf } from './replay';

const PLAN: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'two-players',
  difficulty: 'normal',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 180,
  seed: 99,
};

/** A seat driven tick by tick from a script, as the lockstep drives one. */
function scripted(script: (tick: number) => Partial<GhostInputs>): SeatDriver {
  return {
    before: (tick) => ({
      boost: false,
      drag: null,
      steer: null,
      weapon: false,
      ...script(tick),
    }),
  };
}

/** Both seats of an online-style match, each scripted. */
function drivers(): Map<number, SeatDriver> {
  return new Map([
    [
      0,
      scripted((tick) => ({
        steer: tick < 30 ? { x: 1, y: 0 } : { x: 0, y: 0 },
        boost: tick === 40,
      })),
    ],
    [
      1,
      scripted((tick) => ({
        steer: { x: 0, y: 0 },
        drag: tick === 10 ? { x: 100, y: 50.25 } : null,
      })),
    ],
  ]);
}

function play(options: Partial<MatchOptions>, ticks: number): MatchEngine {
  const { spawns, options: planned } = planMatch(PLAN);
  const engine = new MatchEngine(spawns, { ...planned, ...options });
  for (let tick = 0; tick < ticks; tick++) {
    engine.tick(PLAN.width, PLAN.height);
  }
  return engine;
}

describe('MatchEngine recording', () => {
  it('records the seats it is told to, as their drivers played them', () => {
    const engine = play(
      { ghosts: drivers(), recordedSeats: new Set([0, 1]) },
      60
    );

    expect(engine.recorded).toEqual({
      steers: [
        [0, 0, 1, 0],
        [30, 0, 0, 0],
      ],
      drags: [[10, 1, 100, 50.25]],
      boosts: [[40, 0]],
      weapons: [],
    });
  });

  it('records no driven seat it is not told to - a ghost race ghost', () => {
    const engine = play({ ghosts: drivers() }, 60);

    expect(engine.recorded).toEqual({
      steers: [],
      drags: [],
      boosts: [],
      weapons: [],
    });
  });

  it('never records a bot, even when told to', () => {
    const { spawns, options } = planMatch({ ...PLAN, mode: 'vs-computer' });
    const engine = new MatchEngine(spawns, {
      ...options,
      recordedSeats: new Set([0, 1]),
    });
    for (let tick = 0; tick < 120; tick++) {
      engine.tick(PLAN.width, PLAN.height);
    }

    expect(
      [
        ...engine.recorded.steers,
        ...engine.recorded.drags,
        ...engine.recorded.boosts,
      ].filter(([, seat]) => seat === 1)
    ).toEqual([]);
  });

  it('plays the same match whether it records or not', () => {
    const recording = play(
      { ghosts: drivers(), recordedSeats: new Set([0, 1]) },
      90
    );
    const plain = play({ ghosts: drivers() }, 90);

    expect(recording.players).toEqual(plain.players);
  });

  it('plays back what it recorded from driven seats', () => {
    const engine = play(
      { ghosts: drivers(), recordedSeats: new Set([0, 1]) },
      90
    );
    const replay = replayOf(PLAN, 'cpu', 90, engine.recorded);

    const { spawns, options } = planMatch(replay.header);
    const again = new MatchEngine(spawns, {
      ...options,
      ghosts: new Map(
        [0, 1].map((seat) => [seat, ghostOf(replay.inputs, seat)])
      ),
    });
    for (let tick = 0; tick < 90; tick++) {
      again.tick(PLAN.width, PLAN.height);
    }

    expect(again.players).toEqual(engine.players);
  });
});

describe('MatchEngine onSecond', () => {
  it('samples the colony sizes after every full second', () => {
    const samples: [SizeSample, number][] = [];
    const engine = play(
      { onSecond: (sizes, second) => samples.push([sizes, second]) },
      3 * TICKS_PER_SEC
    );

    expect(samples.map(([, second]) => second)).toEqual([1, 2, 3]);
    expect(samples.at(-1)?.[0]).toEqual(
      engine.players.map((player) => player.bacteriaCount)
    );
  });

  it('changes nothing a tick does', () => {
    const sampled = play({ onSecond: () => undefined }, 2 * TICKS_PER_SEC);
    const plain = play({}, 2 * TICKS_PER_SEC);

    expect(sampled.players).toEqual(plain.players);
  });
});

/** The same driver a replay plays a seat back with. */
function ghostOf(
  inputs: Parameters<typeof replayOf>[3],
  seat: number
): SeatDriver {
  return new GhostController(inputs, seat);
}
