import { FloodCache } from './bot-navigation';
import { BotSenses, BotSensesSetup, SensedSimulation } from './bot-senses';
import { weaponOf } from './evolution';
import { gameBalance } from './game-balance';
import { Point } from './geometry';
import { DynamicWall, GameMap, Rect } from './maps';
import { createPlayer, Player } from './player.model';
import { BlockCounts, ColonySummary } from './simulation';
import { Zone } from './zones';

// The base arena: one arena cell per base cell.
const WIDTH = 320;
const HEIGHT = 180;

function colony(
  playerId: number,
  count: number,
  center: Point | null = count > 0 ? { x: 80, y: 90 } : null
): ColonySummary {
  return {
    playerId,
    color: [0, 0, 0, 255],
    count,
    captured: 0,
    lost: 0,
    totalEnergy: count * gameBalance.maxEnergy * 0.5,
    center,
    onHill: 0,
    pellets: 0,
  };
}

/** A simulation that only answers what it is given, and counts its calls. */
class FakeSimulation implements SensedSimulation {
  public colonies: ColonySummary[] = [];
  public nutrients = [{ x: 10, y: 20, amount: 5 }];
  public dynamicWalls: DynamicWall[] = [];
  public blocks: BlockCounts | null = null;
  public nearest: Point | null = { x: 200, y: 95 };
  public readonly calls: string[] = [];

  public getNutrients() {
    this.calls.push('getNutrients');
    return this.nutrients;
  }

  public getDynamicWalls() {
    this.calls.push('getDynamicWalls');
    return this.dynamicWalls;
  }

  public summaries() {
    this.calls.push('summaries');
    return this.colonies;
  }

  public blockCounts() {
    this.calls.push('blockCounts');
    return this.blocks;
  }

  public nearestEnemy(playerId: number, from: Point) {
    this.calls.push(`nearestEnemy ${playerId} ${from.x},${from.y}`);
    return this.nearest;
  }
}

function aMap(
  walls: Rect[] = [],
  zones: Zone[] = []
): GameMap & { wallCalls: number } {
  const map = {
    id: 'test',
    name: 'Test',
    description: '',
    wallCalls: 0,
    createWalls: () => {
      map.wallCalls++;
      return walls;
    },
    createZones: () => zones,
  };
  return map;
}

function senses(
  simulation: FakeSimulation,
  setup: Partial<BotSensesSetup> = {}
): BotSenses {
  return new BotSenses({
    map: aMap(),
    win: { kind: 'annihilation' },
    balance: gameBalance,
    capacity: 900,
    hasNeutral: false,
    simulation,
    ...setup,
  });
}

function bot(change: Partial<Player> = {}): Player {
  return createPlayer({ id: 0, x: 100, y: 90, isBot: true, ...change });
}

describe('BotSenses', () => {
  describe('viewFor', () => {
    it('sees its own colony, the strongest living enemy and the nearest enemy bacterium', () => {
      const simulation = new FakeSimulation();
      const own = colony(0, 100);
      const players = [
        own,
        colony(1, 40, { x: 300, y: 10 }),
        colony(2, 70, { x: 240, y: 90 }),
        colony(3, 0),
      ];

      const view = senses(simulation).viewFor(
        bot(),
        own,
        { players, neutral: [] },
        WIDTH,
        HEIGHT
      );

      expect(view.own).toEqual({ x: 80, y: 90, count: 100, energy: 0.5 });
      expect(view.enemy).toEqual({ x: 240, y: 90, count: 70, energy: 0.5 });
      expect(view.nearestEnemy).toEqual({ x: 200, y: 95 });
      expect(view).toMatchObject({
        width: WIDTH,
        height: HEIGHT,
        unit: 1,
        nutrients: simulation.nutrients,
        boostReady: true,
        objective: null,
        prey: [],
        feeding: false,
        weapon: null,
        capacity: 900,
      });
    });

    it('asks the simulation for nutrients, then the nearest enemy, and for the routes and the weapon count only when they are used', () => {
      const simulation = new FakeSimulation();
      const own = colony(0, 100);
      simulation.colonies = [own];

      const view = senses(simulation).viewFor(
        bot({ weapon: 'toxin-bomb' }),
        own,
        { players: [own, colony(1, 50, { x: 240, y: 90 })], neutral: [] },
        WIDTH,
        HEIGHT
      );

      expect(simulation.calls).toEqual([
        'getNutrients',
        'nearestEnemy 0 80,90',
      ]);

      view.routes.travel({ x: 200, y: 90 });
      view.weapon?.around();

      expect(simulation.calls.slice(2)).toEqual([
        'getDynamicWalls',
        'blockCounts',
      ]);
    });

    it('sees no enemy and asks for no nearest bacterium once every enemy is gone', () => {
      const simulation = new FakeSimulation();
      const own = colony(0, 100);

      const view = senses(simulation).viewFor(
        bot(),
        own,
        { players: [own, colony(1, 0)], neutral: [] },
        WIDTH,
        HEIGHT
      );

      expect(view.enemy).toBeNull();
      expect(view.nearestEnemy).toBeNull();
      expect(simulation.calls).toEqual(['getNutrients']);
    });

    it('charges the centre with neutral colonies about, whose bacteria the simulation counts as enemies', () => {
      const simulation = new FakeSimulation();
      const own = colony(0, 100);

      const view = senses(simulation, { hasNeutral: true }).viewFor(
        bot(),
        own,
        { players: [own, colony(1, 50, { x: 240, y: 90 })], neutral: [] },
        WIDTH,
        HEIGHT
      );

      expect(view.nearestEnemy).toBeNull();
      expect(simulation.calls).toEqual(['getNutrients']);
    });

    it('sees a neutral colony as prey as big as it is, and none once it is eaten up', () => {
      const own = colony(0, 100);

      const view = senses(new FakeSimulation(), { hasNeutral: true }).viewFor(
        bot(),
        own,
        {
          players: [own],
          neutral: [colony(2, 500, { x: 160, y: 70 }), colony(3, 0)],
        },
        WIDTH,
        HEIGHT
      );

      expect(view.prey).toEqual([{ x: 160, y: 70, amount: 500 }]);
    });

    it('feeds first on a level won by eating pellets', () => {
      const own = colony(0, 100);

      const view = senses(new FakeSimulation(), {
        win: { kind: 'harvest', pellets: 10 },
      }).viewFor(bot(), own, { players: [own], neutral: [] }, WIDTH, HEIGHT);

      expect(view.feeding).toBe(true);
    });

    it('heads for the centre of the hill on a hold-the-zone level', () => {
      const own = colony(0, 100);
      const map = aMap(
        [],
        [{ kind: 'hill', x: 140, y: 70, width: 40, height: 40 }]
      );
      const hold = senses(new FakeSimulation(), {
        map,
        win: { kind: 'hold', holdSec: 30 },
      });
      const plain = senses(new FakeSimulation(), { map });
      const colonies = { players: [own], neutral: [] };

      expect(
        hold.viewFor(bot(), own, colonies, WIDTH, HEIGHT).objective
      ).toEqual({ x: 160, y: 90 });
      expect(
        plain.viewFor(bot(), own, colonies, WIDTH, HEIGHT).objective
      ).toBeNull();
    });

    it('sees the weapon it carries, grown with the grid, and counts the bacteria round its crosshair only when asked', () => {
      const simulation = new FakeSimulation();
      const own = colony(0, 100);
      simulation.colonies = [colony(1, 50), own];
      // Two blocks of 320 x 360 cells: the crosshair stands in the left one.
      simulation.blocks = {
        blocksX: 2,
        blocksY: 1,
        cellSize: 320,
        counts: [new Uint32Array([30, 7]), new Uint32Array([12, 9])],
      };
      const armed = bot({ weapon: 'toxin-bomb', x: 160, y: 180 });

      const view = senses(simulation).viewFor(
        armed,
        own,
        { players: [own], neutral: [] },
        WIDTH * 2,
        HEIGHT * 2
      );

      expect(view.weapon).toMatchObject({
        id: 'toxin-bomb',
        ready: true,
        radius: weaponOf('toxin-bomb').radius * 2,
        at: { x: 160, y: 180 },
      });
      expect(view.weapon?.around()).toEqual({ own: 12, enemy: 30 });
    });

    it('counts nothing round the crosshair while the simulation has no blocks', () => {
      const own = colony(0, 100);

      const view = senses(new FakeSimulation()).viewFor(
        bot({ weapon: 'cryo-pulse' }),
        own,
        { players: [own], neutral: [] },
        WIDTH,
        HEIGHT
      );

      expect(view.weapon?.around()).toEqual({ own: 0, enemy: 0 });
    });
  });

  describe('routesFrom', () => {
    const from = { x: 40, y: 20 };
    const to = { x: 280, y: 20 };
    // A wall down the middle, open only at the far end: a long way round.
    const wall: Rect = { x: 150, y: 0, width: 20, height: 170 };

    it('goes straight on open ground', () => {
      const routes = senses(new FakeSimulation()).routesFrom(
        from,
        WIDTH,
        HEIGHT
      );

      expect(routes.waypoint(to)).toEqual(to);
      expect(routes.travel(to)).toBe(240);
    });

    it('goes round a wall in the way', () => {
      const routes = senses(new FakeSimulation(), {
        map: aMap([wall]),
      }).routesFrom(from, WIDTH, HEIGHT);

      expect(routes.waypoint(to)).not.toEqual(to);
      expect(routes.travel(to)).toBeGreaterThan(240);
    });

    it('goes round a moving wall that blocks or is about to, not one that is open', () => {
      const simulation = new FakeSimulation();
      const sensing = senses(simulation);
      simulation.dynamicWalls = [{ ...wall, solid: false, warning: 0 }];

      expect(sensing.routesFrom(from, WIDTH, HEIGHT).travel(to)).toBe(240);

      simulation.dynamicWalls = [{ ...wall, solid: false, warning: 0.5 }];

      expect(
        sensing.routesFrom(from, WIDTH, HEIGHT).travel(to)
      ).toBeGreaterThan(240);

      simulation.dynamicWalls = [{ ...wall, solid: true, warning: 0 }];

      expect(
        sensing.routesFrom(from, WIDTH, HEIGHT).travel(to)
      ).toBeGreaterThan(240);
    });

    it('keeps the grid, and so its floods, while the moving walls stand still', () => {
      const flood = jest.spyOn(FloodCache.prototype, 'flood');
      const simulation = new FakeSimulation();
      const sensing = senses(simulation);
      const gridOfCall = (call: number) => flood.mock.calls[call][0];
      simulation.dynamicWalls = [{ ...wall, solid: true, warning: 0 }];

      sensing.routesFrom(from, WIDTH, HEIGHT).travel(to);
      // The same walls, handed out anew: the grid is kept by where they stand.
      simulation.dynamicWalls = [{ ...wall, solid: true, warning: 0 }];
      sensing.routesFrom(from, WIDTH, HEIGHT).travel(to);
      simulation.dynamicWalls = [{ ...wall, x: 140, solid: true, warning: 0 }];
      sensing.routesFrom(from, WIDTH, HEIGHT).travel(to);

      expect(gridOfCall(1)).toBe(gridOfCall(0));
      expect(gridOfCall(2)).not.toBe(gridOfCall(0));
      flood.mockRestore();
    });

    it('lays the static walls out once per arena size', () => {
      const map = aMap([wall]);
      const sensing = senses(new FakeSimulation(), { map });

      sensing.routesFrom(from, WIDTH, HEIGHT).travel(to);
      sensing.routesFrom(from, WIDTH, HEIGHT).travel(to);

      expect(map.wallCalls).toBe(1);

      sensing.routesFrom(from, WIDTH * 2, HEIGHT * 2).travel(to);

      expect(map.wallCalls).toBe(2);
    });
  });
});
