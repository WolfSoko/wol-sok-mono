import { BacteriaSimulation, Colony } from './bacteria-simulation';
import { createWalls, GameBalance, gameBalance } from './game-balance';
import { Bacteria, createPlayer, Player } from './player.model';

const WIDTH = 60;
const HEIGHT = 40;

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
    colonies[index].bacterias = bacterias;
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
      const defender = bacterium(20, 20);
      const { simulation, players } = setup([
        [defender],
        [
          bacterium(19, 20),
          bacterium(21, 20),
          bacterium(20, 19),
          bacterium(20, 21),
        ],
      ]);

      simulation.step(players, 0.05);

      expect(defender.energy).toBeLessThan(gameBalance.maxEnergy);
    });

    it('converts a surrounded bacterium to the attacking colony', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], ring(20, 20)],
        { balance: { divideChancePerSec: 0, consumeChance: 0 } }
      );

      simulation.step(players, 1);

      expect(colonies[0].bacterias).toHaveLength(0);
      expect(colonies[0].lost).toBe(1);
      expect(colonies[1].bacterias).toHaveLength(9);
      expect(colonies[1].captured).toBe(1);
    });

    it('gives the converted bacterium the capture energy so it can be won back', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], ring(20, 20)],
        { balance: { divideChancePerSec: 0, consumeChance: 0 } }
      );

      simulation.step(players, 1);

      expect(
        colonies[1].bacterias.some(
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

      expect(colonies[0].bacterias).toHaveLength(0);
      expect(colonies[1].bacterias).toHaveLength(8);
      expect(colonies[1].captured).toBe(1);
    });

    it('lets a bacterium regenerate while nobody attacks it', () => {
      const lonely = bacterium(20, 20, 0.2);
      const { simulation, players } = setup([[lonely], [bacterium(50, 5)]], {
        balance: { divideChancePerSec: 0 },
      });

      simulation.step(players, 0.5);

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

      expect(colonies[0].bacterias).toHaveLength(2);
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

      const total = colonies[0].bacterias.reduce(
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

      expect(colonies[0].bacterias).toHaveLength(1);
    });

    it('stops dividing once the arena is at its carrying capacity', () => {
      const { simulation, colonies, players } = setup(
        [[bacterium(20, 20)], [bacterium(40, 20)]],
        {
          balance: { divideChancePerSec: 1, maxTotalBacteria: 2 },
          random: () => 0,
        }
      );

      simulation.step(players, 0.5);

      expect(colonies[0].bacterias.length + colonies[1].bacterias.length).toBe(
        2
      );
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

      expect(colonies[0].bacterias).toHaveLength(3);
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

      const isInWall = colonies[0].bacterias.some((bac) =>
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

    it('keeps every bacterium inside the arena', () => {
      const { simulation, colonies, players } = setup([[bacterium(1, 1)]], {
        targets: [{ x: -50, y: -50 }],
      });

      for (let frame = 0; frame < 30; frame++) {
        simulation.step(players, 1 / 60);
      }

      for (const bac of colonies[0].bacterias) {
        expect(bac.x).toBeGreaterThanOrEqual(0);
        expect(bac.y).toBeGreaterThanOrEqual(0);
        expect(bac.x).toBeLessThan(WIDTH);
        expect(bac.y).toBeLessThan(HEIGHT);
      }
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
        .flatMap((colony) => colony.bacterias)
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
      const fed = bacterium(nutrient.x, nutrient.y);
      (simulation.getColonies() as Colony[])[0].bacterias = [fed];
      const players = [
        createPlayer({
          id: 0,
          x: nutrient.x,
          y: nutrient.y,
          color: [255, 0, 0, 255],
        }),
      ];

      simulation.step(players, 0.5);

      expect(fed.energy).toBeGreaterThan(gameBalance.maxEnergy);
      expect(fed.energy).toBeLessThanOrEqual(gameBalance.superChargedMaxEnergy);
      expect(simulation.getNutrients()[0].amount).toBeLessThan(
        gameBalance.nutrientEnergy
      );
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

    it('never spawns a nutrient inside a wall', () => {
      const walls = createWalls(WIDTH, HEIGHT);
      const simulation = new BacteriaSimulation(balance({ nutrientCount: 24 }));
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
      colonies[0].bacterias.reduce((sum, bac) => sum + bac.energy, 0),
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
    expect(colony.bacterias.length).toBeGreaterThan(50);
    expect(
      colony.bacterias.every((bac) => bac.energy === gameBalance.maxEnergy)
    ).toBe(true);
  });
});

describe('createWalls', () => {
  it('is point symmetric so neither player gets the better half', () => {
    const walls = createWalls(WIDTH, HEIGHT);
    const solid = (x: number, y: number) =>
      walls.some(
        (rect) =>
          x >= rect.x &&
          x < rect.x + rect.width &&
          y >= rect.y &&
          y < rect.y + rect.height
      );

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        expect(solid(x, y)).toBe(solid(WIDTH - 1 - x, HEIGHT - 1 - y));
      }
    }
  });
});
