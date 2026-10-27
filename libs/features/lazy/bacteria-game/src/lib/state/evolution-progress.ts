import {
  GENES,
  GeneId,
  isWeaponId,
  Loadout,
  MAX_GENE_LEVEL,
  parseGeneLevels,
  weaponOf,
  WEAPONS,
  WeaponId,
} from './evolution';
import { isInteger, isObject } from './is-object';
import { BacteriaLook, isPremiumSkin, PREMIUM_SKINS, skinCost } from './skins';

/**
 * What a player has made of their colony - the genes bred, the weapons
 * bought, the one carried into a match - as the storage keeps it. The DNA
 * itself is not stored: it follows from the XP (`dnaEarned`), so what is left
 * to spend is the DNA earned less the cost of what is held.
 *
 * Purchases merge in a way that can only gain: per gene the higher level,
 * the weapons of both. The weapon carried is the latest pick: every pick
 * counts up `equipCount`, and the higher count wins a merge, so a stale value
 * from the storage or another device never undoes a pick made since. A reset
 * is free and gives every strand back; it counts up the epoch, and a higher
 * epoch wins a merge outright, so a reset on one device is not undone by the
 * purchases another one still holds.
 *
 * Skins (`skins.ts`) are bought with the same DNA, but are cosmetics and
 * stay bought: a reset keeps them, and their strands with them, and they
 * merge as the union across epochs, so a reset on one device never takes a
 * skin another device bought.
 */
export interface EvolutionProgress {
  /** The level bred per gene - absent for none. */
  genes: Partial<Record<GeneId, number>>;
  /** The weapons bought, in the order the menus offer them. */
  weapons: readonly WeaponId[];
  /** The weapon carried into a match, null for none. */
  equipped: WeaponId | null;
  /**
   * How often the weapon carried was picked, putting one down included -
   * the higher one wins a merge. 0 in a value stored before it was kept.
   */
  equipCount: number;
  /** How often everything was reset - the higher one wins a merge. */
  epoch: number;
  /** The skins bought, in the gallery's order - the free ones are never listed. */
  skins: readonly BacteriaLook[];
}

export const EMPTY_EVOLUTION: EvolutionProgress = {
  genes: {},
  weapons: [],
  equipped: null,
  equipCount: 0,
  epoch: 0,
  skins: [],
};

/** The DNA the first level of a gene costs. */
export const GENE_BASE_COST = 2;

/** Times the cost of the level before that each further level costs. */
export const GENE_COST_GROWTH = 1.6;

/**
 * The DNA the next level of a gene costs: it grows exponentially, each
 * level {@link GENE_COST_GROWTH} times the one before, rounded to whole
 * strands - 2, 3, 5, 8, 13, each about the two before it together. The
 * first level is affordable after the first match won; all five levels of
 * all five genes cost 155 strands, 7,750 XP. The computer spends along the
 * same curve, so a change to it raises `LADDER_VERSION`.
 */
export function geneLevelCost(level: number): number {
  return Math.round(GENE_BASE_COST * GENE_COST_GROWTH ** (level - 1));
}

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

/** The DNA the genes and the weapons held cost - what a reset gives back. */
export function refundableDna(evolution: EvolutionProgress): number {
  const genes = GENES.reduce(
    (sum, { id }) => sum + geneCost(levelOf(evolution, id)),
    0
  );
  return evolution.weapons.reduce(
    (sum, weapon) => sum + weaponOf(weapon).cost,
    genes
  );
}

/** The DNA the skins bought cost. */
export function skinsDna(evolution: EvolutionProgress): number {
  return evolution.skins.reduce((sum, skin) => sum + skinCost(skin), 0);
}

/** The DNA everything held cost, skins included. */
export function spentDna(evolution: EvolutionProgress): number {
  return refundableDna(evolution) + skinsDna(evolution);
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
    weaponOf(weapon).cost <= availableDna(earned, evolution)
  );
}

/** True for a skin the player may wear: free, or bought. */
export function ownsSkin(
  evolution: EvolutionProgress,
  skin: BacteriaLook
): boolean {
  return skinCost(skin) === 0 || evolution.skins.includes(skin);
}

/** True for a skin not owned yet that the DNA left pays for. */
export function canBuySkin(
  earned: number,
  evolution: EvolutionProgress,
  skin: BacteriaLook
): boolean {
  return (
    !ownsSkin(evolution, skin) &&
    skinCost(skin) <= availableDna(earned, evolution)
  );
}

/** True when the DNA left buys a skin - the My Colony tile's badge. */
export function canBuyAnySkin(
  earned: number,
  evolution: EvolutionProgress
): boolean {
  return PREMIUM_SKINS.some(({ id }) => canBuySkin(earned, evolution, id));
}

/** True when the DNA left buys a gene or a weapon - the Evolution tile's badge. */
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
  const bought = {
    ...evolution,
    weapons: sortedWeapons([...evolution.weapons, weapon]),
  };
  return evolution.equipped === null ? withEquipped(bought, weapon) : bought;
}

/** A skin bought - a free one, or one held already, changes nothing. */
export function withSkin(
  evolution: EvolutionProgress,
  skin: BacteriaLook
): EvolutionProgress {
  if (ownsSkin(evolution, skin)) {
    return evolution;
  }
  return { ...evolution, skins: sortedSkins([...evolution.skins, skin]) };
}

/**
 * A weapon carried into the next match - null for none, one not held is
 * ignored. A pick counts up `equipCount`, so it wins a merge with any value
 * from before it.
 */
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
  return {
    ...evolution,
    equipped: weapon,
    equipCount: evolution.equipCount + 1,
  };
}

/**
 * Everything given back: no gene, no weapon, an epoch above `stored`'s and
 * the one held here, so the reset wins the merge on every device. The
 * skins stay, those of both.
 */
export function resetEvolution(
  held: EvolutionProgress,
  stored: EvolutionProgress = held
): EvolutionProgress {
  return {
    ...EMPTY_EVOLUTION,
    epoch: Math.max(held.epoch, stored.epoch) + 1,
    skins: orderedUnion(PREMIUM_SKIN_IDS, held.skins, stored.skins),
  };
}

/**
 * Two evolutions in one: a higher epoch wins outright - it was reset after
 * the other's purchases. On the same epoch each gene keeps the higher level
 * and the weapons are those of both; the weapon carried is the one picked
 * last ({@link laterPick}). The skins are those of both whatever the
 * epochs. The same whichever way round the two come.
 */
export function mergeEvolution(
  held: EvolutionProgress,
  other: EvolutionProgress
): EvolutionProgress {
  // The skins are the union of both whatever the epochs; the rest is
  // governed by the epoch.
  const skins = orderedUnion(PREMIUM_SKIN_IDS, held.skins, other.skins);
  const base =
    other.epoch === held.epoch
      ? mergeSameEpoch(held, other)
      : other.epoch > held.epoch
        ? other
        : held;
  return sameList(skins, base.skins) ? base : { ...base, skins };
}

/** {@link mergeEvolution} of two evolutions on the same epoch, the skins aside. */
function mergeSameEpoch(
  held: EvolutionProgress,
  other: EvolutionProgress
): EvolutionProgress {
  let merged = held;
  for (const { id } of GENES) {
    merged = withGeneLevel(merged, id, levelOf(other, id));
  }
  const weapons = orderedUnion(WEAPON_IDS, merged.weapons, other.weapons);
  if (weapons !== merged.weapons) {
    merged = { ...merged, weapons };
  }
  const pick = laterPick(held, other);
  if (
    pick.equipped !== merged.equipped ||
    pick.equipCount !== merged.equipCount
  ) {
    merged = {
      ...merged,
      equipped: pick.equipped,
      equipCount: pick.equipCount,
    };
  }
  return merged;
}

/**
 * Of two evolutions, the one whose weapon carried was picked last: the
 * higher `equipCount`. Two devices that picked as often, each its own
 * weapon, agree on the one later in the menus' order - none comes first.
 */
function laterPick(
  a: EvolutionProgress,
  b: EvolutionProgress
): EvolutionProgress {
  if (a.equipCount !== b.equipCount) {
    return a.equipCount > b.equipCount ? a : b;
  }
  return weaponRank(a.equipped) >= weaponRank(b.equipped) ? a : b;
}

function weaponRank(weapon: WeaponId | null): number {
  return weapon === null ? -1 : WEAPONS.findIndex(({ id }) => id === weapon);
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
  const merged = mergeEvolution(account, {
    ...guest,
    epoch: account.epoch,
    equipped: account.equipped,
    equipCount: account.equipCount,
  });
  // The account keeps the weapon it carries, if it carries one; else it
  // takes up the guest's, as a pick of its own.
  return account.equipped === null && guest.equipped !== null
    ? withEquipped(merged, guest.equipped)
    : merged;
}

/** What a player takes into a match against the computer. */
export function loadoutOf(evolution: EvolutionProgress): Loadout {
  return { genes: { ...evolution.genes }, weapon: evolution.equipped };
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
  const genes = parseGeneLevels(value['genes']);
  const weapons = Array.isArray(value['weapons'])
    ? sortedWeapons(
        (value['weapons'] as unknown[]).filter(isWeaponId) as WeaponId[]
      )
    : [];
  const equipped = value['equipped'];
  const equipCount = value['equipCount'];
  const epoch = value['epoch'];
  const skins = Array.isArray(value['skins'])
    ? sortedSkins((value['skins'] as unknown[]).filter(isPremiumSkin))
    : [];
  return {
    genes,
    weapons,
    equipped:
      isWeaponId(equipped) && weapons.includes(equipped) ? equipped : null,
    equipCount: isInteger(equipCount, 1) ? equipCount : 0,
    epoch: isInteger(epoch, 1) ? epoch : 0,
    skins,
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
    a.equipCount === b.equipCount &&
    sameList(a.weapons, b.weapons) &&
    sameList(a.skins, b.skins) &&
    GENES.every(({ id }) => levelOf(a, id) === levelOf(b, id))
  );
}

const WEAPON_IDS: readonly WeaponId[] = WEAPONS.map(({ id }) => id);
const PREMIUM_SKIN_IDS: readonly BacteriaLook[] = PREMIUM_SKINS.map(
  ({ id }) => id
);

/** Weapons without doubles, in the order the menus offer them. */
function sortedWeapons(weapons: readonly WeaponId[]): WeaponId[] {
  return WEAPON_IDS.filter((id) => weapons.includes(id));
}

/** Skins without doubles, in the gallery's order. */
function sortedSkins(skins: readonly BacteriaLook[]): BacteriaLook[] {
  return PREMIUM_SKIN_IDS.filter((id) => skins.includes(id));
}

/**
 * The items of both lists, without doubles, in `order` - `a` itself when
 * `b` adds nothing, so a caller can tell.
 */
function orderedUnion<T>(
  order: readonly T[],
  a: readonly T[],
  b: readonly T[]
): readonly T[] {
  return b.every((item) => a.includes(item))
    ? a
    : order.filter((item) => a.includes(item) || b.includes(item));
}

/** True when two lists hold the same items in the same order. */
function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => b[index] === item);
}
