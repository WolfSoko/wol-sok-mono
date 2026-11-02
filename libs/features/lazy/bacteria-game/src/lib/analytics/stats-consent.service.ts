import { computed, inject, Injectable } from '@angular/core';
import { ConsentPrompt } from '@wolsok/shared-analytics';
import { GameAds } from '../support/ads/game-ads.service';

/**
 * The player's say over the usage statistics, as the game's screens see
 * it. Only the game's own site measures (the remote's app config provides
 * the `ConsentPrompt`); inside the shell `available` is false and nothing
 * asks.
 */
@Injectable({ providedIn: 'root' })
export class StatsConsent {
  private readonly prompt = inject(ConsentPrompt, { optional: true });
  private readonly ads = inject(GameAds);

  public readonly available = this.prompt !== null;
  /**
   * Whether the main menu asks: a choice is due, and the ad network's
   * consent banner, where the game has ads, is done with, so the two never
   * stack.
   */
  public readonly asking = computed(
    () => this.prompt?.asking() === true && this.ads.consentSettled()
  );
  public readonly granted = computed(() => this.prompt?.choice() === 'granted');

  public decide(granted: boolean): void {
    this.prompt?.decide(granted ? 'granted' : 'denied');
  }
}
