import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { injectGameAnalytics } from '../analytics/game-analytics';
import { beforeRetry } from '../storage/retry';
import { GAME_SUPPORT } from './game-support';
import { PlayBillingService, TipProduct } from './play-billing.service';
import { isTwaSession } from './twa-session';

/** What happened to the last tip, for a line under the tip buttons. */
export type TipNotice = 'thanks' | 'failed' | null;

const PRODUCT_LOAD_ATTEMPTS = 3;

function buyMeACoffeeUrl(handle: string): string {
  return `https://buymeacoffee.com/${encodeURIComponent(handle)}`;
}

/**
 * How a player can pay for the game where they play it: the Buy Me a
 * Coffee page on the web, the Play tip products inside the Play Store app,
 * which allows tips only through Play Billing - or nothing, inside the
 * shell. Decided after the first render, when the referrer tells the app
 * from the web.
 */
@Injectable({ providedIn: 'root' })
export class GameSupport {
  private readonly options = inject(GAME_SUPPORT);
  private readonly billing = inject(PlayBillingService);
  private readonly analytics = injectGameAnalytics();
  private readonly document = inject(DOCUMENT);

  private readonly onWeb = signal(false);
  private readonly products = signal<readonly TipProduct[]>([]);
  private readonly buying = signal(false);
  private readonly lastTip = signal<TipNotice>(null);

  /** The Buy Me a Coffee page, null in the app or without a handle. */
  public readonly url = computed(() => {
    const handle = this.options?.buyMeACoffeeHandle;
    return this.onWeb() && handle ? buyMeACoffeeUrl(handle) : null;
  });
  /** The tips the Play Store sells, empty outside the app. */
  public readonly tipProducts = this.products.asReadonly();
  public readonly available = computed(
    () => this.url() !== null || this.products().length > 0
  );
  /** True while a tip's purchase is open. */
  public readonly tipBusy = this.buying.asReadonly();
  public readonly tipNotice = this.lastTip.asReadonly();

  public constructor() {
    const options = this.options;
    if (!options) return;
    afterNextRender(() => {
      if (isTwaSession(this.document, options.androidPackage)) {
        void this.loadProducts();
      } else {
        this.onWeb.set(true);
      }
    });
  }

  public async tip(productId: string): Promise<void> {
    if (this.buying()) return;
    this.buying.set(true);
    this.lastTip.set(null);
    try {
      const outcome = await this.billing.buy(productId);
      if (outcome === 'purchased') this.lastTip.set('thanks');
      this.analytics.track('tip', { product_id: productId, outcome });
    } catch {
      this.lastTip.set('failed');
      this.analytics.track('tip', { product_id: productId, outcome: 'failed' });
    } finally {
      this.buying.set(false);
    }
  }

  private async loadProducts(): Promise<void> {
    const ids = this.options?.playTipProductIds ?? [];
    if (ids.length === 0) return;
    // Right after the start the app's billing bridge may not be bound yet.
    for (let attempt = 1; ; attempt++) {
      const products = await this.billing.loadProducts(ids);
      if (products) {
        this.products.set(products);
        // Now that billing answers, tips a closed app left unconsumed.
        await this.billing.consumePending(ids);
        return;
      }
      if (attempt === PRODUCT_LOAD_ATTEMPTS) return;
      await beforeRetry(attempt);
    }
  }
}
