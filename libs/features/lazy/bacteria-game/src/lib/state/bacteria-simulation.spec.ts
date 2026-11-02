import {
  BacteriaSimulation,
  Colony,
  colonyIntent,
  maxSteps,
  paceSteps,
} from './bacteria-simulation';
import { ActiveEffect, WEAPON_EFFECTS, WeaponId } from './evolution';
import { GameBalance, gameBalance } from './game-balance';
import { DEFAULT_CROSSHAIR_SPEED } from './levels';
import { getMap } from './game-maps';
import { GameMap, gateState } from './maps';
import { Cells } from './cells';
import { Bacteria, createPlayer, Player } from './player.model';
import { heatedAggression, Zone, ZoneKind } from './zones';

/** A colony's bacteria as objects - a copy. */
function bacteriaOf(colony: Colony): Bacteria[] {
  return colony.cells.toBacteria();
}

/** Puts these bacteria in the colony, in place of its own. */
function setBacteria(colony: Colony, bacterias: readonly Bacteria[]): void {
  colony.cells = Cells.of(bacterias);
}

// The production canvas size. Smaller arenas push the walls outside the grid,
// which would make every wall test pass without a single wall cell existing.
const WIDTH = 320;
const HEIGHT = 140;

/** The layout the simulation is on by default, and what the tests expect. */
const corridors = getMap('corridors');
const createWalls = (width: number, height: number) =>
  corridors.createWalls(width, height);

function balance(overrides: Partial<GameBalance> = {}): GameBalance {
  return { ...gameBalance, nutrientCount: 0, ...overrides };
}

function bacterium(
  x: number,
  y: number,
  energy = gameBalance.maxEnergy
): Bacteria {
  return { x, y, energy };
}

function ring(x: number, y: number): Bacteria[] {
  const result: Bacteria[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx !== 0 || dy !== 0) {
        result.push(bacterium(x + dx, y + dy));
      }
    }
  }
  return result;
}

/**
 * Builds a simulation whose colonies contain exactly the given bacteria - the
 * blob `init()` spawns is replaced so every test can set up its own scenario.
 */
function setup(
  bacteriasPerPlayer: Bacteria[][],
  options: {
    balance?: Partial<GameBalance>;
    random?: () => number;
    targets?: { x: number; y: number }[];
  } = {}
) {
  const simulation = new BacteriaSimulation(
    balance(options.balance),
    options.random ?? (() => 0.5)
  );
  simulation.resize(WIDTH, HEIGHT);
  simulation.init(
    bacteriasPerPlayer.map((_, index) => ({
      playerId: index,
      color: [255, 0, 0, 255] as [number, number, number, number],
      x: 0,
      y: 0,
      radius: 0,
    }))
  );
  const colonies = simulation.getColonies() as Colony[];
  bacteriasPerPlayer.forEach((bacterias, index) => {
    setBacteria(colonies[index], bacterias);
  });
  const players: Player[] = bacteriasPerPlayer.map((_, index) =>
    createPlayer({
      id: index,
      x: options.targets?.[index]?.x ?? WIDTH / 2,
      y: options.targets?.[index]?.y ?? HEIGHT / 2,
      color: [255, 0, 0, 255],
    })
  );
  return { simulation, colonies, players };
}

describe('BacteriaSimulation', () => {
  describe('combat', () => {
    it('drains a bacterium that is attacked from the four orthogonal sides', () => {
      const { simulation, colonies, players } = setup([
        [bacterium(20, 20)],
        [
          bacterium(19, 20),
          bacterium(21, 20),
          bacterium(20, 19),
          bacterium(20, 21),
        ],
      ]);

      simulation.step(players, 0.05);

      const [defender] = bacteriaOf(colonies[0]);
      expect(defender.energy).toBeLessThan(gameBalance.maxEnergy);
    });

    it('converts a surrounded bacterium to the attacking colony', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], ring(20, 20)],
        { balance: { divideChancePerSec: 0, consumeChance: 0 } }
      );

      simulation.step(players, 1);

      expect(bacteriaOf(colonies[0])).toHaveLength(0);
      expect(colonies[0].lost).toBe(1);
      expect(bacteriaOf(colonies[1])).toHaveLength(9);
      expect(colonies[1].captured).toBe(1);
    });

    it('gives the converted bacterium the capture energy so it can be won back', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], ring(20, 20)],
        { balance: { divideChancePerSec: 0, consumeChance: 0 } }
      );

      simulation.step(players, 1);

      expect(
        bacteriaOf(colonies[1]).some(
          (bac) => bac.energy === gameBalance.captureEnergy
        )
      ).toBe(true);
    });

    it('digests the bacterium instead of converting it when it is consumed', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], ring(20, 20)],
        { balance: { divideChancePerSec: 0, consumeChance: 1 } }
      );

      simulation.step(players, 1);

      expect(bacteriaOf(colonies[0])).toHaveLength(0);
      expect(bacteriaOf(colonies[1])).toHaveLength(8);
      expect(colonies[1].captured).toBe(1);
    });

    it('lets a bacterium regenerate while nobody attacks it', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20, 0.2)], [bacterium(50, 5)]],
        { balance: { divideChancePerSec: 0 } }
      );

      simulation.step(players, 0.5);

      const [lonely] = bacteriaOf(colonies[0]);
      expect(lonely.energy).toBeCloseTo(
        0.2 + gameBalance.energyRegenPerSec * 0.5,
        5
      );
    });

    it('keeps a bacterium that is backed by its own colony alive', () => {
      const defender = bacterium(20, 20);
      const { simulation, players } = setup(
        [[defender, ...ring(20, 20).slice(0, 5)], [bacterium(21, 21)]],
        { balance: { divideChancePerSec: 0 } }
      );

      simulation.step(players, 0.5);

      expect(defender.energy).toBe(gameBalance.maxEnergy);
    });
  });

  describe('division', () => {
    it('grows the colony when a well fed bacterium has free space', () => {
      const { simulation, colonies, players } = setup([[bacterium(20, 20)]], {
        balance: { divideChancePerSec: 1 },
        random: () => 0,
      });

      simulation.step(players, 0.5);

      expect(bacteriaOf(colonies[0])).toHaveLength(2);
    });

    it('splits the energy between parent and child', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20, 1)]],
        {
          balance: { divideChancePerSec: 1 },
          random: () => 0,
        }
      );

      simulation.step(players, 0.5);

      const total = bacteriaOf(colonies[0]).reduce(
        (sum, bac) => sum + bac.energy,
        0
      );
      expect(total).toBeCloseTo(1, 5);
    });

    it('does not divide below the energy threshold', () => {
      const weak = gameBalance.divideEnergyThreshold - 0.1;
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20, weak)]],
        { balance: { divideChancePerSec: 1 }, random: () => 0 }
      );

      simulation.step(players, 0.001);

      expect(bacteriaOf(colonies[0])).toHaveLength(1);
    });

    it('stops dividing once a colony has used up its share of the arena', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], [bacterium(40, 20)]],
        {
          // Four cells for the whole arena, so two per colony.
          balance: { divideChancePerSec: 1, maxTotalBacteria: 4 },
          random: () => 0,
        }
      );

      simulation.step(players, 0.5);

      expect(bacteriaOf(colonies[0])).toHaveLength(2);
      expect(bacteriaOf(colonies[1])).toHaveLength(2);
    });

    it('still lets a small colony grow while the other one is at its limit', () => {
      const big = Array.from({ length: 6 }, (_, i) =>
        bacterium(20 + i * 2, 20)
      );
      const { simulation, colonies, players } = setup(
        [big, [bacterium(60, 60)]],
        {
          // A shared budget of 8 would already be used up by the big colony.
          balance: { divideChancePerSec: 1, maxTotalBacteria: 8 },
          random: () => 0,
        }
      );

      simulation.step(players, 0.5);

      expect(bacteriaOf(colonies[0])).toHaveLength(6);
      expect(bacteriaOf(colonies[1]).length).toBeGreaterThan(1);
    });

    it('respects the per player cap', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20), bacterium(24, 24), bacterium(28, 28)]],
        {
          balance: { divideChancePerSec: 1, maxBacteriaPerPlayer: 3 },
          random: () => 0,
        }
      );

      simulation.step(players, 0.5);

      expect(bacteriaOf(colonies[0])).toHaveLength(3);
    });
  });

  describe('traits', () => {
    it('lets a colony with a higher divide factor divide where another does not', () => {
      // A chance of a half per step: the roll of 0.6 misses it, but not 1.5 times it.
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], [bacterium(260, 30)]],
        { balance: { divideChancePerSec: 1 }, random: () => 0.6 }
      );
      colonies[1].traits = {
        divideFactor: 1.5,
        attackFactor: 1,
        cooldownFactor: 1,
      };

      simulation.step(players, 0.5);

      expect(bacteriaOf(colonies[0])).toHaveLength(1);
      expect(bacteriaOf(colonies[1])).toHaveLength(2);
    });
  });

  describe('movement', () => {
    it('never moves a bacterium into a wall', () => {
      const walls = createWalls(WIDTH, HEIGHT);
      const wall = walls[0];
      const { simulation, colonies, players } = setup(
        [[bacterium(wall.x - 2, wall.y + 1)]],
        {
          balance: { divideChancePerSec: 0 },
          targets: [{ x: WIDTH - 1, y: wall.y + 1 }],
        }
      );

      for (let frame = 0; frame < 60; frame++) {
        simulation.step(players, 1 / 60);
      }

      const isInWall = bacteriaOf(colonies[0]).some((bac) =>
        walls.some(
          (rect) =>
            bac.x >= rect.x &&
            bac.x < rect.x + rect.width &&
            bac.y >= rect.y &&
            bac.y < rect.y + rect.height
        )
      );
      expect(isInWall).toBe(false);
    });

    it('does not tunnel through a wall on a long frame', () => {
      const wall = createWalls(WIDTH, HEIGHT)[0];
      const runner = bacterium(wall.x - 2, wall.y + 1);
      const { simulation, players } = setup([[runner]], {
        balance: { divideChancePerSec: 0 },
        targets: [{ x: WIDTH - 1, y: wall.y + 1 }],
      });

      // A long frame (tab switch, load spike) is clamped to 0.1s, which is
      // 15 cells of travel - almost twice the wall thickness.
      simulation.step(players, 0.1);

      expect(runner.x).toBeLessThan(wall.x);
    });

    it('keeps every bacterium inside the arena', () => {
      const { simulation, colonies, players } = setup([[bacterium(1, 1)]], {
        targets: [{ x: -50, y: -50 }],
      });

      for (let frame = 0; frame < 30; frame++) {
        simulation.step(players, 1 / 60);
      }

      for (const bac of bacteriaOf(colonies[0])) {
        expect(bac.x).toBeGreaterThanOrEqual(0);
        expect(bac.y).toBeGreaterThanOrEqual(0);
        expect(bac.x).toBeLessThan(WIDTH);
        expect(bac.y).toBeLessThan(HEIGHT);
      }
    });

    it('lets a colony run from the enemy it touches, boosted too', () => {
      // The enemy a coarse cell to the right, the crosshair far to the left.
      const { simulation, colonies, players } = setup(
        [[bacterium(39, 20)], ring(42, 20)],
        {
          balance: { jitter: 0, divideChancePerSec: 0 },
          targets: [
            { x: 0, y: 20 },
            { x: 42, y: 20 },
          ],
        }
      );
      // Boosted, it hunts hardest - and still must not be dragged back.
      players[0] = { ...players[0], boostActiveSec: 1 };

      simulation.step(players, 0.1);

      const steps = Math.round(
        DEFAULT_CROSSHAIR_SPEED * gameBalance.boostSpeedFactor * 0.1
      );
      expect(bacteriaOf(colonies[0])[0]).toMatchObject({
        x: 39 - steps,
        y: 20,
      });
    });

    it('lets a bacterium with no free cell around sit its move out, drawing nothing', () => {
      // given a dish packed wall to wall, too hungry to divide
      const width = 8;
      const height = 6;
      const random = jest.fn(() => 0.5);
      const simulation = new BacteriaSimulation(balance(), random);
      simulation.resize(width, height);
      simulation.setMap(getMap('open-field'));
      simulation.init([
        { playerId: 0, color: [255, 0, 0, 255], x: 0, y: 0, radius: 0 },
      ]);
      const [colony] = simulation.getColonies() as Colony[];
      const packed = Array.from({ length: width * height }, (_, cell) =>
        bacterium(cell % width, Math.floor(cell / width), 0.5)
      );
      setBacteria(colony, packed);
      const player = createPlayer({
        id: 0,
        x: width,
        y: height / 2,
        color: [255, 0, 0, 255],
      });
      random.mockClear();

      // when
      simulation.step([player], 1 / 60);

      // then
      expect(random).not.toHaveBeenCalled();
      expect(bacteriaOf(colony).map(({ x, y }) => [x, y])).toEqual(
        packed.map(({ x, y }) => [x, y])
      );
    });

    it('lets a bacterium move into a cell freed earlier in the same step', () => {
      // given a queue in a corridor one cell high, its head first
      const simulation = new BacteriaSimulation(balance(), () => 0.5);
      simulation.resize(6, 1);
      simulation.setMap(getMap('open-field'));
      simulation.init([
        { playerId: 0, color: [255, 0, 0, 255], x: 0, y: 0, radius: 0 },
      ]);
      const [colony] = simulation.getColonies() as Colony[];
      setBacteria(colony, [bacterium(2, 0), bacterium(1, 0), bacterium(0, 0)]);
      const player = createPlayer({
        id: 0,
        x: 6,
        y: 0,
        color: [255, 0, 0, 255],
      });

      // when
      simulation.step([player], 1 / 60);

      // then every one of them moved up behind the one ahead
      const [head, middle, tail] = bacteriaOf(colony);
      expect(head.x).toBeGreaterThan(2);
      expect(middle.x).toBeGreaterThan(1);
      expect(tail.x).toBeGreaterThan(0);
    });

    it('never puts two bacteria on the same cell', () => {
      const { simulation, colonies, players } = setup(
        [ring(10, 10), ring(50, 30)],
        {
          targets: [
            { x: 30, y: 20 },
            { x: 30, y: 20 },
          ],
        }
      );

      for (let frame = 0; frame < 120; frame++) {
        simulation.step(players, 1 / 60);
      }

      const cells = colonies
        .flatMap((colony) => bacteriaOf(colony))
        .map((bac) => `${bac.x}/${bac.y}`);
      expect(new Set(cells).size).toBe(cells.length);
    });
  });

  describe('nutrients', () => {
    it('supercharges a bacterium that sits on a nutrient', () => {
      const simulation = new BacteriaSimulation(
        balance({ nutrientCount: 1, divideChancePerSec: 0 }),
        () => 0
      );
      simulation.resize(WIDTH, HEIGHT);
      simulation.init([
        { playerId: 0, color: [255, 0, 0, 255], x: 0, y: 0, radius: 0 },
      ]);
      const [nutrient] = simulation.getNutrients();
      setBacteria((simulation.getColonies() as Colony[])[0], [
        bacterium(nutrient.x, nutrient.y),
      ]);
      const players = [
        createPlayer({
          id: 0,
          x: nutrient.x,
          y: nutrient.y,
          color: [255, 0, 0, 255],
        }),
      ];

      simulation.step(players, 0.5);

      const [fed] = bacteriaOf(simulation.getColonies()[0]);
      expect(fed.energy).toBeGreaterThan(gameBalance.maxEnergy);
      expect(fed.energy).toBeLessThanOrEqual(gameBalance.superChargedMaxEnergy);
      expect(simulation.getNutrients()[0].amount).toBeLessThan(
        gameBalance.nutrientEnergy
      );
    });

    it('credits a pellet eaten up to the colony that ate it', () => {
      const simulation = new BacteriaSimulation(
        balance({
          nutrientCount: 1,
          divideChancePerSec: 0,
          nutrientDrainPerSec: 1000,
        }),
        () => 0
      );
      simulation.resize(WIDTH, HEIGHT);
      simulation.init([
        { playerId: 0, color: [255, 0, 0, 255], x: 0, y: 0, radius: 0 },
        { playerId: 1, color: [0, 0, 255, 255], x: 0, y: 0, radius: 0 },
      ]);
      const [nutrient] = simulation.getNutrients();
      const colonies = simulation.getColonies() as Colony[];
      setBacteria(colonies[0], [bacterium(nutrient.x, nutrient.y)]);
      setBacteria(colonies[1], []);
      const at = { x: nutrient.x, y: nutrient.y };

      simulation.step(
        [createPlayer({ id: 0, ...at }), createPlayer({ id: 1, ...at })],
        0.5
      );

      expect(simulation.summaries().map((c) => c.pellets)).toEqual([1, 0]);
    });

    it('spawns nutrients in pairs that mirror each other', () => {
      const simulation = new BacteriaSimulation(balance({ nutrientCount: 8 }));
      simulation.resize(WIDTH, HEIGHT);

      const nutrients = simulation.getNutrients();
      for (let i = 0; i < nutrients.length; i += 2) {
        expect(nutrients[i + 1].x).toBe(WIDTH - 1 - nutrients[i].x);
        expect(nutrients[i + 1].y).toBe(HEIGHT - 1 - nutrients[i].y);
      }
    });

    it('keeps a half eaten nutrient in place while its partner respawns', () => {
      const simulation = new BacteriaSimulation(
        balance({ nutrientCount: 2, divideChancePerSec: 0 })
      );
      simulation.resize(WIDTH, HEIGHT);
      simulation.init([
        { playerId: 0, color: [255, 0, 0, 255], x: 0, y: 0, radius: 0 },
      ]);
      const nutrients = simulation.getNutrients();
      nutrients[0].amount = 0;
      nutrients[1].amount = gameBalance.nutrientEnergy / 2;
      const partner = { ...nutrients[1] };

      for (let frame = 0; frame < 40; frame++) {
        simulation.step(
          [createPlayer({ id: 0, x: 0, y: 0, color: [255, 0, 0, 255] })],
          gameBalance.nutrientRespawnDelaySec / 4
        );
      }

      expect(simulation.getNutrients()[1]).toEqual(partner);
      expect(simulation.getNutrients()[0].amount).toBe(0);
    });

    it('never spawns a nutrient inside a wall', () => {
      const walls = createWalls(WIDTH, HEIGHT);
      const simulation = new BacteriaSimulation(balance({ nutrientCount: 8 }));
      simulation.resize(WIDTH, HEIGHT);

      for (const nutrient of simulation.getNutrients()) {
        const inWall = walls.some(
          (rect) =>
            nutrient.x >= rect.x &&
            nutrient.x < rect.x + rect.width &&
            nutrient.y >= rect.y &&
            nutrient.y < rect.y + rect.height
        );
        expect(inWall).toBe(false);
      }
    });
  });

  it('reports the total energy of every colony', () => {
    const { simulation, colonies, players } = setup(
      [[bacterium(20, 20, 0.5), bacterium(25, 25, 0.5)]],
      { balance: { divideChancePerSec: 0 } }
    );

    simulation.step(players, 0.001);

    expect(colonies[0].totalEnergy).toBeCloseTo(
      bacteriaOf(colonies[0]).reduce((sum, bac) => sum + bac.energy, 0),
      5
    );
  });

  it('spawns a blob of full energy bacteria for every player', () => {
    const simulation = new BacteriaSimulation(balance());
    simulation.resize(WIDTH, HEIGHT);
    simulation.init([
      { playerId: 7, color: [1, 2, 3, 255], x: 20, y: 20, radius: 5 },
    ]);

    const [colony] = simulation.getColonies();
    expect(colony.playerId).toBe(7);
    expect(bacteriaOf(colony).length).toBeGreaterThan(50);
    expect(
      bacteriaOf(colony).every((bac) => bac.energy === gameBalance.maxEnergy)
    ).toBe(true);
  });
});

describe('maps', () => {
  it('stamps the walls of the map the simulation was given', () => {
    const simulation = new BacteriaSimulation(balance(), () => 0.5);
    simulation.resize(WIDTH, HEIGHT);
    simulation.setMap(getMap('hourglass'));
    const wall = getMap('hourglass').createWalls(WIDTH, HEIGHT)[0];

    const blocked = bacterium(wall.x + 1, wall.y + 1);
    simulation.init([
      {
        playerId: 0,
        color: [255, 0, 0, 255],
        x: 0,
        y: 0,
        radius: 0,
      },
    ]);
    const colonies = simulation.getColonies() as Colony[];
    setBacteria(colonies[0], [bacterium(wall.x - 2, wall.y + 1)]);
    const player = createPlayer({
      id: 0,
      x: WIDTH,
      y: wall.y + 1,
      color: [255, 0, 0, 255],
    });

    for (let frame = 0; frame < 40; frame++) {
      simulation.step([player], 1 / 60);
    }

    expect(
      bacteriaOf(colonies[0]).some(
        (bac) => bac.x === blocked.x && bac.y === blocked.y
      )
    ).toBe(false);
  });
});

describe('boost', () => {
  const far = { x: WIDTH - 1, y: HEIGHT / 2 };

  function distanceTravelled(boostActiveSec: number): number {
    const { simulation, colonies, players } = setup([[bacterium(20, 20)]], {
      balance: { jitter: 0, divideChancePerSec: 0 },
      targets: [far],
    });
    players[0] = { ...players[0], boostActiveSec };
    simulation.step(players, 0.1);
    return bacteriaOf(colonies[0])[0].x - 20;
  }

  it('moves a boosted colony faster', () => {
    expect(distanceTravelled(1)).toBeGreaterThan(distanceTravelled(0));
  });

  it('lets a boosted colony hit harder', () => {
    function drain(boostActiveSec: number): number {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], [bacterium(19, 20), bacterium(21, 20)]],
        { balance: { divideChancePerSec: 0 } }
      );
      players[1] = { ...players[1], boostActiveSec };
      simulation.step(players, 0.05);
      return gameBalance.maxEnergy - bacteriaOf(colonies[0])[0].energy;
    }

    expect(drain(1)).toBeGreaterThan(drain(0));
  });

  it('is over once the boost timer has run out', () => {
    expect(distanceTravelled(0)).toBe(
      Math.max(1, Math.round(DEFAULT_CROSSHAIR_SPEED * 0.1))
    );
  });
});

describe('dynamic walls', () => {
  /** A 4x4 gate that is open for a second, then closed for a second. */
  const gateMap: GameMap = {
    id: 'gate',
    name: 'Gate',
    description: '',
    createWalls: () => [],
    createDynamicWalls: (_width, _height, timeSec) => [
      {
        x: 100,
        y: 50,
        width: 4,
        height: 4,
        ...gateState({ periodSec: 2, closedSec: 1, warningSec: 0.5 }, timeSec),
      },
    ],
  };

  function onGate(bacterias: Bacteria[]) {
    const scenario = setup([bacterias], {
      balance: { divideChancePerSec: 0 },
      targets: [{ x: 102, y: 52 }],
    });
    scenario.simulation.setMap(gateMap);
    // setMap respawns, the colony keeps its hand made bacteria.
    return scenario;
  }

  function insideGate(bacterium: Bacteria): boolean {
    return (
      bacterium.x >= 100 &&
      bacterium.x < 104 &&
      bacterium.y >= 50 &&
      bacterium.y < 54
    );
  }

  it('pushes a bacterium out of a gate that closes on it', () => {
    const { simulation, colonies, players } = onGate([bacterium(101, 51)]);

    simulation.step(players, 1.2);

    expect(bacteriaOf(colonies[0])).toHaveLength(1);
    expect(insideGate(bacteriaOf(colonies[0])[0])).toBe(false);
    expect(simulation.getEvents().crushed).toBe(0);
  });

  it('crushes the bacteria a closing gate has no room left for', () => {
    const packed: Bacteria[] = [];
    for (let y = 46; y < 58; y++) {
      for (let x = 96; x < 108; x++) {
        packed.push(bacterium(x, y));
      }
    }
    const { simulation, colonies, players } = onGate(packed);

    simulation.step(players, 1.2);

    expect(simulation.getEvents().crushed).toBe(16);
    expect(colonies[0].lost).toBe(16);
    expect(bacteriaOf(colonies[0]).some(insideGate)).toBe(false);
  });

  it('reports the warning and the moment the gate slams shut', () => {
    const { simulation, players } = onGate([bacterium(10, 10)]);

    simulation.step(players, 0.6);
    expect(simulation.getEvents()).toMatchObject({
      gatesWarned: 1,
      gatesClosed: 0,
    });

    simulation.step(players, 0.5);
    expect(simulation.getEvents()).toMatchObject({
      gatesWarned: 0,
      gatesClosed: 1,
    });
    expect(simulation.getDynamicWalls()[0].solid).toBe(true);
  });

  it('reports nothing for a frame that does not advance', () => {
    const { simulation, players } = onGate([bacterium(10, 10)]);
    simulation.step(players, 1.1);
    expect(simulation.getEvents().gatesClosed).toBe(1);

    simulation.step(players, 0);

    expect(simulation.getEvents().gatesClosed).toBe(0);
  });

  it('starts every match with the gates as they are at time zero', () => {
    const { simulation, players } = onGate([bacterium(10, 10)]);
    simulation.step(players, 1.2);

    simulation.init([
      { playerId: 0, color: [255, 0, 0, 255], x: 20, y: 20, radius: 1 },
    ]);

    expect(simulation.getDynamicWalls()[0].solid).toBe(false);
  });
});

describe('zones', () => {
  /** A map without walls and with these zones. */
  function zoneMap(zones: Zone[]): GameMap {
    return {
      id: 'zone-test',
      name: 'Zone test',
      description: '',
      createWalls: () => [],
      createZones: () => zones,
    };
  }

  /** One bacterium at (50, 50), with a zone of that kind under it or not. */
  function lone(
    kind: ZoneKind | null,
    options: Parameters<typeof setup>[1] = {}
  ) {
    const scene = setup([[bacterium(50, 50)]], {
      ...options,
      balance: { divideChancePerSec: 0, ...options.balance },
    });
    scene.simulation.setMap(
      zoneMap(
        kind === null ? [] : [{ kind, x: 40, y: 40, width: 20, height: 20 }]
      )
    );
    return scene;
  }

  function run(
    { simulation, players }: ReturnType<typeof setup>,
    seconds: number
  ): void {
    for (let tick = 0; tick < seconds * 60; tick++) {
      simulation.step(players, 1 / 60);
    }
  }

  it('lets an antibiotic kill a bacterium that stays, captured by nobody', () => {
    const poisoned = lone('antibiotic', { targets: [{ x: 50, y: 50 }] });
    const clean = lone(null, { targets: [{ x: 50, y: 50 }] });

    run(poisoned, 3);
    run(clean, 3);

    expect(bacteriaOf(poisoned.colonies[0])).toHaveLength(0);
    expect(poisoned.colonies[0].lost).toBe(1);
    expect(poisoned.simulation.getEvents().captures).toBe(0);
    expect(bacteriaOf(clean.colonies[0])).toHaveLength(1);
  });

  it('doubles the division on agar', () => {
    // A chance of a half per step: the roll of 0.6 misses it, but not twice it.
    const options = {
      balance: { divideChancePerSec: 1 },
      random: () => 0.6,
    };
    const onAgar = lone('agar', options);
    const plain = lone(null, options);

    onAgar.simulation.step(onAgar.players, 0.5);
    plain.simulation.step(plain.players, 0.5);

    expect(bacteriaOf(onAgar.colonies[0])).toHaveLength(2);
    expect(bacteriaOf(plain.colonies[0])).toHaveLength(1);
  });

  it('holds a bacterium on ice back for a step now and then', () => {
    const options = { targets: [{ x: 100, y: 50 }], random: () => 0.4 };
    const onIce = lone('ice', options);
    const plain = lone(null, options);

    onIce.simulation.step(onIce.players, 1 / 60);
    plain.simulation.step(plain.players, 1 / 60);

    expect(bacteriaOf(onIce.colonies[0])[0].x).toBe(50);
    expect(bacteriaOf(plain.colonies[0])[0].x).toBeGreaterThan(50);
  });

  it('makes a colony on hot ground hunt harder, never beyond the crosshair', () => {
    expect(heatedAggression(0.45)).toBeCloseTo(0.7);
    expect(heatedAggression(0.85)).toBe(0.95);
    // A boost that hunts harder already keeps its own.
    expect(heatedAggression(0.98)).toBe(0.98);
  });
});

describe('BacteriaSimulation block counts', () => {
  it('counts each colony into blocks as big as the GPU report', () => {
    const { simulation } = setup([
      [bacterium(1, 1), bacterium(7, 7), bacterium(8, 0)],
      [bacterium(WIDTH - 1, HEIGHT - 1)],
    ]);

    const blocks = simulation.blockCounts();

    const size = gameBalance.influenceCellSize;
    expect(blocks).toMatchObject({
      blocksX: Math.ceil(WIDTH / size),
      blocksY: Math.ceil(HEIGHT / size),
      cellSize: size,
    });
    expect(blocks.counts[0][0]).toBe(2);
    expect(blocks.counts[0][1]).toBe(1);
    expect(blocks.counts[1][blocks.blocksX * blocks.blocksY - 1]).toBe(1);
    expect(blocks.counts[1].reduce((sum, n) => sum + n, 0)).toBe(1);
  });
});

describe('BacteriaSimulation with evolution', () => {
  /** A weapon's effect, fired by `owner`, round (40, 20). */
  function effect(
    weapon: WeaponId,
    owner: number,
    changes: Partial<ActiveEffect> = {}
  ): ActiveEffect {
    return {
      weapon,
      owner,
      x: 40,
      y: 20,
      radius: 6,
      remainingSec: 2,
      durationSec: 2,
      ...changes,
    };
  }
  const STILL = { divideChancePerSec: 0 };

  describe('evolved traits', () => {
    function drained(toughnessFactor?: number): number {
      const defender = bacterium(20, 20);
      const { simulation, colonies, players } = setup(
        [
          [defender],
          [
            bacterium(19, 20),
            bacterium(21, 20),
            bacterium(20, 19),
            bacterium(20, 21),
          ],
        ],
        { balance: STILL }
      );
      colonies[0].traits = { ...colonies[0].traits, toughnessFactor };
      simulation.step(players, 0.05);
      return gameBalance.maxEnergy - defender.energy;
    }

    it('lets a tough colony take less of the pressure', () => {
      expect(drained(0.5)).toBeCloseTo(drained() * 0.5, 5);
    });

    it('lets a colony with flagella travel further in a step', () => {
      function travelled(speedFactor?: number): number {
        const { simulation, colonies, players } = setup([[bacterium(20, 20)]], {
          balance: STILL,
          targets: [{ x: 60, y: 20 }],
        });
        colonies[0].traits = { ...colonies[0].traits, speedFactor };
        simulation.step(players, 0.05);
        return bacteriaOf(colonies[0])[0].x - 20;
      }

      // 150 cells a second for 0.05 seconds: 8 cells, 15 at twice the speed.
      expect(travelled()).toBe(8);
      expect(travelled(2)).toBe(15);
    });
  });

  describe('flagella pace', () => {
    it('carries the part of a step they add from frame to frame', () => {
      const paces = [0];
      const intent = { aggression: 0.5, steps: 3, extraSteps: 0.4 };

      const steps = [1, 2, 3, 4, 5].map(() => paceSteps(intent, paces, 0));

      expect(steps).toEqual([3, 3, 4, 3, 4]);
      expect(paces[0]).toBeCloseTo(0);
    });

    it('leaves a plain colony at its steps, and its pace alone', () => {
      const paces = [0.75];

      expect(
        paceSteps({ aggression: 0.5, steps: 3, extraSteps: 0 }, paces, 0)
      ).toBe(3);
      expect(paces).toEqual([0.75]);
    });

    it('makes a few percent more speed show despite the rounding', () => {
      const player = createPlayer({ x: 300, y: 70, maxSpeed: 150 });
      const plain = colonyIntent(player, gameBalance, 1 / 60);
      const quick = colonyIntent(player, gameBalance, 1 / 60, {
        divideFactor: 1,
        attackFactor: 1,
        cooldownFactor: 1,
        speedFactor: 1.12,
      });
      if (plain === null || quick === null) {
        throw new Error('Both aim at a crosshair');
      }
      const paces = [0];
      let travelled = 0;
      for (let tick = 0; tick < 60; tick++) {
        travelled += paceSteps(quick, paces, 0);
      }

      // 2.5 cells a tick round to 3 either way; 12 % of 2.5 is 0.3 more.
      expect(quick.steps).toBe(plain.steps);
      expect(travelled - 60 * plain.steps).toBeGreaterThanOrEqual(17);
      expect(travelled - 60 * plain.steps).toBeLessThanOrEqual(18);
    });

    it('bound the cells a colony may travel in a frame, boosted', () => {
      const player = createPlayer({ x: 300, y: 70, maxSpeed: 150 });
      const boosted = (150 * gameBalance.boostSpeedFactor) / 60;
      const quick = { divideFactor: 1, attackFactor: 1, cooldownFactor: 1 };

      expect(maxSteps(player, gameBalance, 1 / 60)).toBe(Math.round(boosted));
      expect(
        maxSteps(player, gameBalance, 1 / 60, { ...quick, speedFactor: 1.12 })
      ).toBe(Math.round(boosted) + 1);
      expect(
        maxSteps(player, gameBalance, 1 / 60, { ...quick, speedFactor: 0.9 })
      ).toBe(Math.round(boosted));
    });
  });

  describe('weapons', () => {
    it('lists the effects that act, and drops them once they ran out', () => {
      const { simulation, players } = setup([[bacterium(20, 20)]], {
        balance: STILL,
      });
      const bloom = effect('agar-bloom', 0, {
        remainingSec: 0.1,
        durationSec: 0.1,
      });

      simulation.addEffect(bloom);
      expect(simulation.getActiveEffects()).toEqual([bloom]);
      simulation.step(players, 0.05);
      expect(simulation.getActiveEffects()[0].remainingSec).toBeCloseTo(0.05);
      simulation.step(players, 0.05);
      simulation.step(players, 0.05);
      expect(simulation.getActiveEffects()).toEqual([]);
    });

    it('drains enemy bacteria in a toxin cloud, but not its owner', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(41, 20, 0.2)], [bacterium(39, 24), bacterium(60, 20, 0.2)]],
        { balance: STILL }
      );
      simulation.addEffect(effect('toxin-bomb', 0));

      simulation.step(players, 0.5);

      const [own] = bacteriaOf(colonies[0]);
      const [enemy, outside] = bacteriaOf(colonies[1]);
      expect(enemy.energy).toBeCloseTo(
        gameBalance.maxEnergy - WEAPON_EFFECTS.toxinDrainPerSec * 0.5,
        5
      );
      // Its owner's bacteria and those outside the cloud recover as ever.
      const recovered = 0.2 + gameBalance.energyRegenPerSec * 0.5;
      expect(own.energy).toBeCloseTo(recovered, 5);
      expect(outside.energy).toBeCloseTo(recovered, 5);
    });

    it('kills what stays in a toxin cloud, and nobody captures it', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], [bacterium(40, 20, 0.1)]],
        { balance: STILL }
      );
      simulation.addEffect(effect('toxin-bomb', 0));

      simulation.step(players, 0.5);

      expect(bacteriaOf(colonies[1])).toEqual([]);
      expect(colonies[1].lost).toBe(1);
      expect(colonies[0].captured).toBe(0);
      expect(simulation.getEvents().captures).toBe(0);
    });

    it('drains a neutral colony as any other enemy', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], [bacterium(260, 30)], [bacterium(40, 20)]],
        { balance: STILL }
      );
      simulation.addEffect(effect('toxin-bomb', 1));

      simulation.step(players, 0.5);

      expect(bacteriaOf(colonies[2])[0].energy).toBeLessThan(
        gameBalance.maxEnergy
      );
    });

    it('freezes enemy bacteria in a cryo pulse', () => {
      function moved(withPulse: boolean): number {
        const { simulation, colonies, players } = setup(
          [[bacterium(20, 60)], [bacterium(40, 20)]],
          {
            balance: STILL,
            targets: [
              { x: 20, y: 60 },
              { x: 80, y: 20 },
            ],
          }
        );
        if (withPulse) {
          simulation.addEffect(effect('cryo-pulse', 0));
        }
        simulation.step(players, 0.05);
        return bacteriaOf(colonies[1])[0].x - 40;
      }

      expect(moved(false)).toBeGreaterThan(0);
      // Every roll of 0.5 is below the chance to sit the step out.
      expect(moved(true)).toBe(0);
    });

    it('keeps frozen bacteria from recovering', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(44, 20, 0.2)], [bacterium(40, 20, 0.2)]],
        { balance: STILL }
      );
      simulation.addEffect(effect('cryo-pulse', 0));

      simulation.step(players, 0.5);

      const [own] = bacteriaOf(colonies[0]);
      const [frozen] = bacteriaOf(colonies[1]);
      expect(frozen.energy).toBeCloseTo(0.2, 5);
      expect(own.energy).toBeCloseTo(
        0.2 + gameBalance.energyRegenPerSec * 0.5,
        5
      );
    });

    it('keeps frozen bacteria from dividing as often', () => {
      function divided(weapon: WeaponId | null, owner = 0): number {
        // A chance of a half per step, and every roll 0.3.
        const { simulation, colonies, players } = setup(
          [[bacterium(20, 60)], [bacterium(40, 20)]],
          { balance: { divideChancePerSec: 1 }, random: () => 0.3 }
        );
        if (weapon !== null) {
          simulation.addEffect(effect(weapon, owner));
        }
        simulation.step(players, 0.5);
        return bacteriaOf(colonies[1]).length - 1;
      }

      expect(divided(null)).toBe(1);
      expect(divided('cryo-pulse')).toBe(0);
      // Its own pulse does not freeze a colony.
      expect(divided('cryo-pulse', 1)).toBe(1);
    });

    it('lets its owner divide more often on an agar bloom', () => {
      function divided(owner: number): number[] {
        // A chance of a half per step, and every roll 0.6.
        const { simulation, colonies, players } = setup(
          [[bacterium(40, 20), bacterium(20, 60)], [bacterium(42, 22)]],
          { balance: { divideChancePerSec: 1 }, random: () => 0.6 }
        );
        simulation.addEffect(effect('agar-bloom', owner));
        simulation.step(players, 0.5);
        return colonies.map(({ cells }) => cells.length);
      }

      // The bacterium on the bloom divides, the one beside it does not -
      // nor does the enemy on it.
      expect(divided(0)).toEqual([3, 1]);
      expect(divided(1)).toEqual([2, 2]);
    });

    it('turns enemy bacteria in a phage strike into its own, at once', () => {
      const { simulation, colonies, players } = setup(
        [
          [bacterium(20, 60)],
          [bacterium(40, 20), bacterium(42, 21), bacterium(80, 20)],
        ],
        { balance: STILL, random: () => 0.3 }
      );
      simulation.addEffect(
        effect('phage-strike', 0, { remainingSec: 0, durationSec: 0 })
      );

      simulation.step(players, 0.05);

      expect(bacteriaOf(colonies[0])).toHaveLength(3);
      expect(bacteriaOf(colonies[1])).toHaveLength(1);
      expect(colonies[0].captured).toBe(2);
      expect(colonies[1].lost).toBe(2);
      expect(simulation.getEvents().captures).toBe(2);
      // Shown for a frame, then gone - it struck once.
      expect(simulation.getActiveEffects()).toHaveLength(1);
      simulation.step(players, 0.05);
      expect(simulation.getActiveEffects()).toEqual([]);
    });

    it('looks the striking colony up once per strike, not per bacterium', () => {
      const { simulation, colonies, players } = setup(
        [
          [bacterium(20, 60)],
          [bacterium(40, 20), bacterium(42, 21), bacterium(41, 19)],
        ],
        { balance: STILL, random: () => 0.3 }
      );
      simulation.addEffect(
        effect('phage-strike', 0, { remainingSec: 0, durationSec: 0 })
      );
      const lookups = jest.spyOn(colonies, 'findIndex');

      simulation.step(players, 0.05);

      expect(bacteriaOf(colonies[0])).toHaveLength(4);
      expect(lookups).toHaveBeenCalledTimes(1);
    });

    it('turns only a share of them, by the simulation’s random numbers', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 60)], [bacterium(40, 20), bacterium(42, 21)]],
        { balance: STILL, random: () => 0.5 }
      );
      simulation.addEffect(
        effect('phage-strike', 0, { remainingSec: 0, durationSec: 0 })
      );

      simulation.step(players, 0.05);

      // A roll of 0.5 is above the share a strike turns.
      expect(bacteriaOf(colonies[1])).toHaveLength(2);
    });

    it('shields its owner’s whole colony from the pressure', () => {
      function drained(shielded: boolean): number {
        const defender = bacterium(20, 20);
        const { simulation, players } = setup(
          [
            [defender],
            [
              bacterium(19, 20),
              bacterium(21, 20),
              bacterium(20, 19),
              bacterium(20, 21),
            ],
          ],
          { balance: STILL }
        );
        if (shielded) {
          // Far from the fight: the shield covers the colony, not a circle.
          simulation.addEffect(effect('biofilm-shield', 0, { x: 200 }));
        }
        simulation.step(players, 0.05);
        return gameBalance.maxEnergy - defender.energy;
      }

      expect(drained(true)).toBeCloseTo(
        drained(false) * WEAPON_EFFECTS.shieldToughnessFactor,
        5
      );
    });
  });
});
