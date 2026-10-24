/**
 * The integer passes of the deterministic GPU simulation (ADR 0015, steps
 * 2 and 3): the hunt, the claim and apply pair - moving, escaping a wall
 * and dividing - and combat and feeding, with no float on the state's path,
 * so every GPU and the TypeScript reference
 * (`state/gpu-int/int-reference.ts`) compute the same bits. They take the
 * place of the float passes of the same names when `GpuSimulation` runs
 * deterministic; the coarse counts, the crush and the report are integer
 * already.
 *
 * Bounds, so no int product wraps (GLSL ES 3.00 has no 64 bit multiply):
 * - hunt and crosshair directions are Q14 unit vectors, each axis at most
 *   2^14;
 * - aggression, jitter, the parent's share and the defence factor are Q14
 *   shares, at most 2^14;
 * - energy is the state's 16 bit green channel; the combat never writes
 *   more than `INT_ENERGY_MAX` (2^15), and nothing else does either;
 * - attacks and drains are capped on the CPU (`INT_ATTACK_MAX`,
 *   `INT_DRAIN_MAX`).
 * The products below note what they come to.
 *
 * The weapons' circles are integers too (`INT_WEAPONS`, step 4): centres
 * and radii in sixteenths of a cell, see `state/gpu-int/int-effects.ts`.
 */

import { PICK_OF_8_SHIFT, SALT } from '../state/gpu-int/draws';
import {
  ONE_Q14,
  Q14_DRAW_SHIFT,
  TARGET_SHIFT,
} from '../state/gpu-int/fixed-point';
import {
  DIVIDE_VARIANTS,
  DRAIN_SHIFT,
  INT_COLONIES,
  INT_PELLETS,
} from '../state/gpu-int/int-frame-uniforms';
import { INT_MAX_EFFECTS } from '../state/gpu-int/int-effects';
import { INT_EFFECTS } from '../state/gpu-int/int-uniforms';
import { INT_COMMON } from './int-common';
import { COMMON, HUNT_COLONIES, WEAPON_CODES } from './simulation-shaders';

/**
 * The weapons' effects acting this step, as integer circles with an owner -
 * `WEAPONS` of the float passes, tested in sixteenths of a cell. The square
 * around a circle is checked first, so each square summed is below 2^30.
 */
const INT_WEAPONS = `${WEAPON_CODES}
uniform ivec4 uEffects[${INT_MAX_EFFECTS}];     // centre x, y, radius in sixteenths, 1 when hostile
uniform ivec2 uEffectKinds[${INT_MAX_EFFECTS}]; // the weapon's code and the owner's slot + 1
uniform int uEffectCount;

/**
 * The slot + 1 of the colony whose effect of that kind acts on a cell of
 * the colony \`owner\` (slot + 1), 0 for none: a hostile one an enemy's,
 * any other its own - as \`intEffectOver\`.
 */
uint effectOver(ivec2 cell, uint owner, int kind) {
  ivec2 at = cell << ${TARGET_SHIFT};
  for (int i = 0; i < ${INT_MAX_EFFECTS}; i++) {
    if (i >= uEffectCount) {
      break;
    }
    ivec2 info = uEffectKinds[i];
    ivec4 circle = uEffects[i];
    bool hostile = circle.w != 0;
    if (info.x != kind || (uint(info.y) != owner) != hostile || circle.z == 0) {
      continue;
    }
    // Both below 2^16 - and below 2^15 past the square's test.
    ivec2 d = abs(at - circle.xy);
    if (d.x > circle.z || d.y > circle.z) {
      continue;
    }
    if (d.x * d.x + d.y * d.y <= circle.z * circle.z) {
      return uint(info.y);
    }
  }
  return 0u;
}`;

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
const INT_INTENTS = `${INT_COMMON}${INT_WEAPONS}
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

const uint ICE_STAY = ${INT_EFFECTS.iceStayChance}u;
const uint CRYO_STAY = ${INT_EFFECTS.cryoStayChance}u;
const int HEAT_AGGRESSION = ${INT_EFFECTS.heatAggression};
const int HEAT_MAX_AGGRESSION = ${INT_EFFECTS.heatMaxAggression};
const ivec2 OCTANT[8] = ivec2[8](
  ivec2(1, 0), ivec2(1, 1), ivec2(0, 1), ivec2(-1, 1),
  ivec2(-1, 0), ivec2(-1, -1), ivec2(0, -1), ivec2(1, -1)
);

/** The first free neighbour, starting the round at a drawn one. */
int freeNeighbourFrom(ivec2 cell, uint salt) {
  int start = int(drawAt(cell, salt) >> ${PICK_OF_8_SHIFT}u);
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
  return int(drawAt(cell, salt) >> ${Q14_DRAW_SHIFT}u) - ${ONE_Q14 >> 1};
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
  uint roll = drawAt(cell, intStepSalt(${SALT.moveOctant}u, uStep)) >> ${Q14_DRAW_SHIFT}u;
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
  int fallback = int(drawAt(cell, intStepSalt(${SALT.moveFallback}u, uStep)) >> ${PICK_OF_8_SHIFT}u);
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

/**
 * Nutrients, combat, regeneration and captures, per bacterium, in Q14 -
 * `COMBAT_FRAGMENT` in integers. Every rate is what it comes to in one step
 * (`intMatchUniforms`), so the display's frame length plays no part.
 */
export const INT_COMBAT_FRAGMENT = `${COMMON}${INT_COMMON}${INT_WEAPONS}
uniform int uAttack[${INT_COLONIES}];  // Q14
uniform int uDrain[${INT_COLONIES}];   // ${DRAIN_SHIFT} fractional bits, per step and point of pressure
uniform ivec3 uPellets[${INT_PELLETS}]; // the cell, 1 while not eaten up
uniform int uPelletCount;
uniform int uPelletRadius;
uniform int uNutrientStep;
uniform int uDefenceFactor;            // Q14
uniform int uFrontlinePressure;
uniform int uRegenStep;
uniform int uOverchargeDecayStep;
uniform int uAntibioticStep;
uniform int uToxinStep;
uniform int uMaxEnergy;
uniform int uSuperMaxEnergy;
uniform int uCaptureEnergy;
uniform uint uConsumeChance;
const uint PHAGE_CONVERT = ${INT_EFFECTS.phageConvertChance}u;
out uvec4 outState;

int pelletsInReach(ivec2 cell) {
  int count = 0;
  for (int i = 0; i < ${INT_PELLETS}; i++) {
    if (i >= uPelletCount) {
      break;
    }
    ivec3 pellet = uPellets[i];
    ivec2 distance = abs(cell - pellet.xy);
    if (pellet.z > 0 && max(distance.x, distance.y) <= uPelletRadius) {
      count++;
    }
  }
  return count;
}

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
  if (phage != 0u && chanceAt(cell, ${SALT.phageConvert}u, PHAGE_CONVERT)) {
    outState = uvec4(phage, state.g, 0u, phage | (owner << LOSER_SHIFT));
    return;
  }
  // Energies are at most 2^15: own below 2^18; a hit (attack below 2^18)
  // below 2^19, enemy and each strength below 2^22.
  int own = 0;
  int enemy = 0;
  ivec4 strength = ivec4(0);
  for (int i = 0; i < 8; i++) {
    uvec4 neighbour = stateAt(cell + NEIGHBOURS[i]);
    if (neighbour.r == 0u) {
      continue;
    }
    if (neighbour.r == owner) {
      own += int(neighbour.g);
    } else {
      int slot = int(neighbour.r) - 1;
      int hit = mulShr(uAttack[slot], int(neighbour.g), Q14);
      enemy += hit;
      strength[slot] += hit;
    }
  }

  // Below 2^15 + 2^16 of food + 16 pellets' worth: well below 2^20.
  int energy = int(state.g) + int(state.b) + uNutrientStep * pelletsInReach(cell);

  bool antibiotic = zoneAt(cell) == ANTIBIOTIC;
  if (antibiotic) {
    energy -= uAntibioticStep;
  }
  // An enemy's toxin cloud drains like antibiotic ground, only harder.
  bool toxic = uEffectCount > 0 && effectOver(cell, owner, TOXIN_BOMB) != 0u;
  if (toxic) {
    energy -= uToxinStep;
  }
  bool poisoned = antibiotic || toxic;
  // Frozen by an enemy's cryo pulse, it does not recover either.
  bool frozen = uEffectCount > 0 && effectOver(cell, owner, CRYO_PULSE) != 0u;
  int pressure = enemy > 0
    ? enemy + uFrontlinePressure - mulShr(own, uDefenceFactor, Q14)
    : 0;
  if (pressure > 0) {
    // pressure below 2^23, the drain at most 2^15.
    energy -= mulShr(pressure, uDrain[int(owner) - 1], ${DRAIN_SHIFT});
  } else if (energy < uMaxEnergy && !poisoned && !frozen) {
    energy = min(uMaxEnergy, energy + uRegenStep);
  }
  if (energy > uMaxEnergy) {
    energy = min(uSuperMaxEnergy, max(uMaxEnergy, energy - uOverchargeDecayStep));
  }

  if (energy > 0) {
    outState = uvec4(owner, uint(energy), 0u, 0u);
    return;
  }
  // The strongest attacker - on a tie the first, as the CPU one does.
  uint winner = 0u;
  int most = 0;
  for (int i = 0; i < ${INT_COLONIES}; i++) {
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
    outState = uvec4(owner, uint(min(uMaxEnergy, uRegenStep)), 0u, 0u);
    return;
  }
  uint record = winner | (owner << LOSER_SHIFT);
  if (chanceAt(cell, ${SALT.consume}u, uConsumeChance)) {
    // Digested completely: the cell frees up.
    outState = uvec4(0u, 0u, 0u, record);
  } else {
    outState = uvec4(winner, uint(uCaptureEnergy), 0u, record);
  }
}`;

/**
 * A kill leaves food behind, in the captured cell and in every neighbour of
 * the killers - `FEED_FRAGMENT` in integers. Nine feeds at the most, kept
 * in the 16 bit food channel.
 */
export const INT_FEED_FRAGMENT = `${COMMON}
uniform uint uFeed; // Q14
out uvec4 outState;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  uvec4 state = texelFetch(uState, cell, 0);
  uint feed = capturer(state.a) != 0u ? uFeed : 0u;
  for (int i = 0; i < 8; i++) {
    uint winner = capturer(stateAt(cell + NEIGHBOURS[i]).a);
    if (winner != 0u && winner == state.r) {
      feed += uFeed;
    }
  }
  outState = uvec4(state.rg, min(feed, 65535u), state.a);
}`;
