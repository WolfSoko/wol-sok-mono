import type { AdNetworkName } from './ad-network-options';

/**
 * The seam between the game and an ad network: everything the game asks of
 * one, so the network can change without a screen noticing. Every network
 * brings its own consent banner (CMP) with its script, and the game asks
 * for no ad before the player has answered it.
 */
export interface AdNetwork {
  /** Which network it is, for the privacy policy's section on ads. */
  readonly name: AdNetworkName;
  /**
   * Adds the network's script, and with it its consent banner, to the page.
   * Calls `onConsentAnswered` once the player has made a choice there, or
   * none is needed - and never where an ad blocker holds the script back.
   */
  load(onConsentAnswered: () => void): void;
  /**
   * Shows a display ad in `host`, an empty element of the page, and returns
   * what takes it out again.
   */
  show(host: HTMLElement): () => void;
  /**
   * Opens the consent banner again. The choice made before holds until the
   * player completes a new one.
   */
  openConsentSettings(): void;
}
