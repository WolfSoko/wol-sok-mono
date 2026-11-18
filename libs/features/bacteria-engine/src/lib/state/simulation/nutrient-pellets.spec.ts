import { gameBalance } from './game-balance';
import { NutrientPellets } from './nutrient-pellets';

const WIDTH = 320;
const HEIGHT = 140;
const everywhere = () => true;

function pellets(nutrientCount = 4) {
  let seed = 0.3;
  const random = () => {
    seed = (seed * 9301 + 0.4927) % 1;
    return seed;
  };
  const field = new NutrientPellets(
    { ...gameBalance, nutrientCount, nutrientRespawnDelaySec: 1 },
    random
  );
  field.reset(WIDTH, HEIGHT, everywhere);
  return field;
}

describe('NutrientPellets', () => {
  it('spawns full pellets in pairs mirrored through the centre', () => {
    const [a, b] = pellets().nutrients;

    expect(a.amount).toBe(gameBalance.nutrientEnergy);
    expect(b).toEqual({
      x: WIDTH - 1 - a.x,
      y: HEIGHT - 1 - a.y,
      amount: gameBalance.nutrientEnergy,
    });
  });

  it('only spawns where the arena is free', () => {
    const field = pellets(8);
    field.reset(WIDTH, HEIGHT, (x) => x > 200 || x < 119);

    for (const { x } of field.nutrients) {
      expect(x <= 118 || x >= 201).toBe(true);
    }
  });

  it('reports the bite that eats a pellet up, and only that one', () => {
    const field = pellets();

    expect(field.drain(0, [1], gameBalance.nutrientEnergy / 2)).toBeNull();
    expect(field.drain(0, [1], gameBalance.nutrientEnergy)).toEqual({ by: 0 });
    expect(field.nutrients[0].amount).toBe(0);
    expect(field.drain(0, [1], 1)).toBeNull();
  });

  it('gives a pellet to the colony that took the most of it all along', () => {
    const field = pellets();
    const quarter = gameBalance.nutrientEnergy / 4;

    // The second colony takes two quarters early, the first one the last.
    expect(field.drain(0, [0, 2], quarter)).toBeNull();
    expect(field.drain(0, [1, 1], quarter)).toEqual({ by: 1 });
  });

  it('counts a last bite only for what was left of the pellet', () => {
    const field = pellets();
    const energy = gameBalance.nutrientEnergy;

    // The first colony takes all but a sliver; the last bite of the second
    // would be a whole pellet, but only the sliver is left.
    expect(field.drain(0, [1, 0], energy * 0.9)).toBeNull();
    expect(field.drain(0, [0, 1], energy)).toEqual({ by: 0 });
  });

  it('gives a pellet to nobody when two colonies took as much of it', () => {
    const field = pellets();

    expect(field.drain(0, [1, 1], gameBalance.nutrientEnergy)).toEqual({
      by: null,
    });
  });

  it('counts bites anew once a pellet is placed again', () => {
    const field = pellets();
    const half = gameBalance.nutrientEnergy / 2;
    field.drain(0, [0, 2], half);
    field.drain(1, [0, 2], half);
    field.tickEmpty(0, 5);
    field.tickEmpty(1, 5);

    expect(field.drain(0, [2, 0], half)).toEqual({ by: 0 });
  });

  it('brings a pair back once both are eaten and the delay is over', () => {
    const field = pellets();
    field.drain(0, [1], 100);

    // The partner is still being eaten from - nothing moves yet.
    field.tickEmpty(0, 2);
    expect(field.nutrients[0].amount).toBe(0);
    const generation = field.generations[0];

    field.drain(1, [1], 100);
    field.tickEmpty(1, 3);

    expect(field.generations[0]).toBe(generation + 1);
    expect(field.generations[1]).toBe(generation + 1);

    expect(field.nutrients[0].amount).toBe(gameBalance.nutrientEnergy);
    expect(field.nutrients[1].amount).toBe(gameBalance.nutrientEnergy);
  });
});
