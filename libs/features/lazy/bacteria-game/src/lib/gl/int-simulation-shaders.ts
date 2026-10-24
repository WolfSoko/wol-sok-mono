/**
 * The integer passes of the deterministic GPU simulation (ADR 0015, step
 * 2): the hunt and the claim and apply pair - moving, escaping a wall and
 * dividing - with no float on the state's path, so every GPU and the
 * TypeScript reference (`state/gpu-int/int-reference.ts`) compute the same
 * bits. They take the place of `HUNT_FRAGMENT`, `CLAIM_FRAGMENT` and
 * `APPLY_FRAGMENT` when `GpuSimulation` runs deterministic; every other pass
 * stays the float one for now (combat is step 3).
 *
 * Bounds, so no int product wraps (GLSL ES 3.00 has no 64 bit multiply):
 * - hunt and crosshair directions are Q14 unit vectors, each axis at most
 *   2^14;
 * - aggression, jitter and the parent's share are Q14 shares, at most 2^14;
 * - energy is the state's 16 bit green channel, below 2^16.
 * The products below note what they come to.
 *
 * The weapons' circles (`effectOver`, float `uEffects`) are still the float
 * test of the shared header: they only say whether an effect covers a cell,
 * and step 4 of the rollout turns them into integers as well.
 */

import { WEAPON_EFFECTS } from '../state/evolution';
import { SALT } from '../state/gpu-int/draws';
import {
  chanceThreshold,
  TARGET_SHIFT,
  toQ14,
} from '../state/gpu-int/fixed-point';
import {
  DIVIDE_VARIANTS,
  INT_COLONIES,
} from '../state/gpu-int/int-frame-uniforms';
import { ZONE_EFFECTS } from '../state/zones';
import { INT_COMMON } from './int-common';
import { COMMON, HUNT_COLONIES, WEAPONS } from './simulation-shaders';

/**
 * The direction towards the enemies around a coarse cell, per colony, as a
 * Q14 unit vector - two colonies per pass, as `HUNT_FRAGMENT`.
 */
export const INT_HUNT_FRAGMENT = `${COMMON}${INT_COMMON}
uniform usampler2D uInfluence;
uniform int uPair;
out ivec4 outValue;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(uInfluence, 0);
  ivec2 towards[2] = ivec2[2](ivec2(0), ivec2(0));
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ivec2 at = cell + ivec2(dx, dy);
      if ((dx == 0 && dy == 0) || any(lessThan(at, ivec2(0))) || any(greaterThanEqual(at, size))) {
        continue;
      }
      uvec4 counts = texelFetch(uInfluence, at, 0);
      // A block holds at most cellSize^2 bacteria: the sums stay tiny.
      uint total = counts.x + counts.y + counts.z + counts.w;
      for (int i = 0; i < ${HUNT_COLONIES}; i++) {
        towards[i] += ivec2(dx, dy) * int(total - counts[uPair * ${HUNT_COLONIES} + i]);
      }
    }
  }
  outValue = ivec4(unitQ14(towards[0]), unitQ14(towards[1]));
}`;

/**
 * What a bacterium wants to do, in integers - shared by the claim and the
 * apply pass, so both always agree.
 */
const INT_INTENTS = `${INT_COMMON}${WEAPONS}
uniform int uKind;        // 0 move, 1 escape a wall, 2 divide
uniform int uStep;        // which movement step of the frame
uniform int uSteps[${INT_COLONIES}];
uniform ivec2 uTarget[${INT_COLONIES}];  // sixteenths of a cell
uniform int uAggression[${INT_COLONIES}]; // Q14
uniform int uJitter;                      // Q14
uniform int uCellSize;
uniform isampler2D uHunt;
uniform isampler2D uHuntMore;
uniform uint uDivideThreshold;            // Q14 energy
uniform uint uDivideChance[${INT_COLONIES * DIVIDE_VARIANTS}]; // see DIVIDE_VARIANTS
uniform int uParentShare;                 // Q14

const uint ICE_STAY = ${chanceThreshold(ZONE_EFFECTS.iceStayChance)}u;
const uint CRYO_STAY = ${chanceThreshold(WEAPON_EFFECTS.cryoStayChance)}u;
const int HEAT_AGGRESSION = ${toQ14(ZONE_EFFECTS.heatAggression)};
const int HEAT_MAX_AGGRESSION = ${toQ14(ZONE_EFFECTS.heatMaxAggression)};
const ivec2 OCTANT[8] = ivec2[8](
  ivec2(1, 0), ivec2(1, 1), ivec2(0, 1), ivec2(-1, 1),
  ivec2(-1, 0), ivec2(-1, -1), ivec2(0, -1), ivec2(1, -1)
);

/** The first free neighbour, starting the round at a drawn one. */
int freeNeighbourFrom(ivec2 cell, uint salt) {
  int start = int(drawAt(cell, salt) >> 29u);
  for (int k = 0; k < 8; k++) {
    int i = (start + k) % 8;
    if (freeAt(cell + NEIGHBOURS[i])) {
      return i;
    }
  }
  return -1;
}

/** A centred jitter draw, -2^13 .. 2^13 - 1. */
int centred(ivec2 cell, uint salt) {
  return int(drawAt(cell, salt) >> ${32 - 14}u) - ${1 << 13};
}

int moveIntent(ivec2 cell) {
  uvec4 state = stateAt(cell);
  if (state.r == 0u) {
    return -1;
  }
  if (uKind == 1) {
    return wallAt(cell) ? freeNeighbourFrom(cell, intStepSalt(${SALT.escapeWall}u, uStep)) : -1;
  }
  int colony = int(state.r) - 1;
  if (uStep >= uSteps[colony]) {
    return -1;
  }
  uint zone = zoneAt(cell);
  if (zone == ICE && chanceAt(cell, intStepSalt(${SALT.iceStay}u, uStep), ICE_STAY)) {
    return -1;
  }
  if (uEffectCount > 0
    && effectOver(cell, state.r, CRYO_PULSE) != 0u
    && chanceAt(cell, intStepSalt(${SALT.cryoStay}u, uStep), CRYO_STAY)) {
    return -1;
  }
  int aggression = uAggression[colony];
  if (zone == HEAT) {
    aggression = max(aggression, min(HEAT_MAX_AGGRESSION, aggression + HEAT_AGGRESSION));
  }
  ivec2 dir = unitQ14(uTarget[colony] - (cell << ${TARGET_SHIFT}));
  ivec4 hunt = colony < ${HUNT_COLONIES}
    ? texelFetch(uHunt, cell / uCellSize, 0)
    : texelFetch(uHuntMore, cell / uCellSize, 0);
  ivec2 enemies = colony % ${HUNT_COLONIES} == 0 ? hunt.xy : hunt.zw;
  // Never back against the crosshair. |back| <= 2^29, back >> 14 <= 2^15,
  // dir * that <= 2^29.
  int back = enemies.x * dir.x + enemies.y * dir.y;
  if (back < 0) {
    enemies -= (dir * (back >> Q14)) >> Q14;
  }
  if (enemies != ivec2(0)) {
    // mix(dir, enemies, aggression): |enemies - dir| <= 2^16, times 2^14.
    dir += ((enemies - dir) * aggression) >> Q14;
  }
  // 2^13 * 2^14 = 2^27.
  dir += (ivec2(centred(cell, intStepSalt(${SALT.moveJitterX}u, uStep)),
    centred(cell, intStepSalt(${SALT.moveJitterY}u, uStep))) * uJitter) >> Q14;
  if (dir == ivec2(0)) {
    return -1;
  }

  // The two neighbours around the direction, by cross products, and the
  // weights that make the expected step parallel to it: dir = a lo + b hi.
  // Adjacent octant vectors have a cross product of 1, so no division.
  int k = 0;
  int a = 0;
  int b = 0;
  for (int i = 0; i < 8; i++) {
    ivec2 lo = OCTANT[i];
    ivec2 hi = OCTANT[(i + 1) % 8];
    int towardsLo = dir.x * hi.y - dir.y * hi.x;
    int towardsHi = lo.x * dir.y - lo.y * dir.x;
    if (towardsHi >= 0 && towardsLo > 0) {
      k = i;
      a = towardsLo;
      b = towardsHi;
      break;
    }
  }
  // P(hi) = b / (a + b). |dir| < 2^17 per axis (the hunt < 2^16 after the
  // back projection, plus 2^13 of jitter), so a + b < 2^17 and the uint
  // product with a 14 bit roll stays below 2^32.
  uint roll = drawAt(cell, intStepSalt(${SALT.moveOctant}u, uStep)) >> 18u;
  bool high = roll * uint(a + b) < uint(b) << 14u;
  ivec2 offset = OCTANT[high ? (k + 1) % 8 : k];
  if (freeAt(cell + offset)) {
    return neighbourIndex(offset);
  }

  // Blocked head on - slide along the wall instead of piling up in front of it.
  ivec2 alongX = ivec2(sign(dir.x), 0);
  ivec2 alongY = ivec2(0, sign(dir.y));
  bool xFirst = drawAt(cell, intStepSalt(${SALT.moveAxisFirst}u, uStep)) < 0x80000000u;
  ivec2 first = xFirst ? alongX : alongY;
  ivec2 second = xFirst ? alongY : alongX;
  if (first != ivec2(0) && freeAt(cell + first)) {
    return neighbourIndex(first);
  }
  if (second != ivec2(0) && freeAt(cell + second)) {
    return neighbourIndex(second);
  }
  int fallback = int(drawAt(cell, intStepSalt(${SALT.moveFallback}u, uStep)) >> 29u);
  return freeAt(cell + NEIGHBOURS[fallback]) ? fallback : -1;
}

/** Into which neighbour a well fed bacterium puts a child, -1 for none. */
int divideIntent(ivec2 cell) {
  uvec4 state = stateAt(cell);
  if (state.r == 0u || wallAt(cell) || state.g < uDivideThreshold) {
    return -1;
  }
  int variant = zoneAt(cell) == AGAR ? 1 : 0;
  if (uEffectCount > 0) {
    variant |= effectOver(cell, state.r, AGAR_BLOOM) != 0u ? 2 : 0;
    variant |= effectOver(cell, state.r, CRYO_PULSE) != 0u ? 4 : 0;
  }
  uint threshold = uDivideChance[(int(state.r) - 1) * ${DIVIDE_VARIANTS} + variant];
  if (!chanceAt(cell, ${SALT.divideChance}u, threshold)) {
    return -1;
  }
  return freeNeighbourFrom(cell, ${SALT.divideSpot}u);
}

int intentOf(ivec2 cell) {
  return uKind == 2 ? divideIntent(cell) : moveIntent(cell);
}

/** The energy a parent keeps: its share, rounded down - the child takes the rest. */
uint parentEnergy(uint energy) {
  // energy < 2^16, the share <= 2^14: below 2^30.
  return uint(mulQ14(int(energy), uParentShare));
}
`;

/**
 * Every free cell picks one of the neighbours that want to move - or put a
 * child - into it, the one with the highest draw; ties go to the first.
 * Stores which neighbour it picked, 1 to 8, or 0.
 */
export const INT_CLAIM_FRAGMENT = `${COMMON}${INT_INTENTS}
out uvec4 outClaim;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  if (!freeAt(cell)) {
    outClaim = uvec4(0u);
    return;
  }
  int best = -1;
  uint bestPriority = 0u;
  for (int i = 0; i < 8; i++) {
    ivec2 from = cell - NEIGHBOURS[i];
    if (intentOf(from) == i) {
      uint priority = drawAt(from, intStepSalt(${SALT.claimPriority}u, uStep));
      if (best < 0 || priority > bestPriority) {
        best = i;
        bestPriority = priority;
      }
    }
  }
  outClaim = uvec4(uint(best + 1), 0u, 0u, 0u);
}`;

/**
 * Carries the claims out. A claimed cell takes the bacterium that moves in,
 * or a child with what its parent does not keep; a bacterium whose claim
 * was picked leaves its cell, or keeps its share. A division conserves the
 * energy exactly.
 */
export const INT_APPLY_FRAGMENT = `${COMMON}${INT_INTENTS}
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
      ? uvec4(mover.r, mover.g - parentEnergy(mover.g), 0u, 0u)
      : mover;
    return;
  }
  if (state.r != 0u) {
    int intent = intentOf(cell);
    if (intent >= 0 && texelFetch(uClaims, cell + NEIGHBOURS[intent], 0).r == uint(intent + 1)) {
      if (uKind == 2) {
        state.g = parentEnergy(state.g);
      } else {
        state = uvec4(0u);
      }
    }
  }
  outState = state;
}`;
