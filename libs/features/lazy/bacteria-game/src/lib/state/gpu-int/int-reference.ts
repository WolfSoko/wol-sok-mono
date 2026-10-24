import { WEAPON_CODE } from '../weapon-effects';
import { WALL_BIT, ZONE_CODE, ZONE_SHIFT } from '../zones';
import { drawAt, PICK_OF_8_SHIFT, SALT, stepSalt } from './draws';
import {
  mulQ14,
  mulShr,
  ONE_Q14,
  Q14,
  Q14_DRAW_SHIFT,
  TARGET_SHIFT,
} from './fixed-point';
import {
  DIVIDE_VARIANTS,
  divideVariant,
  DRAIN_SHIFT,
  INT_COLONIES,
  IntFrameUniforms,
} from './int-frame-uniforms';
import { IntEffectUniforms, intEffectOver } from './int-effects';
import { unitQ14 } from './int-math';
import { INT_EFFECTS, IntMatchUniforms } from './int-uniforms';

/**
 * A bit-exact TypeScript port of the integer passes in
 * `gl/int-simulation-shaders.ts` (ADR 0015, decision 3): the coarse counts,
 * the hunt, the claim and apply pair for moving, escaping a wall and
 * dividing, the crush, combat and feeding. Pure and Node-runnable; the
 * server's verification and the CI cross-check build on it.
 *
 * - uint products go through `Math.imul(...) >>> 0` and the draws of
 *   `draws.ts`, which are GLSL's wrapping uint arithmetic;
 * - signed values stay below 2^31 (see the shaders' bounds), so `*`, `+`
 *   and `>>` on them are exact in doubles and match GLSL's int.
 *
 * The weapons' circles come in as {@link IntEffectUniforms}; without them
 * no effect acts.
 */

/** The arena as the GPU holds it - row y = 0 first, like `texImage2D`. */
export interface IntGrid {
  width: number;
  height: number;
  /** RGBA16UI texels: owner (slot + 1), Q14 energy, food, record. */
  state: Uint16Array;
  /** R8UI: bit 0 the wall, the zone code above it. */
  mask: Uint8Array;
}

/** What one frame's claim and apply passes read besides the state. */
export interface IntPassUniforms extends IntFrameUniforms {
  /** Movement steps per colony this frame - `uSteps`. */
  steps: ArrayLike<number>;
  /** The frame seed - see `frameSeed`. */
  seed: number;
  /** Q14. */
  jitter: number;
  /** Q14 energy. */
  divideThreshold: number;
  /** Q14. */
  parentShare: number;
  /** Edge of a coarse cell. */
  cellSize: number;
  /** The weapons' effects this frame - none when left out. */
  effects?: IntEffectUniforms;
}

/** What a claim and apply pair does - `uKind` in the shaders. */
export const INT_KIND = { move: 0, escape: 1, divide: 2 } as const;
export type IntKind = (typeof INT_KIND)[keyof typeof INT_KIND];

/** The event record's layout - `RECORD_MASK` and the rest in the shaders. */
const RECORD_MASK = 7;
const LOSER_SHIFT = 3;
const POISONED = 1 << 6;
const ICE_STAY = INT_EFFECTS.iceStayChance;
const CRYO_STAY = INT_EFFECTS.cryoStayChance;
const PHAGE_CONVERT = INT_EFFECTS.phageConvertChance;
const CRYO_PULSE = WEAPON_CODE['cryo-pulse'];
const AGAR_BLOOM = WEAPON_CODE['agar-bloom'];
const PHAGE_STRIKE = WEAPON_CODE['phage-strike'];
const TOXIN_BOMB = WEAPON_CODE['toxin-bomb'];

/** No effects at all - what a plain match has. */
const NO_EFFECTS: IntEffectUniforms = {
  circles: new Int32Array(0),
  kinds: new Int32Array(0),
  count: 0,
};
const HEAT_AGGRESSION = INT_EFFECTS.heatAggression;
const HEAT_MAX_AGGRESSION = INT_EFFECTS.heatMaxAggression;

/** The eight neighbours, in the shaders' order. */
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];
/** The neighbours counterclockwise from +x - the octants of a direction. */
const OCTANT: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/** Bacteria per colony in each coarse cell, 4 per block - `INFLUENCE_FRAGMENT`. */
export function intInfluence(grid: IntGrid, cellSize: number): Uint32Array {
  const blocksX = Math.ceil(grid.width / cellSize);
  const blocksY = Math.ceil(grid.height / cellSize);
  const counts = new Uint32Array(blocksX * blocksY * 4);
  const { width, height, state } = grid;
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / cellSize) * blocksX;
    for (let x = 0; x < width; x++) {
      const owner = state[(y * width + x) * 4];
      if (owner !== 0) {
        counts[(row + Math.floor(x / cellSize)) * 4 + owner - 1]++;
      }
    }
  }
  return counts;
}

/**
 * The hunt of every colony, x and y per colony per block, Q14 - both hunt
 * textures of `INT_HUNT_FRAGMENT` in one array.
 */
export function intHunt(
  counts: Uint32Array,
  blocksX: number,
  blocksY: number
): Int32Array {
  const out = new Int32Array(blocksX * blocksY * INT_COLONIES * 2);
  const unit = new Int32Array(2);
  const tx = new Int32Array(INT_COLONIES);
  const ty = new Int32Array(INT_COLONIES);
  for (let cy = 0; cy < blocksY; cy++) {
    for (let cx = 0; cx < blocksX; cx++) {
      tx.fill(0);
      ty.fill(0);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ax = cx + dx;
          const ay = cy + dy;
          if (
            (dx === 0 && dy === 0) ||
            ax < 0 ||
            ay < 0 ||
            ax >= blocksX ||
            ay >= blocksY
          ) {
            continue;
          }
          const at = (ay * blocksX + ax) * 4;
          const total =
            counts[at] + counts[at + 1] + counts[at + 2] + counts[at + 3];
          for (let i = 0; i < INT_COLONIES; i++) {
            const enemies = total - counts[at + i];
            tx[i] += dx * enemies;
            ty[i] += dy * enemies;
          }
        }
      }
      const base = (cy * blocksX + cx) * INT_COLONIES * 2;
      for (let i = 0; i < INT_COLONIES; i++) {
        unitQ14(tx[i], ty[i], unit);
        out[base + i * 2] = unit[0];
        out[base + i * 2 + 1] = unit[1];
      }
    }
  }
  return out;
}

/** Buffers a claim and apply pair reuses from step to step. */
export class IntPassScratch {
  public readonly intents: Int8Array;
  public readonly claims: Uint8Array;
  public readonly priorities: Uint32Array;

  public constructor(width: number, height: number) {
    this.intents = new Int8Array(width * height);
    this.claims = new Uint8Array(width * height);
    this.priorities = new Uint32Array(width * height);
  }
}

/**
 * One claim and apply pair - a step of moving, escaping or dividing - into
 * `out`, a new state unless given; the grid's state is left alone, so `out`
 * must not be it. Pass `scratch` and two `out` buffers in turn to run
 * step after step without allocating. `hunt` is {@link intHunt}'s.
 */
export function intClaimAndApply(
  grid: IntGrid,
  u: IntPassUniforms,
  hunt: Int32Array,
  kind: IntKind,
  step: number,
  scratch: IntPassScratch = new IntPassScratch(grid.width, grid.height),
  out: Uint16Array = new Uint16Array(grid.state.length)
): Uint16Array {
  const { width, height, state, mask } = grid;
  const { intents, claims, priorities } = scratch;
  const seed = u.seed >>> 0;
  const blocksX = Math.ceil(width / u.cellSize);
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height;
  const wallAt = (x: number, y: number) =>
    !inside(x, y) || (mask[y * width + x] & WALL_BIT) !== 0;
  const freeAt = (x: number, y: number) =>
    !wallAt(x, y) && state[(y * width + x) * 4] === 0;
  const zoneAt = (x: number, y: number) =>
    inside(x, y) ? mask[y * width + x] >>> ZONE_SHIFT : 0;
  const draw = (x: number, y: number, salt: number) => drawAt(x, y, seed, salt);
  const effects = u.effects ?? NO_EFFECTS;
  const effectOver = (x: number, y: number, owner: number, weapon: number) =>
    effects.count > 0 && intEffectOver(effects, x, y, owner, weapon) !== 0;
  const unit = new Int32Array(2);

  const freeNeighbourFrom = (x: number, y: number, salt: number): number => {
    const start = draw(x, y, salt) >>> PICK_OF_8_SHIFT;
    for (let k = 0; k < 8; k++) {
      const i = (start + k) % 8;
      if (freeAt(x + NEIGHBOURS[i][0], y + NEIGHBOURS[i][1])) {
        return i;
      }
    }
    return -1;
  };
  const centred = (x: number, y: number, salt: number) =>
    (draw(x, y, stepSalt(salt, step)) >>> Q14_DRAW_SHIFT) - (ONE_Q14 >> 1);
  const neighbourIndex = (ox: number, oy: number) => {
    const index = (oy + 1) * 3 + ox + 1;
    return index > 4 ? index - 1 : index;
  };

  const moveIntent = (x: number, y: number, owner: number): number => {
    if (kind === INT_KIND.escape) {
      return wallAt(x, y)
        ? freeNeighbourFrom(x, y, stepSalt(SALT.escapeWall, step))
        : -1;
    }
    const colony = owner - 1;
    if (step >= u.steps[colony]) {
      return -1;
    }
    const zone = zoneAt(x, y);
    if (
      zone === ZONE_CODE.ice &&
      draw(x, y, stepSalt(SALT.iceStay, step)) < ICE_STAY
    ) {
      return -1;
    }
    if (
      effectOver(x, y, owner, CRYO_PULSE) &&
      draw(x, y, stepSalt(SALT.cryoStay, step)) < CRYO_STAY
    ) {
      return -1;
    }
    let aggression = u.aggression[colony];
    if (zone === ZONE_CODE.heat) {
      aggression = Math.max(
        aggression,
        Math.min(HEAT_MAX_AGGRESSION, aggression + HEAT_AGGRESSION)
      );
    }
    unitQ14(
      u.targets[colony * 2] - (x << TARGET_SHIFT),
      u.targets[colony * 2 + 1] - (y << TARGET_SHIFT),
      unit
    );
    let dx = unit[0];
    let dy = unit[1];
    const h =
      ((Math.floor(y / u.cellSize) * blocksX + Math.floor(x / u.cellSize)) *
        INT_COLONIES +
        colony) *
      2;
    let ex = hunt[h];
    let ey = hunt[h + 1];
    const back = ex * dx + ey * dy;
    if (back < 0) {
      const b = back >> Q14;
      ex -= (dx * b) >> Q14;
      ey -= (dy * b) >> Q14;
    }
    if (ex !== 0 || ey !== 0) {
      dx += ((ex - dx) * aggression) >> Q14;
      dy += ((ey - dy) * aggression) >> Q14;
    }
    dx += (centred(x, y, SALT.moveJitterX) * u.jitter) >> Q14;
    dy += (centred(x, y, SALT.moveJitterY) * u.jitter) >> Q14;
    if (dx === 0 && dy === 0) {
      return -1;
    }
    let k = 0;
    let a = 0;
    let b = 0;
    for (let i = 0; i < 8; i++) {
      const lo = OCTANT[i];
      const hi = OCTANT[(i + 1) % 8];
      const towardsLo = dx * hi[1] - dy * hi[0];
      const towardsHi = lo[0] * dy - lo[1] * dx;
      if (towardsHi >= 0 && towardsLo > 0) {
        k = i;
        a = towardsLo;
        b = towardsHi;
        break;
      }
    }
    // Below 2^32 as in the shader's uint, and exact in doubles.
    const roll = draw(x, y, stepSalt(SALT.moveOctant, step)) >>> Q14_DRAW_SHIFT;
    const high = roll * (a + b) < b * ONE_Q14;
    const offset = OCTANT[high ? (k + 1) % 8 : k];
    if (freeAt(x + offset[0], y + offset[1])) {
      return neighbourIndex(offset[0], offset[1]);
    }
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    const xFirst = draw(x, y, stepSalt(SALT.moveAxisFirst, step)) < 0x80000000;
    for (let pass = 0; pass < 2; pass++) {
      const alongX = xFirst === (pass === 0);
      const ox = alongX ? sx : 0;
      const oy = alongX ? 0 : sy;
      if ((ox !== 0 || oy !== 0) && freeAt(x + ox, y + oy)) {
        return neighbourIndex(ox, oy);
      }
    }
    const fallback =
      draw(x, y, stepSalt(SALT.moveFallback, step)) >>> PICK_OF_8_SHIFT;
    const n = NEIGHBOURS[fallback];
    return freeAt(x + n[0], y + n[1]) ? fallback : -1;
  };

  const divideIntent = (x: number, y: number, owner: number): number => {
    if (wallAt(x, y) || state[(y * width + x) * 4 + 1] < u.divideThreshold) {
      return -1;
    }
    const variant = divideVariant(
      zoneAt(x, y) === ZONE_CODE.agar,
      effectOver(x, y, owner, AGAR_BLOOM),
      effectOver(x, y, owner, CRYO_PULSE)
    );
    const threshold = u.divideChance[(owner - 1) * DIVIDE_VARIANTS + variant];
    if (draw(x, y, SALT.divideChance) >= threshold) {
      return -1;
    }
    return freeNeighbourFrom(x, y, SALT.divideSpot);
  };

  const intentOf = (x: number, y: number, owner: number): number => {
    // Every intent is a free neighbour or none, and the draws keep no
    // state, so a bacterium without a free neighbour can skip the work -
    // a shortcut the GPU does not take, to the same result.
    let anyFree = false;
    for (let i = 0; i < 8 && !anyFree; i++) {
      anyFree = freeAt(x + NEIGHBOURS[i][0], y + NEIGHBOURS[i][1]);
    }
    if (!anyFree) {
      return -1;
    }
    return kind === INT_KIND.divide
      ? divideIntent(x, y, owner)
      : moveIntent(x, y, owner);
  };

  // The intents once per bacterium (the GPU works them out per reader, to
  // the same result), scattered into the claims: a free cell takes the
  // claimant with the highest draw, on a tie the lowest neighbour index -
  // as the shader's gather loop over i = 0..7 with a strict > does.
  claims.fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = y * width + x;
      const owner = state[cell * 4];
      if (owner === 0) {
        intents[cell] = -1;
        continue;
      }
      const intent = intentOf(x, y, owner);
      intents[cell] = intent;
      if (intent < 0) {
        continue;
      }
      const n = NEIGHBOURS[intent];
      const target = cell + n[1] * width + n[0];
      const priority = draw(x, y, stepSalt(SALT.claimPriority, step));
      const held = claims[target];
      if (
        held === 0 ||
        priority > priorities[target] ||
        (priority === priorities[target] && intent < held - 1)
      ) {
        claims[target] = intent + 1;
        priorities[target] = priority;
      }
    }
  }

  const divide = kind === INT_KIND.divide;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = y * width + x;
      const to = cell * 4;
      const claim = claims[cell];
      if (claim !== 0) {
        const n = NEIGHBOURS[claim - 1];
        const from = ((y - n[1]) * width + (x - n[0])) * 4;
        out[to] = state[from];
        if (divide) {
          // A child starts with no food and no record, as the shader's
          // uvec4(mover.r, energy, 0u, 0u).
          const energy = state[from + 1];
          out[to + 1] = energy - mulQ14(energy, u.parentShare);
          out[to + 2] = 0;
          out[to + 3] = 0;
        } else {
          out[to + 1] = state[from + 1];
          out[to + 2] = state[from + 2];
          out[to + 3] = state[from + 3];
        }
        continue;
      }
      out[to] = state[to];
      out[to + 1] = state[to + 1];
      out[to + 2] = state[to + 2];
      out[to + 3] = state[to + 3];
      const intent = intents[cell];
      if (state[to] === 0 || intent < 0) {
        continue;
      }
      const n = NEIGHBOURS[intent];
      if (claims[(y + n[1]) * width + (x + n[0])] !== intent + 1) {
        continue;
      }
      if (divide) {
        out[to + 1] = mulQ14(state[to + 1], u.parentShare);
      } else {
        out.fill(0, to, to + 4);
      }
    }
  }
  return out;
}

/** FNV-1a over the texels' 16 bit values - to compare states quickly. */
export function intStateHash(state: ArrayLike<number>): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < state.length; i++) {
    hash = Math.imul(hash ^ (state[i] & 0xffff), 0x01000193) >>> 0;
  }
  return hash;
}

/** The event record's layout, as the shaders' `RECORD_MASK` and the rest. */
export const INT_RECORD = {
  mask: RECORD_MASK,
  loserShift: LOSER_SHIFT,
  poisoned: POISONED,
} as const;

/** Writes one texel - every channel, so a reused buffer keeps nothing stale. */
function texel(
  out: Uint16Array,
  at: number,
  owner: number,
  energy: number,
  food: number,
  record: number
): void {
  out[at] = owner;
  out[at + 1] = energy;
  out[at + 2] = food;
  out[at + 3] = record;
}

/**
 * Starts the frame's record and crushes the bacteria on a wall, lost to
 * nobody - `CRUSH_FRAGMENT`, into `out`.
 */
export function intCrush(
  grid: IntGrid,
  out: Uint16Array = new Uint16Array(grid.state.length)
): Uint16Array {
  const { width, height, state, mask } = grid;
  for (let cell = 0; cell < width * height; cell++) {
    const at = cell * 4;
    const owner = state[at];
    if (owner !== 0 && (mask[cell] & WALL_BIT) !== 0) {
      texel(out, at, 0, 0, 0, owner << LOSER_SHIFT);
    } else {
      texel(out, at, owner, state[at + 1], state[at + 2], 0);
    }
  }
  return out;
}

/** What the combat pass reads besides the state. */
export interface IntCombatUniforms {
  /** The frame seed - see `frameSeed`. */
  seed: number;
  match: IntMatchUniforms;
  /** The attacks, drains and pellets - see `fillIntCombatUniforms`. */
  frame: Pick<IntFrameUniforms, 'attack' | 'drain' | 'pellets' | 'pelletCount'>;
  /** Chebyshev reach of a pellet. */
  pelletRadius: number;
  /** The weapons' effects this frame - none when left out. */
  effects?: IntEffectUniforms;
}

/**
 * Nutrients, combat, regeneration and captures per bacterium -
 * `INT_COMBAT_FRAGMENT`, into `out`, which carries the frame's records.
 * Every bacterium reads the state as it was, as on the GPU.
 */
export function intCombat(
  grid: IntGrid,
  u: IntCombatUniforms,
  out: Uint16Array = new Uint16Array(grid.state.length)
): Uint16Array {
  const { width, height, state, mask } = grid;
  const { match, frame } = u;
  const seed = u.seed >>> 0;
  const effects = u.effects ?? NO_EFFECTS;
  const effectOver = (x: number, y: number, owner: number, weapon: number) =>
    effects.count > 0 ? intEffectOver(effects, x, y, owner, weapon) : 0;
  const strength = new Int32Array(INT_COLONIES);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = y * width + x;
      const at = cell * 4;
      const owner = state[at];
      if (owner === 0) {
        texel(out, at, 0, state[at + 1], state[at + 2], state[at + 3]);
        continue;
      }
      // An enemy's phages turn a share of the bacteria in their circle.
      const phage = effectOver(x, y, owner, PHAGE_STRIKE);
      if (
        phage !== 0 &&
        drawAt(x, y, seed, SALT.phageConvert) < PHAGE_CONVERT
      ) {
        texel(out, at, phage, state[at + 1], 0, phage | (owner << LOSER_SHIFT));
        continue;
      }
      let own = 0;
      let enemy = 0;
      strength.fill(0);
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          continue;
        }
        const n = (ny * width + nx) * 4;
        const other = state[n];
        if (other === 0) {
          continue;
        }
        if (other === owner) {
          own += state[n + 1];
        } else {
          const hit = mulShr(frame.attack[other - 1], state[n + 1], Q14);
          enemy += hit;
          strength[other - 1] += hit;
        }
      }

      let pellets = 0;
      for (let i = 0; i < frame.pelletCount; i++) {
        const p = i * 3;
        const reach = Math.max(
          Math.abs(x - frame.pellets[p]),
          Math.abs(y - frame.pellets[p + 1])
        );
        if (frame.pellets[p + 2] > 0 && reach <= u.pelletRadius) {
          pellets++;
        }
      }
      let energy = state[at + 1] + state[at + 2] + match.nutrientStep * pellets;
      const antibiotic = mask[cell] >>> ZONE_SHIFT === ZONE_CODE.antibiotic;
      if (antibiotic) {
        energy -= match.antibioticStep;
      }
      const toxic = effectOver(x, y, owner, TOXIN_BOMB) !== 0;
      if (toxic) {
        energy -= match.toxinStep;
      }
      const poisoned = antibiotic || toxic;
      const frozen = effectOver(x, y, owner, CRYO_PULSE) !== 0;
      const pressure =
        enemy > 0
          ? enemy +
            match.frontlinePressure -
            mulShr(own, match.defenceFactor, Q14)
          : 0;
      if (pressure > 0) {
        energy -= mulShr(pressure, frame.drain[owner - 1], DRAIN_SHIFT);
      } else if (energy < match.maxEnergy && !poisoned && !frozen) {
        energy = Math.min(match.maxEnergy, energy + match.regenStep);
      }
      if (energy > match.maxEnergy) {
        energy = Math.min(
          match.superMaxEnergy,
          Math.max(match.maxEnergy, energy - match.overchargeDecayStep)
        );
      }

      if (energy > 0) {
        texel(out, at, owner, energy, 0, 0);
        continue;
      }
      // The strongest attacker - on a tie the first.
      let winner = 0;
      let most = 0;
      for (let i = 0; i < INT_COLONIES; i++) {
        if (strength[i] > most) {
          winner = i + 1;
          most = strength[i];
        }
      }
      if (winner === 0 && poisoned) {
        texel(out, at, 0, 0, 0, (owner << LOSER_SHIFT) | POISONED);
      } else if (winner === 0 || winner === owner) {
        texel(out, at, owner, Math.min(match.maxEnergy, match.regenStep), 0, 0);
      } else if (drawAt(x, y, seed, SALT.consume) < match.consumeChance) {
        texel(out, at, 0, 0, 0, winner | (owner << LOSER_SHIFT));
      } else {
        texel(
          out,
          at,
          winner,
          match.captureEnergy,
          0,
          winner | (owner << LOSER_SHIFT)
        );
      }
    }
  }
  return out;
}

/**
 * The food a kill leaves, in the captured cell and in the killers around it
 * - `INT_FEED_FRAGMENT`, into `out`.
 */
export function intFeed(
  grid: IntGrid,
  feed: number,
  out: Uint16Array = new Uint16Array(grid.state.length)
): Uint16Array {
  const { width, height, state } = grid;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      const owner = state[at];
      let food = (state[at + 3] & RECORD_MASK) !== 0 ? feed : 0;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          continue;
        }
        const winner = state[(ny * width + nx) * 4 + 3] & RECORD_MASK;
        if (winner !== 0 && winner === owner) {
          food += feed;
        }
      }
      texel(
        out,
        at,
        owner,
        state[at + 1],
        Math.min(food, 0xffff),
        state[at + 3]
      );
    }
  }
  return out;
}
