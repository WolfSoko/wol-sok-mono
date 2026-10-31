import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { GAME_SUPPORT } from '../game-support';
import type { AdNetwork } from './ad-network';
import type { AdNetworkName, GameAdsOptions } from './ad-network-options';
import { AdinPlayNetwork } from './adinplay-network';
import { AdSenseNetwork } from './adsense-network';

function createAdNetwork(
  options: GameAdsOptions,
  document: Document
): AdNetwork {
  switch (options.network) {
    case 'adsense':
      return new AdSenseNetwork(options, document);
    case 'adinplay':
      return new AdinPlayNetwork(options, document);
  }
}

/**
 * The ads on the menu screens, from the network the support options name
 * (`AdNetwork`): the screens ask this and never a network itself. The
 * network's script brings its consent banner, so it loads with the app,
 * and the ad slots stay empty until the player has made a choice there.
 * Without a network, as inside the shell, the game loads nothing.
 */
@Injectable({ providedIn: 'root' })
export class GameAds {
  private readonly document = inject(DOCUMENT);
  private readonly network = this.createNetwork(
    inject(GAME_SUPPORT)?.ads ?? null
  );

  private readonly answered = signal(false);
  private started = false;

  /** The network the ads come from, null without ads. */
  public readonly networkName: AdNetworkName | null =
    this.network?.name ?? null;
  /**
   * True once the consent banner reported a choice, or that none is
   * needed - and with it, that ads may be shown and the banner is there to
   * open again.
   */
  public readonly consentAnswered = this.answered.asReadonly();

  public start(): void {
    if (!this.network || this.started) return;
    this.started = true;
    this.network.load(() => this.answered.set(true));
  }

  /**
   * Shows an ad in `host`, an empty element of the page; the returned
   * function takes it out again.
   */
  public show(host: HTMLElement): () => void {
    return this.network?.show(host) ?? (() => undefined);
  }

  /**
   * Opens the consent banner again. The choice made before holds until the
   * player completes a new one.
   */
  public openConsentSettings(): void {
    this.network?.openConsentSettings();
  }

  private createNetwork(options: GameAdsOptions | null): AdNetwork | null {
    return options && this.document.defaultView
      ? createAdNetwork(options, this.document)
      : null;
  }
}
