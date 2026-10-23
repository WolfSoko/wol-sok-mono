import { GhostController, SAME_BOARD, turnedOnto } from './ghost';
import { MatchEngine } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import { ReplayInputs } from './replay';

const PLAN: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'vs-computer',
  difficulty: 'normal',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 140,
  seed: 77,
};

describe('GhostController', () => {
  const inputs: ReplayInputs = {
    steers: [
      [0, 0, 1, 0],
      [2, 1, 0, 1],
      [5, 0, 0, 0],
    ],
    drags: [
      [3, 0, 10, 20],
      [3, 0, 30, 40],
    ],
    boosts: [[4, 0]],
    weapons: [],
  };

  it("plays one seat's inputs, each kind's last one when it is due", () => {
    const ghost = new GhostController(inputs, 0, SAME_BOARD);

    expect(ghost.before(0)).toEqual({
      boost: false,
      drag: null,
      steer: { x: 1, y: 0 },
    });
    expect(ghost.before(2)).toEqual({ boost: false, drag: null, steer: null });
    expect(ghost.before(3).drag).toEqual({ x: 30, y: 40 });
    expect(ghost.before(4).boost).toBe(true);
    expect(ghost.before(9)).toEqual({
      boost: false,
      drag: null,
      steer: { x: 0, y: 0 },
    });
  });

  it('turns a run through the centre onto a board of another size', () => {
    const turned = turnedOnto(
      { width: 320, height: 140 },
      { width: 640, height: 280 }
    );

    expect(turned.point({ x: 80, y: 70 })).toEqual({ x: 480, y: 140 });
    expect(turned.direction({ x: 1, y: -0.5 })).toEqual({ x: -1, y: 0.5 });
    expect(turned.direction({ x: 0, y: 1 })).toEqual({ x: 0, y: -1 });
  });
});

describe('a ghost match', () => {
  /** Plays a run where the human steers and drags, and where it went. */
  function run(ticks: number): { inputs: ReplayInputs; path: number[][] } {
    const { spawns, options } = planMatch(PLAN);
    const engine = new MatchEngine(spawns, options);
    const path: number[][] = [];
    for (let tick = 0; tick < ticks; tick++) {
      engine.setSteering(0, tick < 40 ? { x: 1, y: -0.5 } : { x: 0, y: 0 });
      if (tick === 60) {
        engine.setDragTarget(0, 150, 120);
      }
      engine.tick(PLAN.width, PLAN.height);
      path.push([engine.players[0].x, engine.players[0].y]);
    }
    return { inputs: engine.recorded, path };
  }

  function ghostMatch(inputs: ReplayInputs): MatchEngine {
    const { spawns, options } = planMatch(PLAN);
    const board = { width: PLAN.width, height: PLAN.height };
    return new MatchEngine(spawns, {
      ...options,
      ghosts: new Map([
        [1, new GhostController(inputs, 0, turnedOnto(board, board))],
      ]),
    });
  }

  it('steers the opponent as the run steered the player, turned around', () => {
    const { inputs, path } = run(150);
    const engine = ghostMatch(inputs);

    for (const [x, y] of path) {
      engine.tick(PLAN.width, PLAN.height);
      const ghost = engine.players[1];
      expect(ghost.x).toBeCloseTo(PLAN.width - x);
      expect(ghost.y).toBeCloseTo(PLAN.height - y);
    }
  });

  it('leaves the ghost to its run - no bot, no keys, no boost', () => {
    const engine = ghostMatch({
      steers: [],
      drags: [],
      boosts: [],
      weapons: [],
    });
    const start = engine.players[1];

    engine.setSteering(1, { x: 1, y: 0 });
    engine.setDragTarget(1, 0, 0);
    expect(engine.boost(1)).toBe(false);
    for (let tick = 0; tick < 120; tick++) {
      engine.tick(PLAN.width, PLAN.height);
    }

    expect(engine.players[1].x).toBe(start.x);
    expect(engine.players[1].y).toBe(start.y);
    expect(engine.isLive(0)).toBe(true);
    expect(engine.isLive(1)).toBe(false);
  });

  it('records only the human at the screen', () => {
    const { inputs } = run(10);
    const engine = ghostMatch(inputs);

    engine.setSteering(0, { x: 0, y: 1 });
    for (let tick = 0; tick < 10; tick++) {
      engine.tick(PLAN.width, PLAN.height);
    }

    expect(engine.recorded.steers).toEqual([[0, 0, 0, 1]]);
  });
});
