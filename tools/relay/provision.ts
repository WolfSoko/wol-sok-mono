import type { AvailableAlert, CloudflareApi } from './cloudflare-api';
import { planTurnKey } from './plan-turn-key';
import { type AlertPolicy, planUsageAlert } from './plan-usage-alert';

/** The secret with the account API token, the one manual input (ADR 0020). */
export const ACCOUNT_TOKEN_SECRET = 'CLOUDFLARE_API_TOKEN';
/** The secret `refreshRelay` reads: `{ id, token }` of the TURN key. */
export const TURN_KEY_SECRET = 'CLOUDFLARE_TURN_KEY';
/** The TURN key's name at Cloudflare, which finds it again. */
export const TURN_KEY_NAME = 'bacteria-wars-online';
/** The usage alert's name at Cloudflare, which finds it again. */
export const USAGE_ALERT_NAME = 'bacteria-wars-turn-usage';
/**
 * The monthly TURN traffic the alert fires above, in GB: a tenth of the
 * free allowance, some 16,000 matches of 6 MB.
 */
export const RELAY_ALERT_GB = 100;
/** Cloudflare's alert type for a product's usage above a limit. */
const USAGE_ALERT_TYPE = 'billing_usage_alert';
/** What names the Realtime TURN product among the alert's filter options. */
const TURN_PRODUCT = /realtime|calls|turn/i;

/** Reads and writes the relay's secrets - `FirebaseSecrets` outside specs. */
export interface Secrets {
  read(name: string): Promise<string | null>;
  write(name: string, value: string): Promise<void>;
}

/** Where `turn-key` reports what it did. */
export type Log = (line: string) => void;

/** The one account the token reaches, or the one `wanted` names. */
export async function accountOf(
  api: CloudflareApi,
  wanted: string | null
): Promise<string> {
  const accounts = await api.accounts();
  if (wanted !== null) {
    if (!accounts.some(({ id }) => id === wanted)) {
      throw new Error(`The token reaches no account ${wanted}.`);
    }
    return wanted;
  }
  if (accounts.length !== 1) {
    throw new Error(
      `The token reaches ${accounts.length} accounts; pick one with --account-id=<id>.`
    );
  }
  return accounts[0]?.id ?? '';
}

/** The uid the stored TURN key secret names - null for none, or one unreadable. */
async function storedUid(secrets: Secrets): Promise<string | null> {
  const value = await secrets.read(TURN_KEY_SECRET);
  try {
    const id: unknown = value === null ? null : JSON.parse(value).id;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

/**
 * The TURN key in place and named by `CLOUDFLARE_TURN_KEY`: nothing to do
 * when it is, else a new key whose secret goes straight into the secret,
 * then the stale keys of the name removed.
 */
export async function ensureTurnKey(
  api: CloudflareApi,
  secrets: Secrets,
  account: string,
  log: Log
): Promise<void> {
  const plan = planTurnKey(
    await api.turnKeys(account),
    await storedUid(secrets),
    TURN_KEY_NAME
  );
  if (plan.action === 'keep') {
    log(`TURN key ${plan.uid}: keep`);
  } else {
    const created = await api.createTurnKey(account, TURN_KEY_NAME);
    await secrets.write(
      TURN_KEY_SECRET,
      JSON.stringify({ id: created.uid, token: created.secret })
    );
    log(`TURN key ${created.uid}: created, stored in ${TURN_KEY_SECRET}`);
  }
  for (const uid of plan.remove) {
    await api.deleteTurnKey(account, uid);
    log(`TURN key ${uid}: removed`);
  }
}

/** Every string in `value`, however deep. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
}

/**
 * The usage alert as `turn-key` wants it, its product read from what
 * Cloudflare offers the account - throws, with the offer, when there is no
 * usage alert or no TURN product in it (Cloudflare has them on
 * Pay-as-you-go accounts only).
 */
export function usageAlertPolicy(
  available: Record<string, AvailableAlert[]>,
  email: string
): AlertPolicy {
  const usage = Object.values(available)
    .flat()
    .find(({ type }) => type === USAGE_ALERT_TYPE);
  const products = [
    ...new Set(
      stringsIn(usage?.filter_options).filter((s) => TURN_PRODUCT.test(s))
    ),
  ];
  if (usage === undefined || products.length !== 1) {
    throw new Error(
      `No single TURN product for a ${USAGE_ALERT_TYPE} on this account: ${JSON.stringify(usage ?? null)}`
    );
  }
  return {
    name: USAGE_ALERT_NAME,
    alert_type: USAGE_ALERT_TYPE,
    enabled: true,
    filters: { product: products, limit: [String(RELAY_ALERT_GB)] },
    mechanisms: { email: [{ id: email }] },
  };
}

/** The usage alert in place as {@link usageAlertPolicy} wants it. */
export async function ensureUsageAlert(
  api: CloudflareApi,
  account: string,
  email: string,
  log: Log
): Promise<void> {
  const wanted = usageAlertPolicy(await api.availableAlerts(account), email);
  const plan = planUsageAlert(await api.policies(account), wanted);
  if (plan.action === 'create') {
    await api.createPolicy(account, wanted);
  } else if (plan.action === 'update') {
    await api.updatePolicy(account, plan.id, wanted);
  }
  log(`Usage alert ${USAGE_ALERT_NAME}: ${plan.action}`);
  for (const id of plan.remove) {
    await api.deletePolicy(account, id);
    log(`Usage alert ${id}: removed`);
  }
}
