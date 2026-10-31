import { InjectionToken } from '@angular/core';
import type { GameAdsOptions } from './ads/ad-network-options';

/** How players can pay for the game. */
export interface GameSupportOptions {
  /** `buymeacoffee.com/<handle>`, offered on the web; empty for none. */
  readonly buyMeACoffeeHandle: string;
  /**
   * Consumable Play products the Play Store app offers as tips, in display
   * order. Google Play allows tips to the developer only through Play
   * Billing, so the app never shows the Buy Me a Coffee link.
   */
  readonly playTipProductIds: readonly string[];
  /** The package of the Play Store app, to tell it from the browser. */
  readonly androidPackage: string;
  /** Who runs the site, for the footer's copyright line. */
  readonly siteOwner: string;
  /**
   * The ad network of the menu screens, null for no ads: the game then
   * loads no ad script and shows no consent banner.
   */
  readonly ads: GameAdsOptions | null;
}

export const GAME_SUPPORT = new InjectionToken<GameSupportOptions | null>(
  'GAME_SUPPORT',
  { factory: () => null }
);
