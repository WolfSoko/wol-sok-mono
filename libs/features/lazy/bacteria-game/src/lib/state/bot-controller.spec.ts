import {
  BOT_DIFFICULTIES,
  BotController,
  BotDifficulty,
  BotView,
  ColonyView,
  neutralFood,
  straightRoutes,
} from './bot-controller';
import { ColonySummary } from './simulation';

const WIDTH = 320;
const HEIGHT = 140;

function colony(x: number, y: number, count: number, energy = 1): ColonyView {
  return { x, y, count, energy };
}

function view(overrides: Partial<BotView> = {}): BotView {
  return {
    width: WIDTH,
    height: HEIGHT,
    own: colony(80, 70, 100),
    enemy: colony(240, 70, 100),
    nearestEnemy: { x: 200, y: 70 },
    nutrients: [],
    boostReady: true,
    objective: null,
    routes: straightRoutes(overrides.own ?? colony(80, 70, 100)),
    ...overrides,
  };
}

/** A bot without aiming error, so the targets can be compared exactly. */
function bot(difficulty: BotDifficulty): BotController {
  return new BotController(difficulty, () => 0.5);
}

describe('BOT_DIFFICULTIES', () => {
  it('offers every difficulty the controller knows', () => {
    for (const option of BOT_DIFFICULTIES) {
      expect(new BotController(option.id).difficulty).toBe(option.id);
    }
  });
});

describe('BotController', () => {
  it('decides immediately on the first frame', () => {
    const decision = bot('normal').decide(view(), 1 / 60);

    expect(decision.target).not.toBeNull();
  });

  it('waits for its reaction time between decisions', () => {
    const controller = bot('normal');
    controller.decide(view(), 1 / 60);

    expect(controller.decide(view(), 0.1).target).toBeNull();
    expect(controller.decide(view(), 1).target).not.toBeNull();
  });

  it('attacks the enemy centre of mass once it is clearly stronger', () => {
    const enemy = colony(240, 70, 50);

    const decision = bot('normal').decide(view({ enemy }), 1);

    expect(decision.target).toEqual({ x: 240, y: 70 });
  });

  it('goes for food while the enemy is as strong as itself', () => {
    const nutrients = [{ x: 60, y: 30, amount: 10 }];

    const decision = bot('normal').decide(view({ nutrients }), 1);

    expect(decision.target).toEqual({ x: 60, y: 30 });
  });

  it('ignores pellets that are already eaten', () => {
    const nutrients = [
      { x: 60, y: 30, amount: 0 },
      { x: 100, y: 110, amount: 5 },
    ];

    const decision = bot('normal').decide(view({ nutrients }), 1);

    expect(decision.target).toEqual({ x: 100, y: 110 });
  });

  it('prefers a pellet on its own side over a closer one next to the enemy', () => {
    const nutrients = [
      { x: 150, y: 70, amount: 10 },
      { x: 20, y: 70, amount: 10 },
    ];

    const decision = bot('normal').decide(
      view({
        own: colony(100, 70, 100),
        enemy: colony(180, 70, 100),
        nutrients,
      }),
      1
    );

    expect(decision.target).toEqual({ x: 20, y: 70 });
  });

  it('retreats from a stronger enemy when there is nothing to eat', () => {
    const decision = bot('normal').decide(
      view({ own: colony(80, 70, 50), enemy: colony(240, 70, 200) }),
      1
    );

    expect(decision.target?.x).toBeLessThan(80);
    expect(decision.target?.y).toBeCloseTo(70);
  });

  it('heads for the zone to hold instead of food or a retreat', () => {
    const hill = { x: 160, y: 70 };
    const nutrients = [{ x: 60, y: 30, amount: 10 }];

    const weaker = bot('normal').decide(
      view({
        own: colony(80, 70, 50),
        enemy: colony(240, 70, 200),
        objective: hill,
      }),
      1
    );
    const fed = bot('normal').decide(view({ nutrients, objective: hill }), 1);

    expect(weaker.target).toEqual(hill);
    expect(fed.target).toEqual(hill);
  });

  it('takes the zone rather than the fight, however strong it is', () => {
    const hill = { x: 160, y: 70 };

    const decision = bot('hard').decide(
      view({ own: colony(80, 70, 400), objective: hill }),
      1
    );

    expect(decision.target).toEqual(hill);
  });

  it('still feeds a hungry colony first on a hold-the-zone level', () => {
    const nutrients = [{ x: 60, y: 30, amount: 10 }];

    const decision = bot('normal').decide(
      view({
        own: colony(80, 70, 50, 0.4),
        nutrients,
        objective: { x: 160, y: 70 },
      }),
      1
    );

    expect(decision.target).toEqual({ x: 60, y: 30 });
  });

  it('picks food by the way there, skipping what it cannot reach', () => {
    const near = { x: 100, y: 70, amount: 10 };
    const far = { x: 40, y: 20, amount: 10 };
    const walledIn = { x: 85, y: 75, amount: 10 };
    // A wall puts the near pellet far away, and walls the closest one in.
    const routes = {
      waypoint: (to: { x: number; y: number }) => to,
      travel: (to: { x: number; y: number }) =>
        to === near ? 300 : to === walledIn ? Number.POSITIVE_INFINITY : 60,
    };

    const decision = bot('normal').decide(
      view({ nutrients: [near, far, walledIn], routes }),
      1
    );

    expect(decision.target).toEqual({ x: 40, y: 20 });
  });

  it('sends the crosshair on the way round, not at the target', () => {
    const waypoint = { x: 120, y: 130 };
    const routes = { waypoint: () => waypoint, travel: () => 50 };

    const decision = bot('normal').decide(
      view({ enemy: colony(240, 70, 10), routes }),
      1
    );

    expect(decision.target).toEqual(waypoint);
  });

  it('charges with its boost as a boss that has fallen behind', () => {
    const behind = view({
      own: colony(80, 70, 50),
      enemy: colony(240, 70, 200),
    });

    const boss = new BotController('normal', () => 0.5, true).decide(behind, 1);
    const plain = bot('normal').decide(behind, 1);
    const easyBoss = new BotController('easy', () => 0.5, true).decide(
      behind,
      1
    );

    expect(boss).toEqual({ target: { x: 240, y: 70 }, boost: true });
    // A plain bot retreats, and an easy boss never boosts.
    expect(plain.boost).toBe(false);
    expect(easyBoss.boost).toBe(false);
  });

  it('goes for prey - a neutral colony - like food when it is not hungry', () => {
    const prey = [{ x: 60, y: 30, amount: 400 }];

    const decision = bot('normal').decide(view({ prey }), 1);

    expect(decision.target).toEqual({ x: 60, y: 30 });
  });

  it('leaves prey alone while its colony is hungry - it bites back', () => {
    const prey = [{ x: 60, y: 30, amount: 400 }];
    const nutrients = [{ x: 100, y: 120, amount: 10 }];

    const decision = bot('normal').decide(
      view({ own: colony(80, 70, 100, 0.4), prey, nutrients }),
      1
    );

    expect(decision.target).toEqual({ x: 100, y: 120 });
  });

  it('feeds before it fights while its colony is hungry', () => {
    const nutrients = [{ x: 60, y: 30, amount: 10 }];

    const decision = bot('hard').decide(
      view({ own: colony(80, 70, 200, 0.4), nutrients }),
      1
    );

    expect(decision.target).toEqual({ x: 60, y: 30 });
  });

  it('keeps its target inside the arena', () => {
    const decision = new BotController('easy', () => 0).decide(
      view({ own: colony(2, 2, 50), enemy: colony(300, 130, 200) }),
      1
    );

    expect(decision.target?.x).toBeGreaterThanOrEqual(0);
    expect(decision.target?.y).toBeGreaterThanOrEqual(0);
  });

  it('does nothing once its colony is gone', () => {
    const decision = bot('hard').decide(view({ own: colony(0, 0, 0) }), 1);

    expect(decision).toEqual({ target: null, boost: false });
  });

  describe('easy', () => {
    it('only attacks when far ahead', () => {
      const controller = bot('easy');
      const nutrients = [{ x: 60, y: 30, amount: 10 }];

      expect(
        controller.decide(view({ enemy: colony(240, 70, 80), nutrients }), 1)
          .target
      ).toEqual({ x: 60, y: 30 });
      expect(
        controller.decide(view({ enemy: colony(240, 70, 40), nutrients }), 2)
          .target
      ).toEqual({ x: 240, y: 70 });
    });

    it('never boosts', () => {
      const decision = bot('easy').decide(
        view({ own: colony(200, 70, 300), enemy: colony(220, 70, 10) }),
        1
      );

      expect(decision.boost).toBe(false);
    });
  });

  describe('hard', () => {
    it('takes an even fight', () => {
      const decision = bot('hard').decide(view(), 1);

      expect(decision.target).toEqual({ x: 200, y: 70 });
    });

    it('aims at the nearest enemy bacteria rather than the centre', () => {
      const decision = bot('hard').decide(
        view({ enemy: colony(240, 70, 50), nearestEnemy: { x: 150, y: 90 } }),
        1
      );

      expect(decision.target).toEqual({ x: 150, y: 90 });
    });

    it('boosts when it attacks at close range', () => {
      const decision = bot('hard').decide(
        view({ own: colony(200, 70, 150), enemy: colony(230, 70, 100) }),
        1
      );

      expect(decision.boost).toBe(true);
    });

    it('saves the boost while the enemy is still far away', () => {
      const decision = bot('hard').decide(
        view({ own: colony(20, 70, 150), enemy: colony(300, 70, 100) }),
        1
      );

      expect(decision.boost).toBe(false);
    });

    it('does not boost while the boost is cooling down', () => {
      const decision = bot('hard').decide(
        view({
          own: colony(200, 70, 150),
          enemy: colony(230, 70, 100),
          boostReady: false,
        }),
        1
      );

      expect(decision.boost).toBe(false);
    });
  });
});

describe('neutralFood', () => {
  function summary(count: number): ColonySummary {
    return {
      playerId: 2,
      color: [0, 0, 0, 255],
      count,
      center: count > 0 ? { x: 160, y: 70 } : null,
      totalEnergy: count,
      captured: 0,
      lost: 0,
      onHill: 0,
    };
  }

  it('makes a neutral colony a pellet as big as it is, at its centre', () => {
    expect(neutralFood(summary(500))).toEqual([{ x: 160, y: 70, amount: 500 }]);
  });

  it('makes no food of a neutral colony that is eaten up', () => {
    expect(neutralFood(summary(0))).toEqual([]);
  });
});
