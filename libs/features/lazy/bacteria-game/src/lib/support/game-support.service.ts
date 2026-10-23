import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { GAME_SUPPORT } from './game-support';
import { PlayBillingService, TipProduct } from './play-billing.service';
import { isTwaSession } from './twa-session';

/** What happened to the last tip, for a line under the tip buttons. */
export type TipNotice = 'thanks' | 'failed' | null;

export const PRODUCT_LOAD_ATTEMPTS = 3;
export const PRODUCT_LOAD_RETRY_MS = 2000;

export function buyMeACoffeeUrl(handle: string): string {
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
  private readonly document = inject(DOCUMENT);

  private readonly where = signal<'web' | 'app' | null>(null);
  private readonly products = signal<readonly TipProduct[]>([]);
  private readonly buying = signal<string | null>(null);
  private readonly lastTip = signal<TipNotice>(null);

  /** The Buy Me a Coffee page, null in the app or without a handle. */
  public readonly url = computed(() => {
    const handle = this.options?.buyMeACoffeeHandle;
    return this.where() === 'web' && handle ? buyMeACoffeeUrl(handle) : null;
  });
  /** The tips the Play Store sells, empty outside the app. */
  public readonly tipProducts = this.products.asReadonly();
  public readonly available = computed(
    () => this.url() !== null || this.products().length > 0
  );
  /** The tip whose purchase is open, null while none is. */
  public readonly busyTip = this.buying.asReadonly();
  public readonly tipNotice = this.lastTip.asReadonly();

  public constructor() {
    if (!this.options) return;
    afterNextRender(() => {
      const app = isTwaSession(this.document);
      this.where.set(app ? 'app' : 'web');
      if (app) void this.loadProducts();
    });
  }

  public async tip(productId: string): Promise<void> {
    if (this.buying()) return;
    this.buying.set(productId);
    this.lastTip.set(null);
    try {
      const outcome = await this.billing.buy(productId);
      if (outcome === 'purchased') this.lastTip.set('thanks');
    } catch {
      this.lastTip.set('failed');
    } finally {
      this.buying.set(null);
    }
  }

  private async loadProducts(): Promise<void> {
    const ids = this.options?.playTipProductIds ?? [];
    if (ids.length === 0) return;
    void this.billing.consumePending(ids);
    // Right after the start the app's billing bridge may not be bound yet.
    for (let attempt = 1; ; attempt++) {
      const products = await this.billing.loadProducts(ids);
      if (products) {
        this.products.set(products);
        return;
      }
      if (attempt === PRODUCT_LOAD_ATTEMPTS) return;
      await new Promise((done) =>
        setTimeout(done, PRODUCT_LOAD_RETRY_MS * attempt)
      );
    }
  }
}
