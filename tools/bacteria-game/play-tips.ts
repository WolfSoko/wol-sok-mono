/**
 * The tips the Bacteria Wars app sells, as consumable one-time products on
 * Google Play: store/tips.json holds each one's id, net EUR base price and
 * title and description per listing language. The deploy creates or
 * updates them right after the bundle is on Play, since Play accepts
 * in-app products only for an app whose bundle asks for billing.
 *
 * The one-time products API is not edit-based: every product is its own
 * upsert, priced per region by `pricing:convertRegionPrices`. The game
 * reads titles and prices back from Play, by the ids in
 * apps/bacteria-game-remote/src/environments/game-support.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** What store/tips.json holds for one tip. */
export interface Tip {
  id: string;
  /** Net of tax, such as "2.52": Play adds each region's tax. */
  basePriceEur: string;
  listings: Record<string, { title: string; description: string }>;
}

interface Money {
  currencyCode: string;
  units?: string;
  nanos?: number;
}

interface ConvertedPrices {
  convertedRegionPrices?: Record<string, { regionCode: string; price: Money }>;
  convertedOtherRegionsPrice?: { eurPrice?: Money; usdPrice?: Money };
  regionVersion?: { version?: string };
}

interface OneTimeProduct {
  purchaseOptions?: { purchaseOptionId: string; state?: string }[];
}

/** Fetches from the Play Developer API, throwing on an error status. */
export type TipsCall = <T>(
  url: string,
  init?: { method?: string; body?: string }
) => Promise<T>;

/** The one way to buy a tip: once, never rented. */
const PURCHASE_OPTION_ID = 'buy';
/** Play's limits on a one-time product's listing, in characters. */
const LIMITS = { title: 55, description: 200 };
/** As Play takes product ids. */
const ID_PATTERN = /^[a-z0-9][a-z0-9_.]{0,39}$/;
const PRICE_PATTERN = /^\d+\.\d{2}$/;

/** The tips of store/tips.json, checked against Play's rules and `languages`. */
export function storeTips(storeDir: string, languages: string[]): Tip[] {
  const { products } = JSON.parse(
    readFileSync(join(storeDir, 'tips.json'), 'utf8')
  ) as { products: Tip[] };
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const tip of products) {
    if (!ID_PATTERN.test(tip.id) || seen.has(tip.id)) {
      errors.push(`${tip.id}: not a new Play product id`);
    }
    seen.add(tip.id);
    if (!PRICE_PATTERN.test(tip.basePriceEur)) {
      errors.push(`${tip.id}: basePriceEur must look like "2.52"`);
    }
    const tipLanguages = Object.keys(tip.listings).sort();
    if (tipLanguages.join() !== [...languages].sort().join()) {
      errors.push(
        `${tip.id}: needs a listing for each of ${languages.join(', ')}`
      );
    }
    for (const [language, listing] of Object.entries(tip.listings)) {
      for (const [field, limit] of Object.entries(LIMITS)) {
        const length = listing[field as keyof typeof LIMITS].length;
        if (length === 0 || length > limit) {
          errors.push(`${tip.id} ${language} ${field}: ${length}/${limit}`);
        }
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`store/tips.json:\n${errors.join('\n')}`);
  }
  return products;
}

/** Creates or updates every tip and makes sure it can be bought. */
export async function publishTips(
  call: TipsCall,
  appUrl: string,
  packageName: string,
  tips: Tip[]
): Promise<void> {
  for (const tip of tips) {
    const [units, cents] = tip.basePriceEur.split('.');
    const converted = await call<ConvertedPrices>(
      `${appUrl}/pricing:convertRegionPrices`,
      {
        method: 'POST',
        body: JSON.stringify({
          price: {
            currencyCode: 'EUR',
            units,
            nanos: Number(cents.padEnd(9, '0')),
          },
        }),
      }
    );
    const regionsVersion = converted.regionVersion?.version;
    if (!regionsVersion) {
      throw new Error(`${tip.id}: Play returned no regions version`);
    }
    // The API's own spelling: lower case here, camel case for the states.
    const productUrl = `${appUrl}/onetimeproducts/${tip.id}`;
    const existing = await call<OneTimeProduct>(productUrl).catch(
      (error: unknown) => {
        if (String(error).includes(' 404 ')) return null;
        throw error;
      }
    );
    const query = new URLSearchParams({
      allowMissing: 'true',
      'regionsVersion.version': regionsVersion,
      updateMask: 'listings,purchaseOptions',
    });
    await call(`${productUrl}?${query}`, {
      method: 'PATCH',
      body: JSON.stringify(oneTimeProduct(tip, converted, packageName)),
    });
    const active = existing?.purchaseOptions?.some(
      (option) =>
        option.purchaseOptionId === PURCHASE_OPTION_ID &&
        option.state === 'ACTIVE'
    );
    if (!active) {
      await call(
        `${appUrl}/oneTimeProducts/${tip.id}/purchaseOptions:batchUpdateStates`,
        {
          method: 'POST',
          body: JSON.stringify({
            requests: [
              {
                activatePurchaseOptionRequest: {
                  packageName,
                  productId: tip.id,
                  purchaseOptionId: PURCHASE_OPTION_ID,
                },
              },
            ],
          }),
        }
      );
    }
    console.log(
      `${existing ? 'Updated' : 'Created'} the tip ${tip.id}, ${tip.basePriceEur} EUR net.`
    );
  }
}

function oneTimeProduct(
  tip: Tip,
  converted: ConvertedPrices,
  packageName: string
): object {
  const other = converted.convertedOtherRegionsPrice ?? {};
  return {
    packageName,
    productId: tip.id,
    listings: Object.entries(tip.listings).map(([languageCode, listing]) => ({
      languageCode,
      ...listing,
    })),
    purchaseOptions: [
      {
        purchaseOptionId: PURCHASE_OPTION_ID,
        // The app's billing bridge predates one-time products with options.
        buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
        regionalPricingAndAvailabilityConfigs: Object.values(
          converted.convertedRegionPrices ?? {}
        ).map(({ regionCode, price }) => ({
          regionCode,
          price,
          availability: 'AVAILABLE',
        })),
        newRegionsConfig: {
          availability: 'AVAILABLE',
          eurPrice: other.eurPrice,
          usdPrice: other.usdPrice,
        },
      },
    ],
  };
}
