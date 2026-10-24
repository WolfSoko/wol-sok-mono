import { gameBalance } from '../game-balance';
import { ZONE_CODE } from '../zones';
import { frameSeed } from './draws';
import { toQ14 } from './fixed-point';
import { createIntFrameUniforms, DIVIDE_VARIANTS } from './int-frame-uniforms';
import {
  INT_KIND,
  IntPassScratch,
  intClaimAndApply,
  IntGrid,
  intHunt,
  intInfluence,
  IntPassUniforms,
  intStateHash,
} from './int-reference';
import { intMatchUniforms } from './int-uniforms';

const WIDTH = 48;
const HEIGHT = 32;
const CELL_SIZE = 8;

/** Two colonies facing each other across a wall with a gap, on ice and agar. */
function scenario(): IntGrid {
  const state = new Uint16Array(WIDTH * HEIGHT * 4);
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    if (y < 12 || y > 18) {
      mask[y * WIDTH + 24] = 1;
    }
    for (let x = 30; x < 40; x++) {
      mask[y * WIDTH + x] |= ZONE_CODE.ice << 1;
    }
    for (let x = 4; x < 10; x++) {
      mask[y * WIDTH + x] |= ZONE_CODE.agar << 1;
    }
  }
  for (let y = 10; y < 22; y++) {
    for (let x = 4; x < 14; x++) {
      put(state, x, y, 1, 0.6 + ((x + y) % 5) * 0.1);
    }
    for (let x = 34; x < 44; x++) {
      put(state, x, y, 2, 0.9);
    }
  }
  return { width: WIDTH, height: HEIGHT, state, mask };
}

function put(
  state: Uint16Array,
  x: number,
  y: number,
  owner: number,
  energy: number
): void {
  const at = (y * WIDTH + x) * 4;
  state[at] = owner;
  state[at + 1] = toQ14(Math.min(1, energy));
}

function uniforms(frame: number): IntPassUniforms {
  const fixed = intMatchUniforms(gameBalance);
  const u = createIntFrameUniforms();
  u.targets.set([40 * 16, 16 * 16, 6 * 16, 15 * 16]);
  u.aggression.set([toQ14(0.5), toQ14(0.3)]);
  u.divideChance.fill(0x40000000);
  return {
    ...u,
    steps: [3, 2, 0, 0],
    seed: frameSeed(1234, frame),
    jitter: fixed.jitter,
    divideThreshold: fixed.divideThreshold,
    parentShare: fixed.parentShare,
    cellSize: CELL_SIZE,
  };
}

/** A frame of the integer passes: hunt, division, then movement. */
function frame(grid: IntGrid, n: number): IntGrid {
  const u = uniforms(n);
  const blocksX = Math.ceil(grid.width / CELL_SIZE);
  const blocksY = Math.ceil(grid.height / CELL_SIZE);
  const hunt = intHunt(intInfluence(grid, CELL_SIZE), blocksX, blocksY);
  let state = intClaimAndApply(grid, u, hunt, INT_KIND.divide, 0);
  for (let step = 0; step < 3; step++) {
    state = intClaimAndApply({ ...grid, state }, u, hunt, INT_KIND.move, step);
  }
  return { ...grid, state };
}

function play(frames: number): IntGrid {
  let grid = scenario();
  for (let n = 1; n <= frames; n++) {
    grid = frame(grid, n);
  }
  return grid;
}

function census(grid: IntGrid): { count: number; energy: number } {
  let count = 0;
  let energy = 0;
  for (let i = 0; i < grid.width * grid.height; i++) {
    if (grid.state[i * 4] !== 0) {
      count++;
      energy += grid.state[i * 4 + 1];
    }
  }
  return { count, energy };
}

describe('the integer reference', () => {
  it('plays the same from the same seed', () => {
    expect(intStateHash(play(20).state)).toBe(intStateHash(play(20).state));
  });

  it('plays differently from another match seed', () => {
    const grid = scenario();
    const blocks = [
      Math.ceil(WIDTH / CELL_SIZE),
      Math.ceil(HEIGHT / CELL_SIZE),
    ];
    const hunt = intHunt(intInfluence(grid, CELL_SIZE), blocks[0], blocks[1]);
    const a = intClaimAndApply(grid, uniforms(1), hunt, INT_KIND.move, 0);
    const b = intClaimAndApply(
      grid,
      { ...uniforms(1), seed: frameSeed(99, 1) },
      hunt,
      INT_KIND.move,
      0
    );
    expect(intStateHash(a)).not.toBe(intStateHash(b));
  });

  it('writes into the buffers it is given, to the same result', () => {
    const grid = scenario();
    const blocks = [
      Math.ceil(WIDTH / CELL_SIZE),
      Math.ceil(HEIGHT / CELL_SIZE),
    ];
    const hunt = intHunt(intInfluence(grid, CELL_SIZE), blocks[0], blocks[1]);
    const out = new Uint16Array(grid.state.length);
    const scratch = new IntPassScratch(WIDTH, HEIGHT);
    const given = intClaimAndApply(
      grid,
      uniforms(1),
      hunt,
      INT_KIND.move,
      0,
      scratch,
      out
    );
    const fresh = intClaimAndApply(grid, uniforms(1), hunt, INT_KIND.move, 0);
    expect(given).toBe(out);
    expect(intStateHash(given)).toBe(intStateHash(fresh));
  });

  it('moves bacteria without losing or doubling any', () => {
    const before = census(scenario());
    const grid = scenario();
    const blocks = [
      Math.ceil(WIDTH / CELL_SIZE),
      Math.ceil(HEIGHT / CELL_SIZE),
    ];
    const hunt = intHunt(intInfluence(grid, CELL_SIZE), blocks[0], blocks[1]);
    let state = grid.state;
    for (let step = 0; step < 3; step++) {
      state = intClaimAndApply(
        { ...grid, state },
        uniforms(1),
        hunt,
        INT_KIND.move,
        step
      );
    }
    const after = census({ ...grid, state });
    expect(after).toEqual(before);
    expect(intStateHash(state)).not.toBe(intStateHash(grid.state));
  });

  it('conserves the energy exactly when bacteria divide', () => {
    const grid = scenario();
    const before = census(grid);
    const hunt = new Int32Array(1024);
    const state = intClaimAndApply(grid, uniforms(1), hunt, INT_KIND.divide, 0);
    const after = census({ ...grid, state });
    expect(after.count).toBeGreaterThan(before.count);
    expect(after.energy).toBe(before.energy);
  });

  it('only divides above the threshold', () => {
    const grid = scenario();
    const u = { ...uniforms(1), divideThreshold: 0xffff };
    const state = intClaimAndApply(
      grid,
      u,
      new Int32Array(1024),
      INT_KIND.divide,
      0
    );
    expect(intStateHash(state)).toBe(intStateHash(grid.state));
  });

  it('never divides with a threshold of zero', () => {
    const grid = scenario();
    const u = uniforms(1);
    u.divideChance.fill(0, 0, 2 * DIVIDE_VARIANTS);
    const state = intClaimAndApply(
      grid,
      u,
      new Int32Array(1024),
      INT_KIND.divide,
      0
    );
    expect(intStateHash(state)).toBe(intStateHash(grid.state));
  });

  it('keeps bacteria off the walls', () => {
    const grid = play(30);
    let onWalls = 0;
    for (let i = 0; i < WIDTH * HEIGHT; i++) {
      onWalls += (grid.mask[i] & 1) !== 0 && grid.state[i * 4] !== 0 ? 1 : 0;
    }
    expect(onWalls).toBe(0);
    expect(census(grid).count).toBeGreaterThan(census(scenario()).count);
  });

  it('escapes bacteria a wall covers into free cells', () => {
    const grid = scenario();
    const mask = grid.mask.slice();
    // A wall slides over a column of the first colony.
    for (let y = 10; y < 22; y++) {
      mask[y * WIDTH + 9] |= 1;
    }
    const covered = { ...grid, mask };
    let state = covered.state;
    for (let step = 0; step < 3; step++) {
      state = intClaimAndApply(
        { ...covered, state },
        uniforms(1),
        new Int32Array(1024),
        INT_KIND.escape,
        step
      );
    }
    let onWall = 0;
    for (let y = 10; y < 22; y++) {
      onWall += state[(y * WIDTH + 9) * 4] !== 0 ? 1 : 0;
    }
    expect(onWall).toBeLessThan(12);
    expect(census({ ...covered, state })).toEqual(census(grid));
  });
});
