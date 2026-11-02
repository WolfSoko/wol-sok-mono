import type {
  AdinPlayOptions,
  AdSenseOptions,
} from '../lib/support/ads/ad-network-options';
import type { GameSupportOptions } from '../lib/support/game-support';

/** The support options of a spec: the game's own site, without ads. */
export const GAME_SUPPORT_OPTIONS: GameSupportOptions = {
  buyMeACoffeeHandle: 'wolf',
  playTipProductIds: [],
  androidPackage: 'de.wolsok.bacteriawars',
  siteOwner: 'Wolfram Sokollek',
  ads: null,
};

/** The ad networks of a spec, with ids of their own. */
export const ADINPLAY_ADS: AdinPlayOptions = {
  network: 'adinplay',
  publisherId: 'BW',
  placementId: 'BW_menu',
};
export const ADSENSE_ADS: AdSenseOptions = {
  network: 'adsense',
  client: 'ca-pub-1',
  slot: '42',
};
