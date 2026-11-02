import { WEAPON_EFFECTS } from '../evolution';
import { gameBalance } from '../game-balance';
import { WEAPON_CODE } from '../weapon-effects';
import { frameSeed } from './draws';
import { toQ14 } from './fixed-point';
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
  INT_KIND,
  intClaimAndApply,
  intCombat,
  IntCombatUniforms,
  IntGrid,
  intHunt,
  IntKind,
  intInfluence,
  IntPassUniforms,
  intStateHash,
} from './int-reference';
import { intMatchUniforms } from './int-uniforms';

const WIDTH = 40;
const HEIGHT = 24;
const CELL_SIZE = 8;
const match = intMatchUniforms(gameBalance);

/** A sparse block of the second colony, room to move and divide around each. */
function block(energy = 1): IntGrid {
  const state = new Uint16Array(WIDTH * HEIGHT * 4);
  for (let y = 4; y < 20; y += 2) {
    for (let x = 8; x < 32; x += 2) {
      const at = (y * WIDTH + x) * 4;
      state[at] = 2;
      state[at + 1] = toQ14(energy);
    }
  }
  return {
    width: WIDTH,
    height: HEIGHT,
    state,
    mask: new Uint8Array(WIDTH * HEIGHT),
  };
}

/** One effect of the first colony's over the whole block. */
function effect(
  weapon: keyof typeof WEAPON_CODE,
  radius = 30
): IntEffectUniforms {
  const effects = createIntEffectUniforms();
  const hostile = weapon !== 'agar-bloom';
  setIntEffect(effects, 0, {
    x: 20,
    y: 12,
    radius: radius,
    hostile: hostile,
    kind: WEAPON_CODE[weapon],
    owner: hostile ? 1 : 2,
  });
  effects.count = 1;
  return effects;
}

function passUniforms(effects?: IntEffectUniforms): IntPassUniforms {
  const u = fillIntFrameUniforms(createIntFrameUniforms(), {
    targets: [0, 0, 39, 12, NaN, NaN, NaN, NaN],
    aggression: [0, 0, 0, 0],
    divideChance: [0.1, 0.1, 0, 0],
    divideBudget: [1, 1, 0, 0],
  });
  return {
    ...u,
    steps: [1, 1, 0, 0],
    seed: frameSeed(7, 1),
    jitter: match.jitter,
    divideThreshold: match.divideThreshold,
    parentShare: match.parentShare,
    cellSize: CELL_SIZE,
    effects,
  };
}

function combatUniforms(effects?: IntEffectUniforms): IntCombatUniforms {
  return {
    seed: frameSeed(7, 1),
    match,
    frame: fillIntCombatUniforms(
      createIntFrameUniforms(),
      { attack: [1, 1, 1, 1], toughness: [1, 1, 1, 1], pellets: [] },
      gameBalance.combatDrainPerSec,
      0
    ),
    pelletRadius: gameBalance.nutrientRadius,
    effects,
  };
}

function pass(grid: IntGrid, kind: IntKind, effects?: IntEffectUniforms) {
  const blocksX = Math.ceil(WIDTH / CELL_SIZE);
  const blocksY = Math.ceil(HEIGHT / CELL_SIZE);
  const hunt = intHunt(intInfluence(grid, CELL_SIZE), blocksX, blocksY);
  return intClaimAndApply(grid, passUniforms(effects), hunt, kind, 0);
}

function count(state: Uint16Array, owner: number): number {
  let n = 0;
  for (let i = 0; i < state.length; i += 4) {
    n += state[i] === owner ? 1 : 0;
  }
  return n;
}

/** Cells whose owner changed - two per move. */
function changed(a: Uint16Array, b: Uint16Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    n += a[i] !== b[i] ? 1 : 0;
  }
  return n;
}

describe('the integer weapons', () => {
  it('lets an enemy cryo pulse hold most bacteria in place', () => {
    const g = block();
    const free = changed(g.state, pass(g, INT_KIND.move));
    const frozen = changed(
      g.state,
      pass(g, INT_KIND.move, effect('cryo-pulse'))
    );
    expect(free).toBeGreaterThan(0);
    expect(frozen).toBeLessThan(free * (1 - WEAPON_EFFECTS.cryoStayChance) * 2);
  });

  it('divides less under an enemy cryo pulse and more on an own bloom', () => {
    const g = block();
    const plain = count(pass(g, INT_KIND.divide), 2);
    const cryo = count(pass(g, INT_KIND.divide, effect('cryo-pulse')), 2);
    const bloom = count(pass(g, INT_KIND.divide, effect('agar-bloom')), 2);
    expect(cryo).toBeLessThan(plain);
    expect(bloom).toBeGreaterThan(plain);
  });

  it('drains the enemies in a toxin cloud, not its own colony', () => {
    const g = block(0.5);
    // A bacterium of the first colony inside the cloud, alone.
    const own = (12 * WIDTH + 36) * 4;
    g.state[own] = 1;
    g.state[own + 1] = toQ14(0.5);
    const next = intCombat(g, combatUniforms(effect('toxin-bomb')));
    // Far enough from it to feel no pressure.
    const enemy = (12 * WIDTH + 26) * 4;
    expect(next[enemy + 1]).toBe(toQ14(0.5) - match.toxinStep);
    expect(next[own + 1]).toBe(toQ14(0.5) + match.regenStep);
  });

  it('keeps a bacterium under an enemy cryo pulse from recovering', () => {
    const g = block(0.5);
    const next = intCombat(g, combatUniforms(effect('cryo-pulse')));
    const cell = (12 * WIDTH + 20) * 4;
    expect(next[cell + 1]).toBe(toQ14(0.5));
  });

  it('turns about the phages share of the enemies in their circle', () => {
    const g = block();
    const before = count(g.state, 2);
    const next = intCombat(g, combatUniforms(effect('phage-strike')));
    const turned = count(next, 1);
    expect(turned + count(next, 2)).toBe(before);
    expect(turned / before).toBeGreaterThan(
      WEAPON_EFFECTS.phageConvertShare - 0.15
    );
    expect(turned / before).toBeLessThan(
      WEAPON_EFFECTS.phageConvertShare + 0.15
    );
  });

  it('does nothing with a circle of radius 0 or off the grid', () => {
    const g = block(0.5);
    const none = intStateHash(intCombat(g, combatUniforms()));
    const zero = effect('toxin-bomb', 0);
    const away = createIntEffectUniforms();
    setIntEffect(away, 0, {
      x: -200,
      y: -200,
      radius: 30,
      hostile: true,
      kind: WEAPON_CODE['toxin-bomb'],
      owner: 1,
    });
    away.count = 1;
    expect(intStateHash(intCombat(g, combatUniforms(zero)))).toBe(none);
    expect(intStateHash(intCombat(g, combatUniforms(away)))).toBe(none);
    const moves = intStateHash(pass(g, INT_KIND.move));
    expect(intStateHash(pass(g, INT_KIND.move, effect('cryo-pulse', 0)))).toBe(
      moves
    );
  });
});
