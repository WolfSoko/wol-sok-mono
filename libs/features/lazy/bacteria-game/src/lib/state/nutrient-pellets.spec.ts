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

    expect(field.drain(0, 1, gameBalance.nutrientEnergy / 2)).toBe(false);
    expect(field.drain(0, 1, gameBalance.nutrientEnergy)).toBe(true);
    expect(field.nutrients[0].amount).toBe(0);
    expect(field.drain(0, 1, 1)).toBe(false);
  });

  it('brings a pair back once both are eaten and the delay is over', () => {
    const field = pellets();
    field.drain(0, 1, 100);
    field.tickEmpty(0, 2, WIDTH, HEIGHT, everywhere);

    // The partner is still being eaten from - nothing moves yet.
    expect(field.nutrients[0].amount).toBe(0);

    field.drain(1, 1, 100);
    field.tickEmpty(0, 2, WIDTH, HEIGHT, everywhere);

    expect(field.nutrients[0].amount).toBe(gameBalance.nutrientEnergy);
    expect(field.nutrients[1].amount).toBe(gameBalance.nutrientEnergy);
  });
});
