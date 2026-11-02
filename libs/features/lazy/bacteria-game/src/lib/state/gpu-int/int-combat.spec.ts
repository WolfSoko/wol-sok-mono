import { gameBalance } from '../game-balance';
import { ZONE_CODE } from '../zones';
import { frameSeed } from './draws';
import { toQ14 } from './fixed-point';
import {
  createIntFrameUniforms,
  fillIntCombatUniforms,
} from './int-frame-uniforms';
import {
  intCombat,
  IntCombatUniforms,
  intCrush,
  intFeed,
  IntGrid,
  intStateHash,
} from './int-reference';
import { INT_ENERGY_MAX, intMatchUniforms } from './int-uniforms';

const WIDTH = 32;
const HEIGHT = 16;
const match = intMatchUniforms(gameBalance);

function grid(): IntGrid {
  return {
    width: WIDTH,
    height: HEIGHT,
    state: new Uint16Array(WIDTH * HEIGHT * 4),
    mask: new Uint8Array(WIDTH * HEIGHT),
  };
}

function put(g: IntGrid, x: number, y: number, owner: number, energy: number) {
  const at = (y * WIDTH + x) * 4;
  g.state[at] = owner;
  g.state[at + 1] = toQ14(energy);
}

function at(g: IntGrid | Uint16Array, x: number, y: number) {
  const state = g instanceof Uint16Array ? g : g.state;
  const i = (y * WIDTH + x) * 4;
  return Array.from(state.subarray(i, i + 4));
}

/** Two colonies along a front at x = 16, the second one three times as strong. */
function front(): IntGrid {
  const g = grid();
  for (let y = 2; y < 14; y++) {
    for (let x = 8; x < 16; x++) {
      put(g, x, y, 1, 0.5);
    }
    for (let x = 16; x < 24; x++) {
      put(g, x, y, 2, 1);
    }
  }
  return g;
}

function uniforms(
  frame: number,
  attack = [1, 3],
  pellets: number[] = []
): IntCombatUniforms {
  const u = fillIntCombatUniforms(
    createIntFrameUniforms(),
    { attack, toughness: [1, 1, 1, 1], pellets },
    gameBalance.combatDrainPerSec,
    pellets.length / 3
  );
  return {
    seed: frameSeed(99, frame),
    match,
    frame: u,
    pelletRadius: gameBalance.nutrientRadius,
  };
}

/** Crush, combat and feed, as a frame of the GPU runs them. */
function fight(g: IntGrid, n: number, u = uniforms(n)): IntGrid {
  let next = { ...g, state: intCrush(g) };
  next = { ...next, state: intCombat(next, u) };
  return { ...next, state: intFeed(next, match.feed) };
}

function count(g: IntGrid, owner: number): number {
  let n = 0;
  for (let i = 0; i < g.state.length; i += 4) {
    n += g.state[i] === owner ? 1 : 0;
  }
  return n;
}

describe('the integer combat', () => {
  it('fights the same from the same seed, differently from another', () => {
    let a = front();
    let b = front();
    let c = front();
    for (let n = 0; n < 40; n++) {
      a = fight(a, n);
      b = fight(b, n);
      c = fight(c, n, { ...uniforms(n), seed: frameSeed(100, n) });
    }
    expect(intStateHash(a.state)).toBe(intStateHash(b.state));
    expect(intStateHash(a.state)).not.toBe(intStateHash(c.state));
  });

  it('lets the stronger colony take cells off the front', () => {
    let g = front();
    const before = count(g, 2);
    for (let n = 0; n < 120; n++) {
      g = fight(g, n);
    }
    expect(count(g, 2)).toBeGreaterThan(before);
    expect(count(g, 1)).toBeLessThan(12 * 8);
  });

  it('never holds more energy than the super charged ceiling', () => {
    let g = front();
    // A pellet right under the first colony keeps feeding it.
    const pellets = [10, 8, 1];
    for (let n = 0; n < 200; n++) {
      g = fight(g, n, uniforms(n, [1, 3], pellets));
      for (let i = 0; i < g.state.length; i += 4) {
        expect(g.state[i + 1]).toBeLessThanOrEqual(match.superMaxEnergy);
      }
    }
    expect(match.superMaxEnergy).toBeLessThanOrEqual(INT_ENERGY_MAX);
  });

  it('regains energy without enemies, up to the ceiling', () => {
    const g = grid();
    put(g, 4, 4, 1, 0.2);
    let state = g.state;
    for (let n = 0; n < 1000; n++) {
      state = intCombat({ ...g, state }, uniforms(n));
    }
    expect(at(state, 4, 4)).toEqual([1, match.maxEnergy, 0, 0]);
    const one = intCombat(g, uniforms(0));
    expect(at(one, 4, 4)[1]).toBe(toQ14(0.2) + match.regenStep);
  });

  it('records each capture once, for the capturer and the loser', () => {
    let g = front();
    let captured = 0;
    let freed = 0;
    // Records that do not name the cell's loser, or a capture that is not
    // the capturer's with the capture energy.
    const wrong: number[][] = [];
    for (let n = 0; n < 120; n++) {
      const before = { ...g, state: intCrush(g) };
      const after = intCombat(before, uniforms(n));
      for (let i = 0; i < after.length; i += 4) {
        const record = after[i + 3];
        if (record === 0) {
          continue;
        }
        const loserOk = ((record >> 3) & 7) === before.state[i];
        const freedCell = after[i] === 0;
        const captureOk =
          freedCell ||
          (after[i] === (record & 7) && after[i + 1] === match.captureEnergy);
        if (!loserOk || !captureOk) {
          wrong.push([n, i >> 2, record, after[i], after[i + 1]]);
        }
        freed += freedCell ? 1 : 0;
        captured += freedCell ? 0 : 1;
      }
      g = {
        ...before,
        state: intFeed({ ...before, state: after }, match.feed),
      };
    }
    expect(wrong).toEqual([]);
    // Half the kills are digested and free their cell.
    expect(freed).toBeGreaterThan(0);
    expect(captured).toBeGreaterThan(0);
  });

  it('feeds the captured cell and the killers around it', () => {
    const g = grid();
    put(g, 5, 5, 2, 0.35);
    g.state[(5 * WIDTH + 5) * 4 + 3] = 2 | (1 << 3);
    put(g, 6, 5, 2, 1);
    put(g, 4, 5, 1, 1);
    const fed = intFeed(g, match.feed);
    // The captured cell: its own record, and its killer neighbour is itself.
    expect(at(fed, 5, 5)[2]).toBe(match.feed);
    expect(at(fed, 6, 5)[2]).toBe(match.feed);
    expect(at(fed, 4, 5)[2]).toBe(0);
  });

  it('drains and kills on antibiotic ground, lost to nobody', () => {
    const g = grid();
    // Less than one step of the drain.
    put(g, 3, 3, 1, 0.005);
    g.mask[3 * WIDTH + 3] = ZONE_CODE.antibiotic << 1;
    expect(toQ14(0.005)).toBeLessThan(match.antibioticStep);
    const next = intCombat(g, uniforms(0));
    expect(at(next, 3, 3)).toEqual([0, 0, 0, (1 << 3) | (1 << 6)]);
  });

  it('crushes bacteria on a wall', () => {
    const g = grid();
    put(g, 2, 2, 1, 1);
    g.mask[2 * WIDTH + 2] = 1;
    expect(at(intCrush(g), 2, 2)).toEqual([0, 0, 0, 1 << 3]);
  });
});
