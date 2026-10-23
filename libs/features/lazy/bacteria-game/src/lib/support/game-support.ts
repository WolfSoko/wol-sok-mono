import { InjectionToken } from '@angular/core';

/** AdSense ads on the menu screens. */
export interface GameAdsOptions {
  /** The AdSense publisher id, `ca-pub-…`. */
  readonly client: string;
  /** The id of the display ad unit the menu screens show. */
  readonly slot: string;
}

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
  /** Null for no ads. */
  readonly ads: GameAdsOptions | null;
}

export const GAME_SUPPORT = new InjectionToken<GameSupportOptions | null>(
  'GAME_SUPPORT',
  { factory: () => null }
);
