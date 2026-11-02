/**
 * The seam between the game and an ad network: everything the game asks of
 * one, so the network can change without a screen noticing. Every network
 * brings its own consent banner (CMP) with its script, and the game asks
 * for no ad before the player has answered it.
 */
export interface AdNetwork {
  /**
   * Adds the network's script, and with it its consent banner, to the page.
   * Calls `onConsentAnswered` once the player has made a choice there, or
   * none is needed - and never where an ad blocker holds the script back.
   */
  load(onConsentAnswered: () => void): void;
  /**
   * Shows a display ad in `host`, an empty element of the page, and returns
   * what takes it out again. The menu shows one ad on the page at a time
   * (one `AdSlotComponent` per screen), which a network may rely on:
   * AdinPlay's placement is an element id.
   */
  show(host: HTMLElement): () => void;
  /**
   * Opens the consent banner again. The choice made before holds until the
   * player completes a new one.
   */
  openConsentSettings(): void;
}
