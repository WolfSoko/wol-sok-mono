import { BOT_DIFFICULTIES, BotDifficulty, BotProfile } from './bot-controller';
import { clamp, lerp } from './geometry';
import { heatOf, parseGeneratedId } from './level-generator/generate-level';
import { getLevel, LEVELS } from './levels';

/**
 * The campaign's difficulty curve (ADR 0016): how often a player of the
 * level's stage should beat the computer on each level of the ladder, and
 * how well the computer plays there to get close to it.
 *
 * Nothing here adapts to the player: the curve is fixed per level and
 * difficulty, so medallion times stay comparable between players, and
 * evolving keeps paying off - the computer follows the ladder, not the
 * player's DNA. The balance lab (`tools/bacteria-game/balance/`) measures
 * the curve with its stand-in for a human and calibrates {@link SKILL}.
 */

/**
 * The version of the ladder's computer: its skill table, its bands and its
 * rules of play. A replay against it keeps the version (`MatchPlan.ladder`)
 * and plays again only under the same one - a change to any of them that
 * changes a match against it raises it, as `BALANCE_VERSION` for a plain
 * match (`golden-match.spec.ts` holds a fingerprint of one).
 */
export const LADDER_VERSION = 2;

/**
 * The stand-in's target win rate against the normal computer, by ladder
 * level: about 85 % on the first level down to about 45 % on the finale,
 * falling within each chapter, with a breather after a boss and at the
 * start of a chapter.
 */
export const TARGET_CURVE: Readonly<Record<string, number>> = {
  // Petri
  'petri-dish': 0.85,
  corridors: 0.82,
  hourglass: 0.79,
  // Laboratory
  'inner-ring': 0.78,
  'pillar-field': 0.76,
  'twin-chambers': 0.74,
  serpentine: 0.72,
  pistons: 0.7,
  // Body
  alveoli: 0.69,
  mycelium: 0.67,
  heartbeat: 0.65,
  villi: 0.63,
  // Reactor, with its boss
  'half-life': 0.62,
  containment: 0.6,
  'control-room': 0.58,
  meltdown: 0.55,
  // Outbreak: a breather after the meltdown, though it opens on a boss
  'patient-zero': 0.58,
  quarantine: 0.56,
  'feeding-ground': 0.54,
  // Expanse, down to the leviathan
  expanse: 0.56,
  archipelago: 0.53,
  bloodstream: 0.5,
  'root-network': 0.48,
  leviathan: 0.45,
};

/** Points the target moves from normal's for the other difficulties. */
const TARGET_OFFSET: Readonly<Record<BotDifficulty, number>> = {
  easy: 0.1,
  normal: 0,
  hard: -0.15,
};

/** The stand-in's target win rate on a ladder level and difficulty. */
export function targetWinRate(
  levelId: string,
  difficulty: BotDifficulty
): number {
  const normal = TARGET_CURVE[levelId] ?? TARGET_CURVE['petri-dish'];
  return clamp(normal + TARGET_OFFSET[difficulty], 0, 0.98);
}

/**
 * The profile values that are interpolated between a difficulty's weakest
 * and strongest computer.
 */
type SkillValues = Omit<
  BotProfile,
  'usesBoost' | 'chargesNearest' | 'attacksAtCap' | 'pushesAfterCryo'
>;

/**
 * The computers the bands run between, from the weakest easy one to the
 * strongest hard one.
 */
const ANCHORS: readonly SkillValues[] = [
  {
    reactionSec: 1.5,
    attackRatio: 1.7,
    aimNoise: 30,
    boostRange: 0,
    weaponPatience: 1.8,
  },
  {
    reactionSec: 0.85,
    attackRatio: 1.3,
    aimNoise: 16,
    boostRange: 40,
    weaponPatience: 1.4,
  },
  {
    reactionSec: 0.4,
    attackRatio: 1,
    aimNoise: 5,
    boostRange: 80,
    weaponPatience: 1.05,
  },
  {
    reactionSec: 0.2,
    attackRatio: 0.8,
    aimNoise: 1.5,
    boostRange: 110,
    weaponPatience: 0.9,
  },
];

/**
 * Each difficulty's band, from its weakest computer (the first level) to
 * its strongest. The bands follow on from each other - each one starts
 * where the one below ends - so the difficulty picker matters on every
 * level: the easy computer stays easier than the normal one, which stays
 * easier than the hard one.
 */
const SKILL_BANDS: Readonly<
  Record<BotDifficulty, { weak: SkillValues; strong: SkillValues }>
> = {
  easy: { weak: ANCHORS[0], strong: ANCHORS[1] },
  normal: { weak: ANCHORS[1], strong: ANCHORS[2] },
  hard: { weak: ANCHORS[2], strong: ANCHORS[3] },
};

/** Below this range a computer does not boost at all, as the easy one. */
const MIN_BOOST_RANGE = 15;

/**
 * Where each difficulty's computer plays in its band on each ladder level,
 * from 0 (its weakest) to 1 (its strongest): easy, normal, hard. Calibrated
 * with the balance lab against {@link TARGET_CURVE}.
 */
export const SKILL: Readonly<
  Record<string, readonly [easy: number, normal: number, hard: number]>
> = {
  'petri-dish': [0, 0, 0],
  corridors: [0, 0, 0],
  hourglass: [0.05, 0.15, 0],
  'inner-ring': [0, 0, 0],
  'pillar-field': [0.15, 0.25, 0.25],
  'twin-chambers': [0, 0, 0.1],
  serpentine: [0.3, 0.3, 0.2],
  pistons: [0.3, 0.9, 1],
  alveoli: [0.4, 0.7, 1],
  mycelium: [0.85, 1, 1],
  heartbeat: [0.55, 0.9, 1],
  villi: [1, 1, 0.9],
  'half-life': [1, 0.4, 0],
  containment: [0.5, 0.35, 0],
  'control-room': [0.6, 0, 0],
  meltdown: [0.6, 0, 0.2],
  'patient-zero': [0.5, 0, 0],
  quarantine: [1, 0.9, 0.15],
  'feeding-ground': [0.45, 0.8, 0.9],
  expanse: [1, 0.6, 0.1],
  archipelago: [1, 0.75, 1],
  bloodstream: [1, 1, 0.3],
  'root-network': [1, 0.35, 0.3],
  leviathan: [0.35, 0.45, 0.6],
};

/**
 * Times the computer's DNA budget on a level (`computerLoadout`), where
 * its skill alone cannot reach the target - 1 for every level not listed.
 * Calibrated with the balance lab, as {@link SKILL} is.
 */
export const STRENGTH: Readonly<Partial<Record<string, number>>> = {
  'inner-ring': 0.6,
  'twin-chambers': 0.85,
  pistons: 1.3,
  alveoli: 1.2,
  mycelium: 1.3,
  heartbeat: 1.2,
  villi: 1.4,
  'half-life': 0.65,
  containment: 0.55,
  'control-room': 0.3,
  meltdown: 0.35,
  'patient-zero': 0.3,
  quarantine: 1.1,
  expanse: 0.8,
  'root-network': 0.7,
  leviathan: 0.5,
};

/** Times the computer's DNA budget on a level - see {@link STRENGTH}. */
export function strengthOf(levelId: string): number {
  return STRENGTH[levelId] ?? 1;
}

/**
 * Where a level sits on the ladder, from 0 (the first level) to 1 (the
 * finale): a hand-made level by its place, a generated one by its heat.
 * Null for an id of neither kind.
 */
export function ladderPosition(levelId: string): number | null {
  const index = LEVELS.findIndex(({ id }) => id === levelId);
  if (index >= 0) {
    return index / (LEVELS.length - 1);
  }
  const recipe = parseGeneratedId(levelId);
  return recipe === null ? null : heatOf(recipe);
}

/**
 * Where the computer plays in its band on a level: the table's value on
 * the ladder, on a generated level the table's value at the place its heat
 * puts it on the ladder.
 */
export function skillOf(levelId: string, difficulty: BotDifficulty): number {
  const column = BOT_DIFFICULTIES.findIndex(({ id }) => id === difficulty);
  const own = SKILL[levelId];
  if (own !== undefined) {
    return own[column];
  }
  const position = ladderPosition(levelId) ?? 0;
  const at = position * (LEVELS.length - 1);
  const below = Math.floor(at);
  const above = Math.min(LEVELS.length - 1, below + 1);
  const skill = (index: number) => SKILL[LEVELS[index].id]?.[column] ?? 0;
  return lerp(skill(below), skill(above), at - below);
}

/**
 * How the computer plays on a level and difficulty - in a match against it
 * on the ladder or a generated level with loadouts (see `planMatch`). Every
 * value of its profile is interpolated inside the difficulty's band.
 */
export function computerProfile(
  levelId: string,
  difficulty: BotDifficulty
): BotProfile {
  const level = getLevel(levelId);
  return profileAt(
    difficulty,
    skillOf(levelId, difficulty),
    level.id === levelId && level.boss !== undefined
  );
}

/**
 * The computer's profile at `skill` of its difficulty's band - 0 its
 * weakest, 1 its strongest - a boss's when `boss`.
 */
export function profileAt(
  difficulty: BotDifficulty,
  skill: number,
  boss = false
): BotProfile {
  const t = clamp(skill, 0, 1);
  const { weak, strong } = SKILL_BANDS[difficulty];
  const at = (key: keyof SkillValues) =>
    Math.round(lerp(weak[key], strong[key], t) * 1000) / 1000;
  const boostRange = at('boostRange');
  return {
    reactionSec: at('reactionSec'),
    attackRatio: at('attackRatio'),
    aimNoise: at('aimNoise'),
    usesBoost: boostRange >= MIN_BOOST_RANGE,
    boostRange,
    weaponPatience: at('weaponPatience'),
    // Only a bold computer charges the nearest enemy: the hard one, and
    // the normal one in the second half of its band.
    chargesNearest:
      difficulty === 'hard' || (difficulty === 'normal' && t >= 0.5),
    // A boss does not wait at its cap for odds that never come - else a
    // survive level stalls until its clock runs out. Any other computer
    // waits: two colonies that charge each other at their cap stall the
    // match just as well, as the balance lab found.
    attacksAtCap: boss,
    pushesAfterCryo: true,
  };
}
