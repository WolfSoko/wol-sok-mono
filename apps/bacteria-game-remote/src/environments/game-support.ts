import type { GameSupportOptions } from '@wolsok/feat-lazy-bac-game';
import { SITE_OWNER } from '@wolsok/shared-legal';

/** The tips every build offers, without ads: the live site adds those. */
export const SUPPORT_DEFAULTS: GameSupportOptions = {
  buyMeACoffeeHandle: 'wolf',
  // Consumable in-app products of the Play listing, see the Android README.
  playTipProductIds: ['tip_small', 'tip_medium', 'tip_large'],
  // The app's package, as in .well-known/assetlinks.json (asset-links.spec.ts).
  androidPackage: 'de.wolsok.bacteriawars',
  siteOwner: SITE_OWNER.name,
  ads: null,
};
