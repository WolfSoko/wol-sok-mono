/**
 * The GLSL of the GPU simulation: the rules of `BacteriaSimulation`, as
 * passes over the arena grid.
 *
 * The state is an RGBA16UI texture with one texel per cell:
 * - r: the owner - 0 for an empty cell, else the colony slot + 1
 * - g: the energy, in fixed point (see {@link ENERGY_SCALE})
 * - b: food left by a kill, eaten in the next frame's combat
 * - a: what happened to the cell this frame - the slot + 1 of the colony
 *   that captured it in bits 0-1, the slot + 1 of the colony that lost it
 *   in bits 2-3, and bit 4 set when an antibiotic killed it
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
import { ZONE_CODE, ZONE_EFFECTS } from '../state/zones';

/** The bit of the mask that marks a wall - the zone sits above it. */
export const WALL_BIT = 1;
/** How far the zone code is shifted up in the mask, past the wall bit. */
export const ZONE_SHIFT = 1;

/** A number as a GLSL float literal - "2.0", never the int "2". */
function glslFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

/** Fixed point scale of the energy: 1.0 is stored as 16384. */
export const ENERGY_SCALE = 16384;

/** The most colonies the GPU simulation runs - the game has two. */
export const MAX_GPU_COLONIES = 2;

/** The most nutrient pellets the shaders take. */
export const MAX_PELLETS = 16;

const COMMON = `#version 300 es
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
/** The bit of an event record that marks a death by antibiotic. */
const uint POISONED = 16u;
const uint ANTIBIOTIC = ${ZONE_CODE.antibiotic}u;
const uint AGAR = ${ZONE_CODE.agar}u;
const uint ICE = ${ZONE_CODE.ice}u;
const uint HEAT = ${ZONE_CODE.heat}u;
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
 * Bacteria per colony in each coarse cell - the density field the hunting
 * reads, and the base of the report.
 */
export const INFLUENCE_FRAGMENT = `${COMMON}
uniform int uCellSize;
out uvec4 outValue;
void main() {
  ivec2 block = ivec2(gl_FragCoord.xy) * uCellSize;
  uvec2 counts = uvec2(0u);
  for (int y = 0; y < uCellSize; y++) {
    for (int x = 0; x < uCellSize; x++) {
      uint owner = stateAt(block + ivec2(x, y)).r;
      counts += uvec2(owner == 1u ? 1u : 0u, owner == 2u ? 1u : 0u);
    }
  }
  outValue = uvec4(counts, 0u, 0u);
}`;

/**
 * For each coarse cell and colony, the direction towards the closest
 * enemies around it - scaled to 16 bit signed integers.
 */
export const HUNT_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uInfluence;
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
      // The enemies of each colony are the other one's bacteria.
      towards[0] += vec2(dx, dy) * float(counts.y);
      towards[1] += vec2(dx, dy) * float(counts.x);
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
const INTENTS = `
uniform int uKind;        // 0 move, 1 escape a wall, 2 divide
uniform int uStep;        // which movement step of the frame
uniform int uSteps[2];    // movement steps per colony this frame
uniform vec2 uTarget[2];  // each colony's crosshair
uniform float uAggression[2];
uniform float uJitter;
uniform int uCellSize;
uniform isampler2D uHunt;
uniform float uDivideThreshold;
uniform float uDivideChance[2]; // per bacterium, already within the budget
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
  float aggression = zone == HEAT
    ? max(uAggression[colony], min(${glslFloat(ZONE_EFFECTS.heatMaxAggression)}, uAggression[colony] + ${glslFloat(ZONE_EFFECTS.heatAggression)}))
    : uAggression[colony];
  vec2 towards = uTarget[colony] - vec2(cell);
  vec2 direction = length(towards) > 0.0 ? normalize(towards) : vec2(0.0);
  ivec4 hunt = texelFetch(uHunt, cell / uCellSize, 0);
  vec2 enemies = vec2(colony == 0 ? hunt.xy : hunt.zw) / 32767.0;
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
  float chance = uDivideChance[colony]
    * (zoneAt(cell) == AGAR ? ${glslFloat(ZONE_EFFECTS.agarDivideFactor)} : 1.0);
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
    outState = uvec4(0u, 0u, 0u, state.r << 2u);
    return;
  }
  outState = uvec4(state.rgb, 0u);
}`;

/**
 * Nutrients, combat, regeneration and captures, per bacterium - phase 2 and
 * 3 of the CPU simulation. Reads the state as it was at the start of the
 * pass, so the outcome never depends on an order.
 */
export const COMBAT_FRAGMENT = `${COMMON}
uniform float uDt;
uniform float uAttack[2];
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
  float own = 0.0;
  float enemy = 0.0;
  vec2 strength = vec2(0.0);
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

  bool poisoned = zoneAt(cell) == ANTIBIOTIC;
  if (poisoned) {
    energy -= ${glslFloat(ZONE_EFFECTS.antibioticDrainPerSec)} * uDt;
  }
  float pressure = enemy > 0.0 ? enemy + uFrontlinePressure - own * uDefenceFactor : 0.0;
  if (pressure > 0.0) {
    energy -= pressure * uCombatDrain * uDt;
  } else if (energy < uMaxEnergy && !poisoned) {
    energy = min(uMaxEnergy, energy + uRegen * uDt);
  }
  if (energy > uMaxEnergy) {
    energy = min(uSuperMaxEnergy, max(uMaxEnergy, energy - uOverchargeDecay * uDt));
  }

  if (energy > 0.0) {
    outState = uvec4(owner, encodeEnergy(energy), 0u, 0u);
    return;
  }
  uint winner = strength.x == 0.0 && strength.y == 0.0
    ? 0u
    : (strength.x >= strength.y ? 1u : 2u);
  if (winner == 0u && poisoned) {
    // The antibiotic killed it: lost, and nobody captured it.
    outState = uvec4(0u, 0u, 0u, (owner << 2u) | POISONED);
    return;
  }
  if (winner == 0u || winner == owner) {
    // Nothing around that could take over - stay alive on fumes.
    outState = uvec4(owner, encodeEnergy(min(uMaxEnergy, uRegen * uDt)), 0u, 0u);
    return;
  }
  uint record = winner | (owner << 2u);
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
  float feed = (state.a & 3u) != 0u ? uFeed : 0.0;
  for (int i = 0; i < 8; i++) {
    uint winner = stateAt(cell + NEIGHBOURS[i]).a & 3u;
    if (winner != 0u && winner == state.r) {
      feed += uFeed;
    }
  }
  outState = uvec4(state.rg, encodeEnergy(feed), state.a);
}`;

/**
 * The numbers the CPU needs, in one small texture it reads back:
 * - one row per coarse row: bacteria and summed energy per colony
 * - one row for the pellets: bacteria within reach of each
 * - one row of running totals per coarse column: captures and losses per
 *   colony since the match started - added up on the GPU, so a read the
 *   CPU misses loses nothing
 */
export const REPORT_FRAGMENT = `${COMMON}
uniform usampler2D uEvents;
uniform usampler2D uPrevious;
uniform int uCellSize;
uniform ivec2 uBlocks;
${PELLETS}
out uvec4 outValue;

void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  if (at.y < uBlocks.y) {
    if (at.x >= uBlocks.x) {
      outValue = uvec4(0u);
      return;
    }
    ivec2 block = at * uCellSize;
    uvec4 sums = uvec4(0u);
    for (int y = 0; y < uCellSize; y++) {
      for (int x = 0; x < uCellSize; x++) {
        uvec4 state = stateAt(block + ivec2(x, y));
        if (state.r == 1u) {
          sums.x += 1u;
          sums.z += state.g;
        } else if (state.r == 2u) {
          sums.y += 1u;
          sums.w += state.g;
        }
      }
    }
    outValue = sums;
    return;
  }
  if (at.y == uBlocks.y) {
    uint eaters = 0u;
    if (at.x < uPelletCount) {
      ivec2 pellet = ivec2(uPellets[at.x].xy);
      for (int dy = -uPelletRadius; dy <= uPelletRadius; dy++) {
        for (int dx = -uPelletRadius; dx <= uPelletRadius; dx++) {
          eaters += stateAt(pellet + ivec2(dx, dy)).r != 0u ? 1u : 0u;
        }
      }
    }
    outValue = uvec4(eaters, 0u, 0u, 0u);
    return;
  }
  uvec4 totals = texelFetch(uPrevious, at, 0);
  if (at.x < uBlocks.x) {
    for (int y = 0; y < uSize.y; y++) {
      for (int x = 0; x < uCellSize; x++) {
        ivec2 cell = ivec2(at.x * uCellSize + x, y);
        if (!inside(cell)) {
          continue;
        }
        uint record = texelFetch(uEvents, cell, 0).a;
        uint winner = record & 3u;
        uint victim = (record >> 2u) & 3u;
        totals.x += winner == 1u ? 1u : 0u;
        totals.y += winner == 2u ? 1u : 0u;
        totals.z += victim == 1u ? 1u : 0u;
        totals.w += victim == 2u ? 1u : 0u;
      }
    }
  }
  outValue = totals;
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
 * Alpha packs the owner of the cell this frame in bits 0-1, so the next
 * frame sees who moved in, and the colony that left the glow in bits 2-3,
 * for its colour.
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
  uint lastOwner = packed & 3u;
  uint glowOwner = (packed >> 2u) & 3u;
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
  outEffects = vec4(heat, float(owner | (glowOwner << 2u)) / 255.0);
}`;
