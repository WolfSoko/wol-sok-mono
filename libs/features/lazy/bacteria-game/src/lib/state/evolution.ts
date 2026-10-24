import { ColonyTraits, PLAIN_TRAITS } from './game-balance';
import { clamp } from './geometry';
import { isInteger, isObject } from './is-object';

/**
 * Evolution: what a player makes of their colony between matches.
 *
 * - **DNA** is earned, never stored: it follows from the XP (see
 *   {@link dnaEarned}), so it merges as cleanly as the progress does.
 * - **Genes** are bought with DNA, up to {@link MAX_GENE_LEVEL} levels each,
 *   and make the colony stronger: each level multiplies one of its traits.
 * - **Weapons** are bought with DNA too, and one of them is carried into a
 *   match: a second button next to the boost that fires it at the crosshair.
 *
 * Evolution plays in matches against the computer only: the campaign's
 * ladder and generated levels. The daily level and endless runs feed
 * leaderboards, so they stay plain, as do matches between two players at
 * one screen and online: there the players are measured, not their DNA. A
 * replay keeps the loadouts its colonies played with, so it plays again
 * the same - and a ghost races with the loadout its run recorded.
 *
 * The engine knows only a {@link Loadout} per seat. What a player owns, and
 * what it cost, is the menus' business.
 */

/** A gene, as the dictionaries list it. */
export type GeneId =
  | 'mitosis'
  | 'toxins'
  | 'membrane'
  | 'flagella'
  | 'metabolism';

/** A weapon, as the dictionaries list it. */
export type WeaponId =
  | 'toxin-bomb'
  | 'cryo-pulse'
  | 'phage-strike'
  | 'agar-bloom'
  | 'biofilm-shield';

/** The highest level a gene can be bred to. */
export const MAX_GENE_LEVEL = 5;

/** A gene: the trait each of its levels multiplies, and by how much. */
export interface Gene {
  id: GeneId;
  /** The trait it changes. */
  trait: keyof EvolvedTraits;
  /**
   * What each level adds to the trait's factor - negative where less is
   * better (damage taken, a cooldown).
   */
  perLevel: number;
  /** The material icon the menus show it with. */
  icon: string;
}

/**
 * The traits evolution changes: the boss's {@link ColonyTraits} and the
 * ones only genes and weapons need. Absent ones are 1.
 */
export interface EvolvedTraits extends ColonyTraits {
  /** Times the pressure enemies put on its bacteria - below 1 is tougher. */
  toughnessFactor?: number;
  /** Times how fast its bacteria move. */
  speedFactor?: number;
  /** Times its weapon's cooldown. */
  weaponCooldownFactor?: number;
}

export const GENES: readonly Gene[] = [
  { id: 'mitosis', trait: 'divideFactor', perLevel: 0.06, icon: 'call_split' },
  { id: 'toxins', trait: 'attackFactor', perLevel: 0.05, icon: 'science' },
  {
    id: 'membrane',
    trait: 'toughnessFactor',
    perLevel: -0.05,
    icon: 'shield',
  },
  { id: 'flagella', trait: 'speedFactor', perLevel: 0.06, icon: 'waves' },
  {
    id: 'metabolism',
    trait: 'cooldownFactor',
    perLevel: -0.07,
    icon: 'bolt',
  },
];

/** How a weapon plays. Lengths are in cells of the base arena. */
export interface Weapon {
  id: WeaponId;
  /** The DNA it costs. */
  cost: number;
  /** Seconds before it can be fired again. */
  cooldownSec: number;
  /**
   * Seconds its effect lasts - 0 for a strike, which acts at once, in a
   * single step.
   */
  durationSec: number;
  /** Radius of the circle round the crosshair it acts in. */
  radius: number;
  /**
   * True for one that acts on the enemies of its owner - every other seat,
   * a neutral colony too - false for one that acts on its own colony.
   */
  hostile: boolean;
  /**
   * Where it acts: on the bacteria in its `circle`, or on the whole
   * `colony` - through its toughness, the circle only where it is drawn.
   */
  reach: 'circle' | 'colony';
  /** The material icon the menus and the button show it with. */
  icon: string;
}

/**
 * The weapons, in the order the menus offer them - 70 strands of DNA for
 * all five. Genes and weapons together come to 220 strands, 11,000 XP: a
 * player has bred everything about when they reach the top rank (Superbug
 * at 12,000 XP).
 *
 * - `toxin-bomb`: a cloud at the crosshair that drains only enemy bacteria,
 *   faster than antibiotic ground - a bacterium that stays in it dies.
 * - `cryo-pulse`: enemy bacteria in the circle all but freeze - they hardly
 *   move, divide or recover while it lasts.
 * - `phage-strike`: phages burst from the crosshair and turn a share of the
 *   enemy bacteria in the circle into your own, at once.
 * - `agar-bloom`: golden agar grows at the crosshair; your bacteria on it
 *   divide three times as often, the enemy's not at all faster.
 * - `biofilm-shield`: your whole colony takes far less damage while it
 *   lasts - the circle is only where the shield is drawn from.
 */
export const WEAPONS: readonly Weapon[] = [
  {
    id: 'toxin-bomb',
    cost: 6,
    cooldownSec: 22,
    durationSec: 4,
    radius: 15,
    hostile: true,
    reach: 'circle',
    icon: 'coronavirus',
  },
  {
    id: 'cryo-pulse',
    cost: 10,
    cooldownSec: 20,
    durationSec: 3.5,
    radius: 24,
    hostile: true,
    reach: 'circle',
    icon: 'ac_unit',
  },
  {
    id: 'phage-strike',
    cost: 14,
    cooldownSec: 24,
    durationSec: 0,
    radius: 14,
    hostile: true,
    reach: 'circle',
    icon: 'blur_on',
  },
  {
    id: 'agar-bloom',
    cost: 18,
    cooldownSec: 22,
    durationSec: 6,
    radius: 20,
    hostile: false,
    reach: 'circle',
    icon: 'local_florist',
  },
  {
    id: 'biofilm-shield',
    cost: 22,
    cooldownSec: 26,
    durationSec: 4,
    radius: 30,
    hostile: false,
    reach: 'colony',
    icon: 'hexagon',
  },
];

/** How strongly the weapons act. */
export const WEAPON_EFFECTS = {
  /** Energy a toxin cloud drains per second from an enemy bacterium. */
  toxinDrainPerSec: 0.65,
  /** The chance a frozen bacterium sits a movement step out. */
  cryoStayChance: 0.9,
  /** Times the chance a frozen bacterium divides. */
  cryoDivideFactor: 0.2,
  /** The share of enemy bacteria in the circle a phage strike turns. */
  phageConvertShare: 0.45,
  /** How much more often your bacteria divide on a bloom. */
  agarBloomDivideFactor: 3,
  /** Times the pressure on a shielded colony. */
  shieldToughnessFactor: 0.35,
} as const;

/** What one seat takes into a match: its genes' levels and its weapon. */
export interface Loadout {
  genes: Partial<Record<GeneId, number>>;
  weapon: WeaponId | null;
}

/** A colony without evolution - every colony outside a match vs the computer. */
export const PLAIN_LOADOUT: Loadout = Object.freeze({
  genes: Object.freeze({}),
  weapon: null,
}) as Loadout;

const WEAPONS_BY_ID = Object.fromEntries(
  WEAPONS.map((weapon) => [weapon.id, weapon])
) as Readonly<Record<WeaponId, Weapon>>;

/** The weapon with that id. */
export function weaponOf(id: WeaponId): Weapon {
  return WEAPONS_BY_ID[id];
}

/** A gene's level, clamped to the levels it has. */
export function geneLevel(loadout: Loadout, id: GeneId): number {
  return clamp(Math.floor(loadout.genes[id] ?? 0), 0, MAX_GENE_LEVEL);
}

/**
 * The traits a loadout gives a colony on top of `base` - a boss's or plain
 * ones: each gene's levels multiply its trait.
 */
export function evolvedTraits(
  loadout: Loadout,
  base: ColonyTraits = PLAIN_TRAITS
): EvolvedTraits {
  const traits: EvolvedTraits = { ...base };
  for (const gene of GENES) {
    const level = geneLevel(loadout, gene.id);
    if (level > 0) {
      traits[gene.trait] =
        (traits[gene.trait] ?? 1) * (1 + gene.perLevel * level);
    }
  }
  return traits;
}

/** True for a loadout that changes nothing. */
export function isPlainLoadout(loadout: Loadout): boolean {
  return (
    loadout.weapon === null &&
    GENES.every((gene) => geneLevel(loadout, gene.id) === 0)
  );
}

const GENE_IDS: readonly string[] = GENES.map(({ id }) => id);
const WEAPON_IDS: readonly string[] = WEAPONS.map(({ id }) => id);

export function isGeneId(value: unknown): value is GeneId {
  return typeof value === 'string' && GENE_IDS.includes(value);
}

export function isWeaponId(value: unknown): value is WeaponId {
  return typeof value === 'string' && WEAPON_IDS.includes(value);
}

/**
 * Genes' levels from stored or recorded data. By default it keeps what it
 * can read - whole levels above 0, capped at the top - and drops the rest,
 * as a stored value's parser does. `strict` takes them only exactly as
 * written, else null: a damaged loadout in a replay could only play
 * another match.
 */
export function parseGeneLevels(
  value: unknown,
  options: { strict: true }
): Loadout['genes'] | null;
export function parseGeneLevels(
  value: unknown,
  options?: { strict: false }
): Loadout['genes'];
export function parseGeneLevels(
  value: unknown,
  { strict = false }: { strict?: boolean } = {}
): Loadout['genes'] | null {
  const genes: Loadout['genes'] = {};
  if (!isObject(value)) {
    return strict ? null : genes;
  }
  for (const [id, level] of Object.entries(value)) {
    if (
      isGeneId(id) &&
      isInteger(level, 1, strict ? MAX_GENE_LEVEL : Infinity)
    ) {
      genes[id] = Math.min(MAX_GENE_LEVEL, level);
    } else if (strict) {
      return null;
    }
  }
  return genes;
}

/** XP per DNA strand: a won match on normal is worth a few. */
export const XP_PER_DNA = 50;

/** The DNA a player's XP has earned so far - spent or not. */
export function dnaEarned(xp: number): number {
  return Math.max(0, Math.floor(xp / XP_PER_DNA));
}

/** A weapon fired during a frame - for the effects, the sound and the haptics. */
export interface WeaponFire {
  playerId: number;
  weapon: WeaponId;
  /** Where it was fired, in cells of the arena. */
  x: number;
  y: number;
  /** Its radius in cells of the arena - grown with the grid. */
  radius: number;
  /** True when the computer fired it. */
  isBot: boolean;
}

/**
 * A weapon's effect while it acts on the war, for the painter. A strike
 * that acts at once is one for a single frame.
 */
export interface ActiveEffect {
  weapon: WeaponId;
  /** The seat that fired it. */
  owner: number;
  /** Its centre and radius, in cells of the arena. */
  x: number;
  y: number;
  radius: number;
  /** Seconds it still acts, and how long it acts in all. */
  remainingSec: number;
  durationSec: number;
}
