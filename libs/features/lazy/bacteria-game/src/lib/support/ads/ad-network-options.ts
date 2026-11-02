/** Google AdSense: one responsive display ad unit. */
export interface AdSenseOptions {
  readonly network: 'adsense';
  /** The publisher id, `ca-pub-…`. */
  readonly client: string;
  /** The id of the display ad unit the menu screens show. */
  readonly slot: string;
}

/** AdinPlay, an ad network for browser games: one display placement. */
export interface AdinPlayOptions {
  readonly network: 'adinplay';
  /** The site's AIP ID from the AdinPlay dashboard; it names the tag. */
  readonly publisherId: string;
  /** The id of the display placement the menu screens show. */
  readonly placementId: string;
}

/** The ad network the menu screens show ads from, with its ids. */
export type GameAdsOptions = AdSenseOptions | AdinPlayOptions;

export type AdNetworkName = GameAdsOptions['network'];
