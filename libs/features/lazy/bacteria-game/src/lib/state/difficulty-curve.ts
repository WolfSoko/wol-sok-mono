import { BOT_DIFFICULTIES, BotDifficulty, BotProfile } from './bot-controller';
import { clamp } from './geometry';
import { heatOf, parseGeneratedId } from './level-generator/generate-level';
import { LEVELS } from './levels';

/**
 * The campaign's difficulty curve (ADR 0014): how often a player of the
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
export const LADDER_VERSION = 1;

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
 * Each difficulty's band, from its weakest computer (the first level) to
 * its strongest. The bands follow on from each other, so the difficulty
 * picker matters on every level: the easy computer stays easier than the
 * normal one, which stays easier than the hard one.
 */
const SKILL_BANDS: Readonly<
  Record<BotDifficulty, { weak: SkillValues; strong: SkillValues }>
> = {
  easy: {
    weak: {
      reactionSec: 1.5,
      attackRatio: 1.7,
      aimNoise: 30,
      boostRange: 0,
      weaponPatience: 1.8,
    },
    strong: {
      reactionSec: 0.85,
      attackRatio: 1.3,
      aimNoise: 16,
      boostRange: 40,
      weaponPatience: 1.4,
    },
  },
  normal: {
    weak: {
      reactionSec: 0.85,
      attackRatio: 1.3,
      aimNoise: 16,
      boostRange: 40,
      weaponPatience: 1.4,
    },
    strong: {
      reactionSec: 0.4,
      attackRatio: 1,
      aimNoise: 5,
      boostRange: 80,
      weaponPatience: 1.05,
    },
  },
  hard: {
    weak: {
      reactionSec: 0.4,
      attackRatio: 1,
      aimNoise: 5,
      boostRange: 80,
      weaponPatience: 1.05,
    },
    strong: {
      reactionSec: 0.2,
      attackRatio: 0.8,
      aimNoise: 1.5,
      boostRange: 110,
      weaponPatience: 0.9,
    },
  },
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
  corridors: [0.05, 0.05, 0.05],
  hourglass: [0.1, 0.1, 0.1],
  'inner-ring': [0.12, 0.12, 0.12],
  'pillar-field': [0.17, 0.17, 0.17],
  'twin-chambers': [0.22, 0.22, 0.22],
  serpentine: [0.27, 0.27, 0.27],
  pistons: [0.32, 0.32, 0.32],
  alveoli: [0.35, 0.35, 0.35],
  mycelium: [0.4, 0.4, 0.4],
  heartbeat: [0.45, 0.45, 0.45],
  villi: [0.5, 0.5, 0.5],
  'half-life': [0.52, 0.52, 0.52],
  containment: [0.57, 0.57, 0.57],
  'control-room': [0.62, 0.62, 0.62],
  meltdown: [0.65, 0.65, 0.65],
  'patient-zero': [0.62, 0.62, 0.62],
  quarantine: [0.67, 0.67, 0.67],
  'feeding-ground': [0.72, 0.72, 0.72],
  expanse: [0.7, 0.7, 0.7],
  archipelago: [0.77, 0.77, 0.77],
  bloodstream: [0.84, 0.84, 0.84],
  'root-network': [0.92, 0.92, 0.92],
  leviathan: [1, 1, 1],
};

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
  return skill(below) + (skill(above) - skill(below)) * (at - below);
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
  return profileAt(difficulty, skillOf(levelId, difficulty));
}

/**
 * The computer's profile at `skill` of its difficulty's band - 0 its
 * weakest, 1 its strongest.
 */
export function profileAt(
  difficulty: BotDifficulty,
  skill: number
): BotProfile {
  const t = clamp(skill, 0, 1);
  const { weak, strong } = SKILL_BANDS[difficulty];
  const at = (key: keyof SkillValues) =>
    Math.round((weak[key] + (strong[key] - weak[key]) * t) * 1000) / 1000;
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
    // Two colonies at their cap that wait for each other stall the match.
    attacksAtCap: true,
    pushesAfterCryo: true,
  };
}
