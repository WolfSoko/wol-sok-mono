import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

export const PLAY_BILLING_METHOD = 'https://play.google.com/billing';

/** A tip product as the Play Store sells it in the player's country. */
export interface TipProduct {
  readonly id: string;
  readonly title: string;
  readonly price: string;
}

export type TipOutcome = 'purchased' | 'cancelled';

interface DigitalGoodsItem {
  readonly itemId: string;
  readonly title: string;
  readonly price: { readonly currency: string; readonly value: string };
}

interface DigitalGoodsPurchase {
  readonly itemId: string;
  readonly purchaseToken: string;
}

/** The part of the Digital Goods API the app's billing bridge answers. */
export interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<DigitalGoodsItem[]>;
  listPurchases(): Promise<DigitalGoodsPurchase[]>;
  consume(purchaseToken: string): Promise<void>;
}

export type DigitalGoodsWindow = Window & {
  getDigitalGoodsService?: (method: string) => Promise<DigitalGoodsService>;
};

/**
 * Tips inside the Play Store app, sold as consumable Play products through
 * the Digital Goods API and Payment Request.
 *
 * A tip unlocks nothing, so no server checks the purchase: consuming it
 * acknowledges it (Play refunds a purchase nobody acknowledged after three
 * days) and makes the product buyable again.
 */
@Injectable({ providedIn: 'root' })
export class PlayBillingService {
  private readonly window = inject(DOCUMENT)
    .defaultView as DigitalGoodsWindow | null;
  private service: Promise<DigitalGoodsService | null> | null = null;

  /** The products in the given order, or null without Play Billing. */
  public async loadProducts(
    ids: readonly string[]
  ): Promise<TipProduct[] | null> {
    const service = await this.digitalGoods();
    if (!service) return null;
    try {
      const items = await service.getDetails([...ids]);
      const byId = new Map(items.map((item) => [item.itemId, item]));
      return ids.flatMap((id) => {
        const item = byId.get(id);
        return item
          ? [{ id, title: item.title, price: formatPrice(item.price) }]
          : [];
      });
    } catch {
      return null;
    }
  }

  public async buy(productId: string): Promise<TipOutcome> {
    const service = await this.digitalGoods();
    if (!service || typeof PaymentRequest === 'undefined') {
      throw new Error('Play Billing is not available');
    }
    const request = new PaymentRequest(
      [{ supportedMethods: PLAY_BILLING_METHOD, data: { sku: productId } }],
      { total: { label: 'Total', amount: { currency: 'EUR', value: '0' } } }
    );
    let response: PaymentResponse;
    try {
      response = await request.show();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      throw err;
    }
    const purchaseToken = (
      response.details as { purchaseToken?: unknown } | undefined
    )?.purchaseToken;
    // The player has paid by now, so a failed consume is no failure to
    // them: `consumePending` on the next start acknowledges the purchase,
    // well inside Play's three days.
    if (typeof purchaseToken === 'string' && purchaseToken) {
      await service.consume(purchaseToken).catch(() => undefined);
    }
    await response.complete('success').catch(() => undefined);
    return 'purchased';
  }

  /**
   * Consumes the tips an app closed too early left unconsumed, so Play
   * neither refunds them nor refuses to sell the same tip again. Other
   * products are left alone.
   */
  public async consumePending(tipProductIds: readonly string[]): Promise<void> {
    const service = await this.digitalGoods();
    if (!service) return;
    try {
      const purchases = await service.listPurchases();
      await Promise.allSettled(
        purchases
          .filter((purchase) => tipProductIds.includes(purchase.itemId))
          .map((purchase) => service.consume(purchase.purchaseToken))
      );
    } catch {
      // Tried again on the next start.
    }
  }

  private digitalGoods(): Promise<DigitalGoodsService | null> {
    const pending = (this.service ??= this.connect());
    // A failed connect - the app's bridge not bound yet - is tried again on
    // the next call rather than turning billing off for the session.
    void pending.then((service) => {
      if (!service && this.service === pending) this.service = null;
    });
    return pending;
  }

  private async connect(): Promise<DigitalGoodsService | null> {
    const connect = this.window?.getDigitalGoodsService;
    if (typeof connect !== 'function') return null;
    try {
      return await connect.call(this.window, PLAY_BILLING_METHOD);
    } catch {
      return null;
    }
  }
}

function formatPrice(price: DigitalGoodsItem['price']): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: price.currency,
    }).format(Number(price.value));
  } catch {
    return `${price.value} ${price.currency}`;
  }
}
