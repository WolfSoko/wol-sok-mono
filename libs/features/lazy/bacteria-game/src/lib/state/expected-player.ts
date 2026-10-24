import { ACHIEVEMENT_IDS } from './achievement-ids';
import { TARGET_CURVE } from './difficulty-curve';
import {
  dnaEarned,
  GeneId,
  Loadout,
  MAX_GENE_LEVEL,
  WeaponId,
  weaponOf,
} from './evolution';
import { geneLevelCost } from './evolution-progress';
import { LEVELS } from './levels';
import { ACHIEVEMENT_XP, MEDAL_XP, matchXp } from './xp';

/**
 * A typical player at each step of the ladder (ADR 0014): the XP they hold
 * there, the DNA it earned, and how they spent it. The computer's evolution
 * follows this player's DNA, not the real player's, and the balance lab's
 * stand-in carries what this player owns.
 *
 * The typical player plays the ladder in order on normal: wins each level
 * once, losing as often before as the target curve says, holds a
 * medallion between bronze and silver of each, and picks up an achievement
 * every third level.
 */

/** XP a typical player holds per level won - a medallion between bronze and silver. */
const TYPICAL_MEDAL_XP = (MEDAL_XP.bronze + MEDAL_XP.silver) / 2;
/** Levels won per achievement a typical player picks up. */
const LEVELS_PER_ACHIEVEMENT = 3;

/** What winning a level on normal earns a typical player, the tries lost before included. */
function levelXp(levelId: string): number {
  const winRate = TARGET_CURVE[levelId] ?? 0.5;
  const losses = (1 - winRate) / winRate;
  return (
    matchXp({ difficulty: 'normal', won: true }) +
    losses * matchXp({ difficulty: 'normal', won: false }) +
    TYPICAL_MEDAL_XP
  );
}

/**
 * The XP a typical player holds when they reach the ladder level of that
 * index - fractional between two levels (a generated level by its heat).
 */
export function expectedXp(index: number): number {
  const at = Math.max(0, Math.min(LEVELS.length - 1, index));
  const whole = Math.floor(at);
  let xp = 0;
  for (let i = 0; i < whole; i++) {
    xp += levelXp(LEVELS[i].id);
  }
  xp += (at - whole) * levelXp(LEVELS[whole].id);
  const achievements = Math.min(
    ACHIEVEMENT_IDS.length,
    Math.floor(at / LEVELS_PER_ACHIEVEMENT)
  );
  return Math.round(xp + achievements * ACHIEVEMENT_XP);
}

/** The DNA a typical player has earned when they reach that ladder index. */
export function expectedDna(index: number): number {
  return dnaEarned(expectedXp(index));
}

/** A purchase: the next level of a gene, or a weapon. */
export type Purchase = { gene: GeneId } | { weapon: WeaponId };

/**
 * The order a typical player buys in: a cheap weapon first, then a level
 * of every gene, the ones that fight first, a stronger weapon, and on
 * round the genes. Of the weapons owned the last one bought is carried.
 */
const PLAYER_PURCHASES: readonly Purchase[] = [
  { weapon: 'toxin-bomb' },
  // The first level of each gene,
  ...nextLevels(['mitosis', 'toxins', 'membrane', 'metabolism', 'flagella']),
  // the second of the ones that fight,
  ...nextLevels(['mitosis', 'toxins', 'membrane']),
  { weapon: 'phage-strike' },
  ...nextLevels(['metabolism', 'flagella']),
  // and on round all five, to the top.
  ...[3, 4, 5].flatMap(() =>
    nextLevels(['mitosis', 'toxins', 'membrane', 'metabolism', 'flagella'])
  ),
];

/** The next level of each of the genes, in order. */
function nextLevels(genes: readonly GeneId[]): Purchase[] {
  return genes.map((gene) => ({ gene }));
}

/**
 * What a typical player carries into a match with that much DNA earned:
 * their purchases in order, as far as the DNA goes.
 */
export function expectedLoadout(dna: number): Loadout {
  return spend(dna, PLAYER_PURCHASES);
}

/**
 * The loadout bought by going down a list of purchases while the DNA
 * lasts - stopping at the first one it does not cover. A weapon bought
 * later is carried instead of the one before.
 */
export function spend(dna: number, purchases: readonly Purchase[]): Loadout {
  const genes: Partial<Record<GeneId, number>> = {};
  let weapon: WeaponId | null = null;
  let left = dna;
  for (const purchase of purchases) {
    if ('weapon' in purchase) {
      const { cost } = weaponOf(purchase.weapon);
      if (cost > left) {
        break;
      }
      left -= cost;
      weapon = purchase.weapon;
      continue;
    }
    const level = (genes[purchase.gene] ?? 0) + 1;
    if (level > MAX_GENE_LEVEL) {
      continue;
    }
    const cost = geneLevelCost(level);
    if (cost > left) {
      break;
    }
    left -= cost;
    genes[purchase.gene] = level;
  }
  return { genes, weapon };
}
