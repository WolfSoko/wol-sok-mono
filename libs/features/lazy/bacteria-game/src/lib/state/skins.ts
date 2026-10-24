/**
 * The skins: how the bacteria are drawn. The first ones are free, the
 * fancier ones are bought with DNA (`evolution-progress.ts`) and kept for
 * good - a cosmetic, never a strength, so a reset gives their strands back
 * no more than it takes the skins away.
 *
 * - slime: one gooey, glossy slime per colony
 * - cells: dense glossy cells of different sizes, like on the app icon
 * - honeycomb: a comb of glossy hexagonal tiles with dark seams
 * - crystal: irregular facets with bright seams, like shards of glass
 * - neon: a dark body with its outline glowing in the colony's colour
 * - ink: flat and hatched like a woodcut, with a thick outline - each
 *   colony hatched its own way, so two are told apart without colour
 * - bubbles: glassy bubbles of different sizes with snippets of DNA
 *   floating inside
 * - pixels: the crisp pixels the game started with
 * - marbles: glass marbles of different sizes, a swirl of colour inside
 *   each, lit with a hard highlight and a glow where the light leaves
 * - lava: a dark crust, bulging, with glowing cracks that breathe
 * - galaxy: deep space in the colony's colour, clouds of gas and stars
 *   that twinkle
 * - plasma: a dark body full of arcs of light that crackle and move
 * - chrome: liquid metal, its surface mirroring a sky in the colony's
 *   colour, bevelled along the front
 */
export type BacteriaLook =
  | 'slime'
  | 'cells'
  | 'honeycomb'
  | 'crystal'
  | 'neon'
  | 'ink'
  | 'bubbles'
  | 'pixels'
  | 'marbles'
  | 'lava'
  | 'galaxy'
  | 'plasma'
  | 'chrome';

/** A skin as the My Colony screen offers it. */
export interface Skin {
  id: BacteriaLook;
  /** The DNA it costs - 0 for one that is free from the start. */
  cost: number;
}

/**
 * The skins in the order the gallery shows them: the free ones, then the
 * ones to buy, cheapest first. The five to buy come to 102 strands, 5,100
 * XP - about what the ladder's last chapters earn, after the genes and the
 * weapons.
 */
export const SKINS: readonly Skin[] = [
  { id: 'slime', cost: 0 },
  { id: 'cells', cost: 0 },
  { id: 'honeycomb', cost: 0 },
  { id: 'crystal', cost: 0 },
  { id: 'neon', cost: 0 },
  { id: 'ink', cost: 0 },
  { id: 'bubbles', cost: 0 },
  { id: 'pixels', cost: 0 },
  { id: 'marbles', cost: 12 },
  { id: 'lava', cost: 16 },
  { id: 'galaxy', cost: 20 },
  { id: 'plasma', cost: 24 },
  { id: 'chrome', cost: 30 },
];

/** The looks in the order the gallery shows them; their names are texts. */
export const BACTERIA_LOOKS: readonly BacteriaLook[] = SKINS.map(
  ({ id }) => id
);

/** The skins that are bought, in the gallery's order. */
export const PREMIUM_SKINS: readonly Skin[] = SKINS.filter(
  ({ cost }) => cost > 0
);

const COST_BY_ID = Object.fromEntries(
  SKINS.map(({ id, cost }) => [id, cost])
) as Readonly<Record<BacteriaLook, number>>;

export function isBacteriaLook(value: unknown): value is BacteriaLook {
  return typeof value === 'string' && value in COST_BY_ID;
}

/** The DNA a skin costs - 0 for a free one. */
export function skinCost(look: BacteriaLook): number {
  return COST_BY_ID[look];
}

/** True for a skin that is bought, not free from the start. */
export function isPremiumSkin(value: unknown): value is BacteriaLook {
  return isBacteriaLook(value) && COST_BY_ID[value] > 0;
}

/** The DNA every skin to buy costs together. */
export function allSkinsCost(): number {
  return PREMIUM_SKINS.reduce((sum, { cost }) => sum + cost, 0);
}
