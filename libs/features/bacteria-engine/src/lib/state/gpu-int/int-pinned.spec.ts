import { gameBalance } from '../game-balance';
import { WEAPON_CODE } from '../weapon-effects';
import { WALL_BIT, ZONE_CODE, ZONE_SHIFT } from '../zones';
import { drawAt, frameSeed } from './draws';
import {
  createIntEffectUniforms,
  IntEffectUniforms,
  setIntEffect,
} from './int-effects';
import {
  createIntFrameUniforms,
  fillIntCombatUniforms,
  fillIntFrameUniforms,
} from './int-frame-uniforms';
import {
  beginIntClaimSteps,
  INT_KIND,
  INT_RECORD,
  intClaimAndApply,
  intClaimStep,
  intCombat,
  intCrush,
  intFeed,
  IntGrid,
  intHunt,
  intInfluence,
  IntPassScratch,
  intStateHash,
} from './int-reference';
import { intReferenceTick, IntStateBuffers, IntTickInputs } from './int-tick';
import { intMatchUniforms } from './int-uniforms';

/**
 * Pins what the integer reference computes on a crowded, irregular arena to
 * the hashes it gave before its passes were made faster (#3065): every
 * rewrite of a pass has to land on them byte for byte. The arena's size is
 * no multiple of the coarse cell, four colonies crowd it with walls, every
 * zone and every weapon effect, and each texel channel holds a draw, so the
 * edges, the caps and the records are all in play.
 */

const WIDTH = 37;
const HEIGHT = 23;
const CELL_SIZE = 8;
const SEED = 0x5eed;
const match = intMatchUniforms(gameBalance);

/** A draw of the arena's own, apart from the passes' salts. */
const pick = (x: number, y: number, salt: number) =>
  drawAt(x, y, SEED, 1000 + salt);

function crowdedArena(): IntGrid {
  const state = new Uint16Array(WIDTH * HEIGHT * 4);
  const mask = new Uint8Array(WIDTH * HEIGHT);
  const zones = [ZONE_CODE.ice, ZONE_CODE.heat, ZONE_CODE.agar];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const cell = y * WIDTH + x;
      const ground = pick(x, y, 1) % 20;
      // A zone in bands, a wall here and there - some under a bacterium.
      const zone =
        x < 9 ? ZONE_CODE.antibiotic : zones[Math.floor(x / 10) % zones.length];
      mask[cell] = (zone << ZONE_SHIFT) | (ground === 0 ? WALL_BIT : 0);
      if (pick(x, y, 2) % 10 < 6) {
        const at = cell * 4;
        state[at] = 1 + (pick(x, y, 3) % 4);
        state[at + 1] = pick(x, y, 4) % 0x8000;
        state[at + 2] = pick(x, y, 5) % 0x400;
        state[at + 3] = pick(x, y, 6) % 0x100;
      }
    }
  }
  return { width: WIDTH, height: HEIGHT, state, mask };
}

/** One of each weapon's circles, hostile or not, on the crowded part. */
function everyEffect(): IntEffectUniforms {
  const effects = createIntEffectUniforms();
  const circles = [
    { x: 12, y: 8, radius: 6, hostile: false, kind: 'cryo-pulse', owner: 1 },
    { x: 26, y: 14, radius: 7, hostile: true, kind: 'phage-strike', owner: 2 },
    { x: 6, y: 18, radius: 5, hostile: true, kind: 'toxin-bomb', owner: 3 },
    { x: 30, y: 4, radius: 8, hostile: false, kind: 'agar-bloom', owner: 4 },
  ] as const;
  circles.forEach(({ kind, ...circle }, index) =>
    setIntEffect(effects, index, { ...circle, kind: WEAPON_CODE[kind] })
  );
  effects.count = circles.length;
  return effects;
}

function inputs(tick: number): IntTickInputs {
  const frame = fillIntFrameUniforms(createIntFrameUniforms(), {
    targets: [WIDTH * 0.9, HEIGHT * 0.1, 2, HEIGHT - 2, WIDTH / 2, 0, 0, 0],
    aggression: [0.5, 0.9, 0.2, 0.7],
    divideChance: [0.4, 0.6, 0.3, 0.5],
    divideBudget: [40, 40, 40, 40],
  });
  fillIntCombatUniforms(
    frame,
    {
      attack: [1, 1.3, 0.8, 1.1],
      toughness: [1, 0.9, 1.2, 1],
      pellets: [5, 5, 1, 30, 20, 1, 18, 11, 0],
    },
    gameBalance.combatDrainPerSec,
    3
  );
  return {
    pass: {
      ...frame,
      steps: [3, 2, 1, 3],
      seed: frameSeed(SEED, tick),
      jitter: match.jitter,
      divideThreshold: match.divideThreshold,
      parentShare: match.parentShare,
      cellSize: CELL_SIZE,
      effects: everyEffect(),
    },
    combat: { frame, pelletRadius: gameBalance.nutrientRadius },
    match,
    moveSteps: 3,
    escapeSteps: 2,
  };
}

function hunt(grid: IntGrid): Int32Array {
  return intHunt(
    intInfluence(grid, CELL_SIZE),
    Math.ceil(WIDTH / CELL_SIZE),
    Math.ceil(HEIGHT / CELL_SIZE)
  );
}

/** The shader's feeding, a gather over every cell's neighbours. */
function gatheredFeed(grid: IntGrid, feed: number): Uint16Array {
  const { width, height, state } = grid;
  const out = state.slice();
  const killer = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height
      ? 0
      : state[(y * width + x) * 4 + 3] & INT_RECORD.mask;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      const owner = state[at];
      let food = killer(x, y) !== 0 ? feed : 0;
      for (let dy = -1; owner !== 0 && dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx !== 0 || dy !== 0) && killer(x + dx, y + dy) === owner) {
            food += feed;
          }
        }
      }
      out[at + 2] = Math.min(food, 0xffff);
    }
  }
  return out;
}

describe('the integer reference, pinned', () => {
  it('feeds as the shader gathers, up to the cap', () => {
    const grid = crowdedArena();
    for (const feed of [0, 1, 700, 0x3000, 0xffff, 0x10000]) {
      expect(intFeed(grid, feed)).toEqual(gatheredFeed(grid, feed));
    }
  });

  it('claims and applies each kind of step as before', () => {
    const grid = crowdedArena();
    const u = inputs(1).pass;
    const hashes = [INT_KIND.move, INT_KIND.escape, INT_KIND.divide].map(
      (kind) =>
        [0, 2].map((step) =>
          intStateHash(intClaimAndApply(grid, u, hunt(grid), kind, step))
        )
    );
    expect(hashes).toEqual(PINNED.claims);
  });

  it('runs steps in place as step after step into new states', () => {
    for (const kind of [INT_KIND.move, INT_KIND.escape, INT_KIND.divide]) {
      const grid = crowdedArena();
      const u = inputs(1).pass;
      const scratch = new IntPassScratch(WIDTH, HEIGHT);
      const inPlace: IntGrid = { ...grid, state: grid.state.slice() };
      let state = grid.state;
      beginIntClaimSteps(inPlace, scratch);
      for (let step = 0; step < 4; step++) {
        state = intClaimAndApply({ ...grid, state }, u, hunt(grid), kind, step);
        intClaimStep(inPlace, u, hunt(grid), kind, step, scratch);
        expect(intStateHash(inPlace.state)).toBe(intStateHash(state));
      }
      // The list of bacteria the steps kept is the state's.
      const listed = Array.from(
        scratch.occupied.subarray(0, scratch.occupiedCount)
      ).sort((a, b) => a - b);
      const occupied = [];
      for (let cell = 0; cell < WIDTH * HEIGHT; cell++) {
        if (state[cell * 4] !== 0) {
          occupied.push(cell);
        }
      }
      expect(listed).toEqual(occupied);
    }
  });

  it('crushes, fights and feeds as before', () => {
    const grid = crowdedArena();
    const { pass, combat } = inputs(1);
    const fought = intCombat(grid, {
      ...combat,
      seed: pass.seed,
      match,
      effects: pass.effects,
    });
    expect({
      crush: intStateHash(intCrush(grid)),
      combat: intStateHash(fought),
      feed: intStateHash(intFeed(grid, match.feed)),
      feedAfterCombat: intStateHash(
        intFeed({ ...grid, state: fought }, match.feed)
      ),
      feedCapped: intStateHash(intFeed(grid, 0x3000)),
    }).toEqual(PINNED.passes);
  });

  it('fights as before on grids one or two cells across', () => {
    const { pass, combat } = inputs(1);
    const hashes = [
      [1, 9],
      [9, 1],
      [2, 2],
      [2, 7],
    ].map(([width, height]) => {
      const full = crowdedArena();
      const state = new Uint16Array(width * height * 4);
      const mask = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const from = y * WIDTH + x;
          const to = y * width + x;
          // Every cell taken, so each one fights its neighbours.
          state.set(full.state.subarray(from * 4, from * 4 + 4), to * 4);
          state[to * 4] = 1 + ((x + 2 * y) % 4);
          mask[to] = full.mask[from] & ~WALL_BIT;
        }
      }
      const grid: IntGrid = { width, height, state, mask };
      return intStateHash(
        intCombat(grid, {
          ...combat,
          seed: pass.seed,
          match,
          effects: pass.effects,
        })
      );
    });
    expect(hashes).toEqual(PINNED.thinCombat);
  });

  it('plays ticks as before, with buffers and without', () => {
    const play = (buffered: boolean) => {
      let grid = crowdedArena();
      const scratch = new IntPassScratch(WIDTH, HEIGHT);
      const buffers = buffered
        ? new IntStateBuffers(grid.state.length)
        : undefined;
      const hashes: number[] = [];
      for (let tick = 1; tick <= 12; tick++) {
        const state = intReferenceTick(
          grid,
          inputs(tick),
          scratch,
          undefined,
          buffers
        );
        grid = { ...grid, state };
        hashes.push(intStateHash(state));
      }
      return hashes;
    };
    expect(play(false)).toEqual(PINNED.ticks);
    expect(play(true)).toEqual(PINNED.ticks);
  });
});

/** The hashes before #3065, from the passes as first written. */
const PINNED = {
  claims: [
    [2843077619, 1714707291],
    [980428807, 2709595535],
    [3119893555, 2647256605],
  ],
  passes: {
    combat: 3473950903,
    crush: 2423852437,
    feed: 2336226921,
    feedAfterCombat: 1626358162,
    feedCapped: 1179054135,
  },
  thinCombat: [593413821, 1780570608, 2731327130, 2171089197],
  ticks: [
    2605390273, 18879247, 2848945546, 404760456, 2066393117, 3844949362,
    3490395657, 2636860827, 2012641909, 2814506934, 1951114748, 3004838780,
  ],
};
