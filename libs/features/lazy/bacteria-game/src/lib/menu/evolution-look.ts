import type { Rgb } from '../arena/arena-theme';
import type { TranslationKey } from '../i18n/dictionaries';
import { Gene, GeneId, MAX_GENE_LEVEL, WeaponId } from '../state/evolution';
import { clamp } from '../state/geometry';

/**
 * How the menus show evolution: the colour of each weapon's aura and of
 * each gene, the texts of both by id, and what a gene's levels do in per
 * cent - "+12 % division".
 */

export { WEAPON_COLORS } from '../arena/arena-theme';

/** Each gene's colour, for its card's icon and the particles bought with. */
export const GENE_COLORS: Readonly<Record<GeneId, Rgb>> = {
  mitosis: [120, 230, 140],
  toxins: [170, 255, 80],
  membrane: [140, 180, 255],
  flagella: [90, 220, 255],
  metabolism: [255, 170, 60],
};

/** The gold of a gene bred to the top. */
export const MAXED_COLOR: Rgb = [233, 185, 73];

export function geneKeys(id: GeneId): {
  name: TranslationKey;
  description: TranslationKey;
  effect: TranslationKey;
} {
  return {
    name: `evolution.genes.names.${id}`,
    description: `evolution.genes.descriptions.${id}`,
    effect: `evolution.genes.effects.${id}`,
  };
}

export function weaponKeys(id: WeaponId): {
  name: TranslationKey;
  description: TranslationKey;
} {
  return {
    name: `evolution.weapons.names.${id}`,
    description: `evolution.weapons.descriptions.${id}`,
  };
}

/**
 * What a gene's levels do together, in whole per cent of the trait - 12
 * for two levels of +6 %. The sign is the text's: "−10 % damage taken".
 */
export function genePercent(gene: Gene, level: number): number {
  return Math.round(
    Math.abs(gene.perLevel) * clamp(level, 0, MAX_GENE_LEVEL) * 100
  );
}
