/**
 * The GLSL of the GPU simulation: the rules of `BacteriaSimulation`, as
 * passes over the arena grid.
 *
 * The state is an RGBA16UI texture with one texel per cell:
 * - r: the owner - 0 for an empty cell, else the colony slot + 1
 * - g: the energy, in fixed point (see {@link ENERGY_SCALE})
 * - b: food left by a kill, eaten in the next frame's combat
 * - a: what happened to the cell this frame - the slot + 1 of the colony
 *   that captured it in bits 0-2, the slot + 1 of the colony that lost it
 *   in bits 3-5, and bit 6 set when an antibiotic killed it
 *
 * Walls live in a separate R8UI mask, so a wall is never in the state: bit
 * 0 is the wall, the bits above it the zone under the cell (`ZONE_CODE`).
 *
 * A GPU cannot move bacteria one after the other the way the CPU does - two
 * of them would land in the same cell. So movement and division are a claim
 * and an apply pass: every free cell picks one of the neighbours that want
 * to move into it, by a random priority, and the neighbour moves only if it
 * was picked. Both passes work out what a bacterium wants from the same
 * state with the same seeded random numbers, so they always agree.
 */

import { MIN_CELL_DENSITY } from '../arena/colony-renderer';
import { WEAPON_EFFECTS } from '../state/evolution';
import { WEAPON_CODE } from '../state/weapon-effects';
import { WALL_BIT, ZONE_CODE, ZONE_EFFECTS, ZONE_SHIFT } from '../state/zones';

export { WALL_BIT, ZONE_SHIFT };

/** A number as a GLSL float literal - "2.0", never the int "2". */
export function glslFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

/** Fixed point scale of the energy: 1.0 is stored as 16384. */
export const ENERGY_SCALE = 16384;

/**
 * The most colonies the GPU simulation runs - four, one per channel of the
 * coarse counts and of the report's rows.
 */
export const MAX_GPU_COLONIES = 4;

/**
 * An event record: the slot + 1 of the colony that captured a cell in the
 * low bits, of the one that lost it above, and a flag for a death by
 * antibiotic above those - all within the 8 bits the effects keep.
 */
const RECORD_BITS = Math.ceil(Math.log2(MAX_GPU_COLONIES + 1));
export const RECORD_MASK = (1 << RECORD_BITS) - 1;
export const LOSER_SHIFT = RECORD_BITS;
export const POISONED = 1 << (2 * RECORD_BITS);

/** The colonies one hunt texture holds: two, x and y each. */
export const HUNT_COLONIES = 2;

/** The rows of the report after the per block ones - see REPORT_FRAGMENT. */
export const REPORT_ROWS = {
  /** The pellets' eaters, and the deaths by antibiotic per column. */
  pellets: 0,
  captures: 1,
  losses: 2,
  hill: 3,
} as const;
export const REPORT_EXTRA_ROWS = Object.keys(REPORT_ROWS).length;

/** The most nutrient pellets the shaders take. */
export const MAX_PELLETS = 16;

/**
 * The most weapon effects the shaders take at once. Each seat has one
 * acting at a time at the most, a strike for a single step besides.
 */
export const MAX_EFFECTS = 4;

export const COMMON = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
precision highp isampler2D;
// The effects pack owners into 8 bit alpha - lowp could not read them back.
precision highp sampler2D;

uniform usampler2D uState;
uniform usampler2D uMask;
uniform ivec2 uSize;
uniform uint uSeed;

const float ENERGY_SCALE = ${ENERGY_SCALE}.0;
const uint WALL_BIT = ${WALL_BIT}u;
const uint ZONE_SHIFT = ${ZONE_SHIFT}u;
const uint RECORD_MASK = ${RECORD_MASK}u;
const uint LOSER_SHIFT = ${LOSER_SHIFT}u;
const uint POISONED = ${POISONED}u;
const uint ANTIBIOTIC = ${ZONE_CODE.antibiotic}u;
const uint AGAR = ${ZONE_CODE.agar}u;
const uint ICE = ${ZONE_CODE.ice}u;
const uint HEAT = ${ZONE_CODE.heat}u;
const uint HILL = ${ZONE_CODE.hill}u;
const ivec2 NEIGHBOURS[8] = ivec2[8](
  ivec2(-1, -1), ivec2(0, -1), ivec2(1, -1), ivec2(-1, 0),
  ivec2(1, 0), ivec2(-1, 1), ivec2(0, 1), ivec2(1, 1)
);

bool inside(ivec2 cell) {
  return all(greaterThanEqual(cell, ivec2(0))) && all(lessThan(cell, uSize));
}

uvec4 stateAt(ivec2 cell) {
  return inside(cell) ? texelFetch(uState, cell, 0) : uvec4(0u);
}

bool wallAt(ivec2 cell) {
  return !inside(cell) || (texelFetch(uMask, cell, 0).r & WALL_BIT) != 0u;
}

/** The zone under a cell - see \`ZONE_CODE\` - 0 for none. */
uint zoneAt(ivec2 cell) {
  return inside(cell) ? texelFetch(uMask, cell, 0).r >> ZONE_SHIFT : 0u;
}

bool freeAt(ivec2 cell) {
  return !wallAt(cell) && texelFetch(uState, cell, 0).r == 0u;
}

float energyOf(uvec4 state) {
  return float(state.g) / ENERGY_SCALE;
}

uint encodeEnergy(float energy) {
  return uint(clamp(round(energy * ENERGY_SCALE), 0.0, 65535.0));
}

/** The slot + 1 of the colony that captured a cell, 0 for none. */
uint capturer(uint record) {
  return record & RECORD_MASK;
}

/** The slot + 1 of the colony that lost a cell, 0 for none. */
uint loser(uint record) {
  return (record >> LOSER_SHIFT) & RECORD_MASK;
}

uint pcg(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}

/** A random number from 0 to 1 for a cell, the frame and a purpose. */
float random(ivec2 cell, uint salt) {
  return float(pcg(uvec3(uvec2(cell), uSeed ^ (salt * 2654435761u)))) / 4294967296.0;
}

/** Which of the eight neighbours an offset points at. */
int neighbourIndex(ivec2 offset) {
  int index = (offset.y + 1) * 3 + offset.x + 1;
  return index > 4 ? index - 1 : index;
}

/** The first free neighbour, starting the round at a random one. */
int randomFreeNeighbour(ivec2 cell, uint salt) {
  int start = int(pcg(uvec3(uvec2(cell), uSeed ^ (salt * 2654435761u))) % 8u);
  for (int k = 0; k < 8; k++) {
    int i = (start + k) % 8;
    if (freeAt(cell + NEIGHBOURS[i])) {
      return i;
    }
  }
  return -1;
}
`;

/** The pellets, and the one rule for who is within reach of one. */
const PELLETS = `
uniform vec3 uPellets[${MAX_PELLETS}];
uniform int uPelletCount;
uniform int uPelletRadius;

/** How many pellets that are not eaten up a cell can reach. */
int pelletsInReach(ivec2 cell) {
  int count = 0;
  for (int i = 0; i < uPelletCount; i++) {
    vec3 pellet = uPellets[i];
    ivec2 distance = abs(cell - ivec2(pellet.xy));
    if (pellet.z > 0.0 && max(distance.x, distance.y) <= uPelletRadius) {
      count++;
    }
  }
  return count;
}`;

/**
 * The weapons' effects acting this step, as circles with an owner - see
 * `WeaponEffects`. The biofilm shield needs no circle: it changes its
 * colony's toughness, which combat takes per colony.
 */
export const WEAPONS = `
uniform vec4 uEffects[${MAX_EFFECTS}];      // centre x, y, radius squared, 1 when hostile
uniform ivec2 uEffectKinds[${MAX_EFFECTS}]; // the weapon's code and the owner's slot + 1
uniform int uEffectCount;
const int TOXIN_BOMB = ${WEAPON_CODE['toxin-bomb']};
const int CRYO_PULSE = ${WEAPON_CODE['cryo-pulse']};
const int PHAGE_STRIKE = ${WEAPON_CODE['phage-strike']};
const int AGAR_BLOOM = ${WEAPON_CODE['agar-bloom']};

/**
 * The slot + 1 of the colony whose effect of that kind acts on a cell of
 * the colony \`owner\` (slot + 1), 0 for none: a hostile one an enemy's -
 * every other colony counts as one - any other its own.
 */
uint effectOver(ivec2 cell, uint owner, int kind) {
  for (int i = 0; i < ${MAX_EFFECTS}; i++) {
    if (i >= uEffectCount) {
      break;
    }
    ivec2 info = uEffectKinds[i];
    bool hostile = uEffects[i].w > 0.5;
    if (info.x != kind || (uint(info.y) != owner) != hostile) {
      continue;
    }
    vec2 offset = vec2(cell) - uEffects[i].xy;
    if (dot(offset, offset) <= uEffects[i].z) {
      return uint(info.y);
    }
  }
  return 0u;
}`;

/**
 * Bacteria per colony in each coarse cell - the density field the hunting
 * reads, and the base of the report.
 */
export const INFLUENCE_FRAGMENT = `${COMMON}
uniform int uCellSize;
out uvec4 outValue;
void main() {
  ivec2 block = ivec2(gl_FragCoord.xy) * uCellSize;
  uvec4 counts = uvec4(0u);
  for (int y = 0; y < uCellSize; y++) {
    for (int x = 0; x < uCellSize; x++) {
      uint owner = stateAt(block + ivec2(x, y)).r;
      if (owner != 0u) {
        counts[int(owner) - 1]++;
      }
    }
  }
  outValue = counts;
}`;

/**
 * For each coarse cell and colony, the direction towards the closest
 * enemies around it - scaled to 16 bit signed integers. One pass covers
 * two colonies, `uPair` which two: the first pair's, then - with more than
 * two colonies - the second's.
 */
export const HUNT_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uInfluence;
uniform int uPair;
out ivec4 outValue;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(uInfluence, 0);
  vec2 towards[2] = vec2[2](vec2(0.0), vec2(0.0));
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ivec2 at = cell + ivec2(dx, dy);
      if ((dx == 0 && dy == 0) || any(lessThan(at, ivec2(0))) || any(greaterThanEqual(at, size))) {
        continue;
      }
      uvec4 counts = texelFetch(uInfluence, at, 0);
      uint total = counts.x + counts.y + counts.z + counts.w;
      // The enemies of a colony are every other colony's bacteria.
      for (int i = 0; i < ${HUNT_COLONIES}; i++) {
        towards[i] += vec2(dx, dy) * float(total - counts[uPair * ${HUNT_COLONIES} + i]);
      }
    }
  }
  vec2 a = length(towards[0]) > 0.0 ? normalize(towards[0]) : vec2(0.0);
  vec2 b = length(towards[1]) > 0.0 ? normalize(towards[1]) : vec2(0.0);
  outValue = ivec4(round(vec4(a, b) * 32767.0));
}`;

/**
 * What a bacterium wants to do: move one cell (movement and escaping a
 * wall), or put a child into a free cell (division). Shared by the claim
 * and the apply pass, so both always agree.
 */
const INTENTS = `${WEAPONS}
uniform int uKind;        // 0 move, 1 escape a wall, 2 divide
uniform int uStep;        // which movement step of the frame
uniform int uSteps[${MAX_GPU_COLONIES}];    // movement steps per colony this frame
uniform vec2 uTarget[${MAX_GPU_COLONIES}];  // each colony's crosshair
uniform float uAggression[${MAX_GPU_COLONIES}];
uniform float uJitter;
uniform int uCellSize;
uniform isampler2D uHunt;
uniform isampler2D uHuntMore; // the hunt of the third and fourth colony
uniform float uDivideThreshold;
uniform float uDivideChance[${MAX_GPU_COLONIES}]; // per bacterium, on plain ground
uniform float uDivideBudget[${MAX_GPU_COLONIES}]; // the most it may be anywhere - see divideBudget
uniform float uParentShare;

const float PI = 3.14159265;
const ivec2 OCTANT[8] = ivec2[8](
  ivec2(1, 0), ivec2(1, 1), ivec2(0, 1), ivec2(-1, 1),
  ivec2(-1, 0), ivec2(-1, -1), ivec2(0, -1), ivec2(1, -1)
);

uint stepSalt(uint salt) {
  return salt + uint(uStep) * 97u;
}

/** Which neighbour a bacterium moves into this step, -1 to stay. */
int moveIntent(ivec2 cell) {
  uvec4 state = stateAt(cell);
  if (state.r == 0u) {
    return -1;
  }
  if (uKind == 1) {
    return wallAt(cell) ? randomFreeNeighbour(cell, stepSalt(11u)) : -1;
  }
  int colony = int(state.r) - 1;
  if (uStep >= uSteps[colony]) {
    return -1;
  }
  uint zone = zoneAt(cell);
  if (zone == ICE && random(cell, stepSalt(6u)) < ${glslFloat(ZONE_EFFECTS.iceStayChance)}) {
    return -1;
  }
  // Frozen by an enemy's cryo pulse, it all but sits the step out.
  if (uEffectCount > 0
    && effectOver(cell, state.r, CRYO_PULSE) != 0u
    && random(cell, stepSalt(7u)) < ${glslFloat(WEAPON_EFFECTS.cryoStayChance)}) {
    return -1;
  }
  float aggression = zone == HEAT
    ? max(uAggression[colony], min(${glslFloat(ZONE_EFFECTS.heatMaxAggression)}, uAggression[colony] + ${glslFloat(ZONE_EFFECTS.heatAggression)}))
    : uAggression[colony];
  vec2 towards = uTarget[colony] - vec2(cell);
  vec2 direction = length(towards) > 0.0 ? normalize(towards) : vec2(0.0);
  ivec4 hunt = colony < ${HUNT_COLONIES}
    ? texelFetch(uHunt, cell / uCellSize, 0)
    : texelFetch(uHuntMore, cell / uCellSize, 0);
  vec2 enemies = vec2(colony % ${HUNT_COLONIES} == 0 ? hunt.xy : hunt.zw) / 32767.0;
  // Never back against the crosshair - see the CPU's move.
  enemies -= min(0.0, dot(enemies, direction)) * direction;
  if (enemies != vec2(0.0)) {
    direction = mix(direction, enemies, aggression);
  }
  direction += (vec2(random(cell, stepSalt(1u)), random(cell, stepSalt(2u))) - 0.5) * uJitter;
  if (length(direction) < 1e-4) {
    return -1;
  }

  // One of the eight neighbours, picked so the moves average out to the
  // exact direction.
  float sector = atan(direction.y, direction.x) / (PI / 4.0);
  float lower = floor(sector);
  int octant = int(lower) + (random(cell, stepSalt(3u)) < sector - lower ? 1 : 0);
  ivec2 offset = OCTANT[((octant % 8) + 8) % 8];
  if (freeAt(cell + offset)) {
    return neighbourIndex(offset);
  }

  // Blocked head on - slide along the wall instead of piling up in front of it.
  ivec2 alongX = ivec2(int(sign(direction.x)), 0);
  ivec2 alongY = ivec2(0, int(sign(direction.y)));
  bool xFirst = random(cell, stepSalt(4u)) < 0.5;
  ivec2 first = xFirst ? alongX : alongY;
  ivec2 second = xFirst ? alongY : alongX;
  if (first != ivec2(0) && freeAt(cell + first)) {
    return neighbourIndex(first);
  }
  if (second != ivec2(0) && freeAt(cell + second)) {
    return neighbourIndex(second);
  }
  int fallback = int(random(cell, stepSalt(5u)) * 8.0) % 8;
  return freeAt(cell + NEIGHBOURS[fallback]) ? fallback : -1;
}

/** Into which neighbour a well fed bacterium puts a child, -1 for none. */
int divideIntent(ivec2 cell) {
  uvec4 state = stateAt(cell);
  if (state.r == 0u || wallAt(cell)) {
    return -1;
  }
  int colony = int(state.r) - 1;
  if (energyOf(state) < uDivideThreshold) {
    return -1;
  }
  float effects = 1.0;
  if (uEffectCount > 0) {
    if (effectOver(cell, state.r, AGAR_BLOOM) != 0u) {
      effects *= ${glslFloat(WEAPON_EFFECTS.agarBloomDivideFactor)};
    }
    if (effectOver(cell, state.r, CRYO_PULSE) != 0u) {
      effects *= ${glslFloat(WEAPON_EFFECTS.cryoDivideFactor)};
    }
  }
  float chance = min(
    uDivideBudget[colony],
    uDivideChance[colony]
      * (zoneAt(cell) == AGAR ? ${glslFloat(ZONE_EFFECTS.agarDivideFactor)} : 1.0)
      * effects
  );
  if (random(cell, 21u) >= chance) {
    return -1;
  }
  return randomFreeNeighbour(cell, 22u);
}

int intentOf(ivec2 cell) {
  return uKind == 2 ? divideIntent(cell) : moveIntent(cell);
}
`;

/**
 * Every free cell picks one of the neighbours that want to move - or put a
 * child - into it, the one with the highest random priority. Stores which
 * neighbour it picked, 1 to 8, or 0.
 */
export const CLAIM_FRAGMENT = `${COMMON}${INTENTS}
out uvec4 outClaim;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  if (!freeAt(cell)) {
    outClaim = uvec4(0u);
    return;
  }
  int best = -1;
  float bestPriority = -1.0;
  for (int i = 0; i < 8; i++) {
    ivec2 from = cell - NEIGHBOURS[i];
    if (intentOf(from) == i) {
      float priority = random(from, stepSalt(31u));
      if (priority > bestPriority) {
        best = i;
        bestPriority = priority;
      }
    }
  }
  outClaim = uvec4(uint(best + 1), 0u, 0u, 0u);
}`;

/**
 * Carries the claims out. A claimed cell takes the bacterium that moves in
 * - or a child of its parent, with the child's share of the energy. A
 * bacterium whose claim was picked leaves its cell - or keeps the parent's
 * share. Everyone else stays as they are.
 */
export const APPLY_FRAGMENT = `${COMMON}${INTENTS}
uniform usampler2D uClaims;
out uvec4 outState;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  uvec4 state = texelFetch(uState, cell, 0);
  uint claim = texelFetch(uClaims, cell, 0).r;
  if (claim != 0u) {
    ivec2 from = cell - NEIGHBOURS[int(claim) - 1];
    uvec4 mover = texelFetch(uState, from, 0);
    outState = uKind == 2
      ? uvec4(mover.r, encodeEnergy(energyOf(mover) * (1.0 - uParentShare)), 0u, 0u)
      : mover;
    return;
  }
  if (state.r != 0u) {
    int intent = intentOf(cell);
    if (intent >= 0 && texelFetch(uClaims, cell + NEIGHBOURS[intent], 0).r == uint(intent + 1)) {
      if (uKind == 2) {
        state.g = encodeEnergy(energyOf(state) * uParentShare);
      } else {
        state = uvec4(0u);
      }
    }
  }
  outState = state;
}`;

/**
 * Starts the frame's record of what happened, and crushes the bacteria a
 * closing gate or a sliding wall had no room left for: they are lost
 * without anybody capturing them.
 */
export const CRUSH_FRAGMENT = `${COMMON}
out uvec4 outState;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  uvec4 state = texelFetch(uState, cell, 0);
  if (state.r != 0u && wallAt(cell)) {
    outState = uvec4(0u, 0u, 0u, state.r << LOSER_SHIFT);
    return;
  }
  outState = uvec4(state.rgb, 0u);
}`;

/**
 * Nutrients, combat, regeneration and captures, per bacterium - phase 2 and
 * 3 of the CPU simulation. Reads the state as it was at the start of the
 * pass, so the outcome never depends on an order.
 */
export const COMBAT_FRAGMENT = `${COMMON}${WEAPONS}
uniform float uDt;
uniform float uAttack[${MAX_GPU_COLONIES}];
uniform float uToughness[${MAX_GPU_COLONIES}]; // times the pressure on a colony
${PELLETS}
uniform float uNutrientGain;
uniform float uDefenceFactor;
uniform float uFrontlinePressure;
uniform float uCombatDrain;
uniform float uRegen;
uniform float uOverchargeDecay;
uniform float uMaxEnergy;
uniform float uSuperMaxEnergy;
uniform float uConsumeChance;
uniform float uCaptureEnergy;
out uvec4 outState;

void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  uvec4 state = texelFetch(uState, cell, 0);
  if (state.r == 0u) {
    outState = state;
    return;
  }
  uint owner = state.r;
  // An enemy's phages turn a share of the bacteria in their circle, at once.
  uint phage = uEffectCount > 0 ? effectOver(cell, owner, PHAGE_STRIKE) : 0u;
  if (phage != 0u && random(cell, 43u) < ${glslFloat(WEAPON_EFFECTS.phageConvertShare)}) {
    outState = uvec4(phage, state.g, 0u, phage | (owner << LOSER_SHIFT));
    return;
  }
  float own = 0.0;
  float enemy = 0.0;
  vec4 strength = vec4(0.0);
  for (int i = 0; i < 8; i++) {
    uvec4 neighbour = stateAt(cell + NEIGHBOURS[i]);
    if (neighbour.r == 0u) {
      continue;
    }
    float energy = energyOf(neighbour);
    if (neighbour.r == owner) {
      own += energy;
    } else {
      int slot = int(neighbour.r) - 1;
      float hit = energy * uAttack[slot];
      enemy += hit;
      strength[slot] += hit;
    }
  }

  float energy = energyOf(state) + float(state.b) / ENERGY_SCALE
    + uNutrientGain * float(pelletsInReach(cell));

  bool antibiotic = zoneAt(cell) == ANTIBIOTIC;
  if (antibiotic) {
    energy -= ${glslFloat(ZONE_EFFECTS.antibioticDrainPerSec)} * uDt;
  }
  // An enemy's toxin cloud drains like antibiotic ground, only harder.
  bool toxic = uEffectCount > 0 && effectOver(cell, owner, TOXIN_BOMB) != 0u;
  if (toxic) {
    energy -= ${glslFloat(WEAPON_EFFECTS.toxinDrainPerSec)} * uDt;
  }
  bool poisoned = antibiotic || toxic;
  // Frozen by an enemy's cryo pulse, it does not recover either.
  bool frozen = uEffectCount > 0 && effectOver(cell, owner, CRYO_PULSE) != 0u;
  float pressure = enemy > 0.0 ? enemy + uFrontlinePressure - own * uDefenceFactor : 0.0;
  if (pressure > 0.0) {
    energy -= pressure * uToughness[int(owner) - 1] * uCombatDrain * uDt;
  } else if (energy < uMaxEnergy && !poisoned && !frozen) {
    energy = min(uMaxEnergy, energy + uRegen * uDt);
  }
  if (energy > uMaxEnergy) {
    energy = min(uSuperMaxEnergy, max(uMaxEnergy, energy - uOverchargeDecay * uDt));
  }

  if (energy > 0.0) {
    outState = uvec4(owner, encodeEnergy(energy), 0u, 0u);
    return;
  }
  // The strongest attacker - on a tie the first, as the CPU one does.
  uint winner = 0u;
  float most = 0.0;
  for (int i = 0; i < ${MAX_GPU_COLONIES}; i++) {
    if (strength[i] > most) {
      winner = uint(i + 1);
      most = strength[i];
    }
  }
  if (winner == 0u && poisoned) {
    // The antibiotic or the toxin killed it: lost, and nobody captured it.
    outState = uvec4(0u, 0u, 0u, (owner << LOSER_SHIFT) | POISONED);
    return;
  }
  if (winner == 0u || winner == owner) {
    // Nothing around that could take over - stay alive on fumes.
    outState = uvec4(owner, encodeEnergy(min(uMaxEnergy, uRegen * uDt)), 0u, 0u);
    return;
  }
  uint record = winner | (owner << LOSER_SHIFT);
  if (random(cell, 41u) < uConsumeChance) {
    // Digested completely: the cell frees up.
    outState = uvec4(0u, 0u, 0u, record);
  } else {
    outState = uvec4(winner, encodeEnergy(uCaptureEnergy), 0u, record);
  }
}`;

/**
 * A kill leaves food behind: in the captured cell, and in every neighbour
 * that belongs to the colony that made the kill. It fuels a breakthrough.
 */
export const FEED_FRAGMENT = `${COMMON}
uniform float uFeed;
out uvec4 outState;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  uvec4 state = texelFetch(uState, cell, 0);
  float feed = capturer(state.a) != 0u ? uFeed : 0.0;
  for (int i = 0; i < 8; i++) {
    uint winner = capturer(stateAt(cell + NEIGHBOURS[i]).a);
    if (winner != 0u && winner == state.r) {
      feed += uFeed;
    }
  }
  outState = uvec4(state.rg, encodeEnergy(feed), state.a);
}`;

/**
 * The numbers the CPU needs, in one small texture it reads back - a
 * channel per colony:
 * - one row per coarse row: the bacteria of each colony
 * - one row per coarse row: their summed energy
 * - then the REPORT_ROWS, one texel per coarse column: the pellets'
 *   eaters (one texel per pellet: each colony's in 16 bits apiece - the
 *   first two in blue, the others in alpha) beside the deaths by
 *   antibiotic, the
 *   captures and the losses of each colony - running totals since the
 *   match started, added up on the GPU, so a read the CPU misses loses
 *   nothing - and each colony's bacteria on the hold zone
 */
export const REPORT_FRAGMENT = `${COMMON}
uniform usampler2D uEvents;
uniform usampler2D uPrevious;
uniform int uCellSize;
uniform ivec2 uBlocks;
uniform bool uCountHill;
${PELLETS}
out uvec4 outValue;

/**
 * Who a cell counts for in a row of the report: the slot + 1, or 0 for
 * nobody - a death by antibiotic counts in the second channel.
 */
uint countedFor(ivec2 cell, int row) {
  uint record = texelFetch(uEvents, cell, 0).a;
  if (row == ${REPORT_ROWS.pellets}) {
    return (record & POISONED) != 0u ? 2u : 0u;
  }
  if (row == ${REPORT_ROWS.captures}) {
    return capturer(record);
  }
  if (row == ${REPORT_ROWS.losses}) {
    return loser(record);
  }
  return zoneAt(cell) == HILL ? texelFetch(uState, cell, 0).r : 0u;
}

/** One column of the arena counted for a row, onto the sums so far. */
uvec4 column(int columnX, int row, uvec4 sums) {
  for (int y = 0; y < uSize.y; y++) {
    for (int x = 0; x < uCellSize; x++) {
      ivec2 cell = ivec2(columnX * uCellSize + x, y);
      if (!inside(cell)) {
        continue;
      }
      uint slot = countedFor(cell, row);
      if (slot != 0u) {
        sums[int(slot) - 1]++;
      }
    }
  }
  return sums;
}

void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  int blocksY = uBlocks.y;
  if (at.y < 2 * blocksY) {
    // Per coarse cell: the bacteria of each colony, then their energy.
    if (at.x >= uBlocks.x) {
      outValue = uvec4(0u);
      return;
    }
    bool energy = at.y >= blocksY;
    ivec2 block = ivec2(at.x, energy ? at.y - blocksY : at.y) * uCellSize;
    uvec4 sums = uvec4(0u);
    for (int y = 0; y < uCellSize; y++) {
      for (int x = 0; x < uCellSize; x++) {
        uvec4 state = stateAt(block + ivec2(x, y));
        if (state.r != 0u) {
          sums[int(state.r) - 1] += energy ? state.g : 1u;
        }
      }
    }
    outValue = sums;
    return;
  }
  int row = at.y - 2 * blocksY;
  // The hold zone is counted afresh each step - and only where there is one;
  // the other rows run on from the last report.
  bool fresh = row == ${REPORT_ROWS.hill};
  uvec4 sums = fresh ? uvec4(0u) : texelFetch(uPrevious, at, 0);
  if (at.x < uBlocks.x && (!fresh || uCountHill)) {
    sums = column(at.x, row, sums);
  }
  if (row == ${REPORT_ROWS.pellets}) {
    // The pellets' eaters ride along in the row of the deaths by antibiotic.
    uvec4 byColony = uvec4(0u);
    if (at.x < uPelletCount) {
      ivec2 pellet = ivec2(uPellets[at.x].xy);
      for (int dy = -uPelletRadius; dy <= uPelletRadius; dy++) {
        for (int dx = -uPelletRadius; dx <= uPelletRadius; dx++) {
          uint owner = stateAt(pellet + ivec2(dx, dy)).r;
          byColony += uvec4(equal(uvec4(owner), uvec4(1u, 2u, 3u, 4u)));
        }
      }
    }
    sums.z = byColony.x | (byColony.y << 16u);
    sums.w = byColony.z | (byColony.w << 16u);
  }
  outValue = sums;
}`;

/**
 * One colony of the GPU state as the painter's cells: density in red - 0
 * for an empty cell, from 0.55 up by strength - and overcharge in green.
 */
export const CELLS_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uState;
uniform uint uOwner;
uniform float uMaxEnergy;
uniform float uSuperMaxEnergy;
out vec4 outCells;
void main() {
  uvec4 state = texelFetch(uState, ivec2(gl_FragCoord.xy), 0);
  if (state.r != uOwner) {
    outCells = vec4(0.0);
    return;
  }
  float energy = float(state.g) / ${ENERGY_SCALE}.0;
  float strength = min(1.0, max(energy, 0.0) / uMaxEnergy);
  float range = uSuperMaxEnergy - uMaxEnergy;
  float heat = energy > uMaxEnergy && range > 0.0
    ? min(1.0, (energy - uMaxEnergy) / range)
    : 0.0;
  outCells = vec4(mix(${MIN_CELL_DENSITY}, 1.0, strength), heat, 0.0, 1.0);
}`;

/**
 * What the painter makes glow, per cell: in red a fight - a capture or a
 * loss - in green a bacterium eating from a pellet, in blue the front of a
 * colony pushing into a cell it did not hold. Each fades by `uFade` per
 * frame, so a flash lingers for a moment.
 *
 * Alpha packs the owner of the cell this frame in the low bits, as a
 * record's capturer, so the next frame sees who moved in, and the colony
 * that left the glow above them, as a record's loser, for its colour.
 */
export const EFFECTS_FRAGMENT = `${COMMON}
uniform usampler2D uEvents;
uniform sampler2D uPreviousEffects;
uniform vec3 uFade;
uniform bool uTrack;
${PELLETS}
out vec4 outEffects;

void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  vec4 previous = texelFetch(uPreviousEffects, cell, 0);
  uint packed = uint(round(previous.a * 255.0));
  uint lastOwner = capturer(packed);
  uint glowOwner = loser(packed);
  uint owner = texelFetch(uState, cell, 0).r;

  vec3 heat = previous.rgb * uFade;
  // A fight or a crush flashes - a quiet death by antibiotic does not.
  uint record = texelFetch(uEvents, cell, 0).a;
  if (record != 0u && (record & POISONED) == 0u) {
    heat.r = 1.0;
  }
  if (owner != 0u) {
    if (pelletsInReach(cell) > 0) {
      heat.g = 1.0;
    }
    if (uTrack && owner != lastOwner) {
      heat.b = 1.0;
      glowOwner = owner;
    }
  }
  outEffects = vec4(heat, float(owner | (glowOwner << LOSER_SHIFT)) / 255.0);
}`;
