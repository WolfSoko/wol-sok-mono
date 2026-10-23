import {
  GENES,
  GeneId,
  isGeneId,
  isWeaponId,
  Loadout,
  MAX_GENE_LEVEL,
  WEAPONS,
  WeaponId,
} from './evolution';
import { isObject } from './is-object';

/**
 * What a player has made of their colony - the genes bred, the weapons
 * bought, the one carried into a match - as the storage keeps it. The DNA
 * itself is not stored: it follows from the XP (`dnaEarned`), so what is left
 * to spend is the DNA earned less the cost of what is held.
 *
 * Purchases merge in a way that can only gain: per gene the higher level,
 * the weapons of both. A reset is free and gives every strand back; it
 * counts up the epoch, and a higher epoch wins a merge outright, so a reset
 * on one device is not undone by the purchases another one still holds.
 */
export interface EvolutionProgress {
  /** The level bred per gene - absent for none. */
  genes: Partial<Record<GeneId, number>>;
  /** The weapons bought, in the order the menus offer them. */
  weapons: readonly WeaponId[];
  /** The weapon carried into a match, null for none. */
  equipped: WeaponId | null;
  /** How often everything was reset - the higher one wins a merge. */
  epoch: number;
}

export const EMPTY_EVOLUTION: EvolutionProgress = {
  genes: {},
  weapons: [],
  equipped: null,
  epoch: 0,
};

/**
 * The DNA the next level of a gene costs - level `n` costs `2n`. The first
 * level is affordable after the first match won; all five levels of all
 * five genes cost 150 strands, 7,500 XP.
 */
export function geneLevelCost(level: number): number {
  return 2 * level;
}

/**
 * The DNA each weapon costs, in the order the menus offer them - 70 strands
 * for all five. Genes and weapons together come to 220 strands, 11,000 XP:
 * a player has bred everything about when they reach the top rank
 * (Superbug at 12,000 XP).
 */
export const WEAPON_COSTS: Readonly<Record<WeaponId, number>> = {
  'toxin-bomb': 6,
  'cryo-pulse': 10,
  'phage-strike': 14,
  'agar-bloom': 18,
  'biofilm-shield': 22,
};

/** The level bred of a gene. */
export function levelOf(evolution: EvolutionProgress, gene: GeneId): number {
  return evolution.genes[gene] ?? 0;
}

/** The DNA the levels held of a gene cost together. */
export function geneCost(level: number): number {
  let cost = 0;
  for (let n = 1; n <= level; n++) {
    cost += geneLevelCost(n);
  }
  return cost;
}

/** The DNA everything held cost. */
export function spentDna(evolution: EvolutionProgress): number {
  const genes = GENES.reduce(
    (sum, { id }) => sum + geneCost(levelOf(evolution, id)),
    0
  );
  return evolution.weapons.reduce(
    (sum, weapon) => sum + WEAPON_COSTS[weapon],
    genes
  );
}

/**
 * The DNA left to spend: earned less spent, never below 0 - two devices
 * that spent the same strands show 0 after the merge, and nothing is taken
 * back.
 */
export function availableDna(
  earned: number,
  evolution: EvolutionProgress
): number {
  return Math.max(0, earned - spentDna(evolution));
}

/** The cost of the next level of a gene, null once it is bred to the top. */
export function nextGeneCost(
  evolution: EvolutionProgress,
  gene: GeneId
): number | null {
  const level = levelOf(evolution, gene);
  return level >= MAX_GENE_LEVEL ? null : geneLevelCost(level + 1);
}

/** True for a gene whose next level the DNA left pays for. */
export function canBuyGene(
  earned: number,
  evolution: EvolutionProgress,
  gene: GeneId
): boolean {
  const cost = nextGeneCost(evolution, gene);
  return cost !== null && cost <= availableDna(earned, evolution);
}

/** True for a weapon not held yet that the DNA left pays for. */
export function canBuyWeapon(
  earned: number,
  evolution: EvolutionProgress,
  weapon: WeaponId
): boolean {
  return (
    !evolution.weapons.includes(weapon) &&
    WEAPON_COSTS[weapon] <= availableDna(earned, evolution)
  );
}

/** True when the DNA left buys anything at all - the menu's badge. */
export function canBuyAnything(
  earned: number,
  evolution: EvolutionProgress
): boolean {
  return (
    GENES.some(({ id }) => canBuyGene(earned, evolution, id)) ||
    WEAPONS.some(({ id }) => canBuyWeapon(earned, evolution, id))
  );
}

/**
 * A gene bred to at least `level`. As a level, not a step up, so applying
 * it to a stored value that already holds it - bought on another device, or
 * the same change applied twice - changes nothing.
 */
export function withGeneLevel(
  evolution: EvolutionProgress,
  gene: GeneId,
  level: number
): EvolutionProgress {
  const target = Math.min(MAX_GENE_LEVEL, Math.floor(level));
  if (target <= levelOf(evolution, gene)) {
    return evolution;
  }
  return { ...evolution, genes: { ...evolution.genes, [gene]: target } };
}

/**
 * A weapon bought - and carried, when no weapon is carried yet, so the
 * first one bought is in the next match at once.
 */
export function withWeapon(
  evolution: EvolutionProgress,
  weapon: WeaponId
): EvolutionProgress {
  if (evolution.weapons.includes(weapon)) {
    return evolution;
  }
  return {
    ...evolution,
    weapons: sortedWeapons([...evolution.weapons, weapon]),
    equipped: evolution.equipped ?? weapon,
  };
}

/** A weapon carried into the next match - null for none, one not held is ignored. */
export function withEquipped(
  evolution: EvolutionProgress,
  weapon: WeaponId | null
): EvolutionProgress {
  if (weapon === evolution.equipped) {
    return evolution;
  }
  if (weapon !== null && !evolution.weapons.includes(weapon)) {
    return evolution;
  }
  return { ...evolution, equipped: weapon };
}

/**
 * Everything given back: no gene, no weapon, an epoch above `stored`'s and
 * the one held here, so the reset wins the merge on every device.
 */
export function resetEvolution(
  held: EvolutionProgress,
  stored: EvolutionProgress = held
): EvolutionProgress {
  return { ...EMPTY_EVOLUTION, epoch: Math.max(held.epoch, stored.epoch) + 1 };
}

/**
 * Two evolutions in one: a higher epoch wins outright - it was reset after
 * the other's purchases. On the same epoch each gene keeps the higher level
 * and the weapons are those of both; the weapon carried is `other`'s, as long
 * as it is held.
 */
export function mergeEvolution(
  held: EvolutionProgress,
  other: EvolutionProgress
): EvolutionProgress {
  if (other.epoch !== held.epoch) {
    return other.epoch > held.epoch ? other : held;
  }
  let merged = held;
  for (const { id } of GENES) {
    merged = withGeneLevel(merged, id, levelOf(other, id));
  }
  const added = other.weapons.filter((w) => !merged.weapons.includes(w));
  if (added.length > 0) {
    merged = {
      ...merged,
      weapons: sortedWeapons([...merged.weapons, ...added]),
    };
  }
  return withEquipped(merged, other.equipped);
}

/**
 * An account's evolution with what a guest bred joined in, for a guest who
 * signs in to an account that has played elsewhere. The guest's purchases
 * join the account's epoch: a guest who reset more often must not wipe the
 * account's genes.
 */
export function adoptEvolution(
  account: EvolutionProgress,
  guest: EvolutionProgress
): EvolutionProgress {
  return mergeEvolution(account, {
    ...guest,
    epoch: account.epoch,
    // The account keeps the weapon it carries, if it carries one.
    equipped: account.equipped ?? guest.equipped,
  });
}

/** What a player takes into a match against the computer. */
export function loadoutOf(evolution: EvolutionProgress): Loadout {
  return { genes: { ...evolution.genes }, weapon: evolution.equipped };
}

/** True for a gene bred to its top level. */
export function isMaxed(evolution: EvolutionProgress, gene: GeneId): boolean {
  return levelOf(evolution, gene) >= MAX_GENE_LEVEL;
}

/**
 * The evolution in a stored value, keeping everything it can read and
 * dropping the rest - a damaged entry never throws, nor costs the player
 * the parts that are fine.
 */
export function parseEvolution(value: unknown): EvolutionProgress {
  if (!isObject(value)) {
    return EMPTY_EVOLUTION;
  }
  const genes: Partial<Record<GeneId, number>> = {};
  if (isObject(value['genes'])) {
    for (const [id, level] of Object.entries(value['genes'])) {
      if (isGeneId(id) && Number.isInteger(level) && (level as number) > 0) {
        genes[id] = Math.min(MAX_GENE_LEVEL, level as number);
      }
    }
  }
  const weapons = Array.isArray(value['weapons'])
    ? sortedWeapons(
        (value['weapons'] as unknown[]).filter(isWeaponId) as WeaponId[]
      )
    : [];
  const equipped = value['equipped'];
  const epoch = value['epoch'];
  return {
    genes,
    weapons,
    equipped:
      isWeaponId(equipped) && weapons.includes(equipped) ? equipped : null,
    epoch:
      Number.isInteger(epoch) && (epoch as number) > 0 ? (epoch as number) : 0,
  };
}

/** True when two evolutions hold the same. */
export function sameEvolution(
  a: EvolutionProgress,
  b: EvolutionProgress
): boolean {
  return (
    a.epoch === b.epoch &&
    a.equipped === b.equipped &&
    a.weapons.length === b.weapons.length &&
    a.weapons.every((weapon, index) => b.weapons[index] === weapon) &&
    GENES.every(({ id }) => levelOf(a, id) === levelOf(b, id))
  );
}

/** Weapons without doubles, in the order the menus offer them. */
function sortedWeapons(weapons: readonly WeaponId[]): WeaponId[] {
  return WEAPONS.map(({ id }) => id).filter((id) => weapons.includes(id));
}
