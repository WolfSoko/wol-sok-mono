import { parseTurnKey } from '@wolsok/feat-shared-bacteria-engine/cloud';
import type { CloudflareApi } from './cloudflare-api';
import { planTurnKey } from './plan-turn-key';
import { type AlertPolicy, planSpendAlert } from './plan-spend-alert';

/** The secret with the account API token, the one manual input (ADR 0020). */
export const ACCOUNT_TOKEN_SECRET = 'CLOUDFLARE_API_TOKEN';
/** The secret `refreshRelay` reads: `{ id, token }` of the TURN key. */
export const TURN_KEY_SECRET = 'CLOUDFLARE_TURN_KEY';
/**
 * The Cloudflare account that owns the TURN key and the spend alert (the
 * owner's answer of 2026-11-20). Not a secret: the dashboard's URLs carry
 * it. The token has no right to list its accounts, so it is named here.
 */
export const CLOUDFLARE_ACCOUNT_ID = 'e68356c95bef5b09867db4a32fd76662';
/** The TURN key's name at Cloudflare, which finds it again. */
export const TURN_KEY_NAME = 'bacteria-wars-online';
/** The spend alert's name at Cloudflare, which finds it again. */
export const SPEND_ALERT_NAME = 'bacteria-wars-spend';
/**
 * The account's spend the alert fires at, in dollars (the manager's answer
 * of 2026-11-20 on request 1448): Cloudflare offers no usage alert for
 * Realtime TURN, and TURN is free up to its monthly allowance, so the first
 * paid dollar - from any product, TURN included - is the sign of misuse.
 */
export const SPEND_ALERT_DOLLARS = 1;
/** Cloudflare's alert type for the account's spend above a limit. */
const SPEND_ALERT_TYPE = 'billing_budget_alert';

/** Reads and writes the relay's secrets - `FirebaseSecrets` outside specs. */
export interface Secrets {
  read(name: string): Promise<string | null>;
  write(name: string, value: string): Promise<void>;
}

/** Where `turn-key` reports what it did. */
export type Log = (line: string) => void;

/**
 * The uid the stored TURN key secret names - null for none, or one
 * `refreshRelay` could not use either (no id or no token).
 */
async function storedUid(secrets: Secrets): Promise<string | null> {
  const value = await secrets.read(TURN_KEY_SECRET);
  try {
    return value === null ? null : parseTurnKey(value).id;
  } catch {
    return null;
  }
}

/**
 * The TURN key in place and named by `CLOUDFLARE_TURN_KEY`: nothing to do
 * when it is, else a new key whose secret goes straight into the secret.
 * Older keys of the name are removed only with `prune`: the deployed
 * `refreshRelay` keeps the secret's version it was deployed with, so an
 * old key stays in use until the functions are deployed again.
 */
export async function ensureTurnKey(
  api: CloudflareApi,
  secrets: Secrets,
  account: string,
  log: Log,
  prune = false
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
    if (typeof created.secret !== 'string' || created.secret === '') {
      throw new Error(
        `Cloudflare created TURN key ${created.uid} without its secret.`
      );
    }
    await secrets.write(
      TURN_KEY_SECRET,
      JSON.stringify({ id: created.uid, token: created.secret })
    );
    log(
      `TURN key ${created.uid}: created, stored in ${TURN_KEY_SECRET} - deploy bacteria-wars-functions to use it`
    );
  }
  for (const uid of plan.remove) {
    if (prune) {
      await api.deleteTurnKey(account, uid);
      log(`TURN key ${uid}: removed`);
    } else {
      log(
        `TURN key ${uid}: kept - remove it with --prune once the functions run on ${TURN_KEY_SECRET}'s latest version`
      );
    }
  }
}

/** The spend alert as `turn-key` wants it, emailed to `email`. */
export function spendAlertPolicy(email: string): AlertPolicy {
  return {
    name: SPEND_ALERT_NAME,
    alert_type: SPEND_ALERT_TYPE,
    enabled: true,
    filters: { total_spend_dollars: [String(SPEND_ALERT_DOLLARS)] },
    mechanisms: { email: [{ id: email }] },
  };
}

/** The spend alert in place as {@link spendAlertPolicy} wants it. */
export async function ensureSpendAlert(
  api: CloudflareApi,
  account: string,
  email: string,
  log: Log
): Promise<void> {
  const wanted = spendAlertPolicy(email);
  const plan = planSpendAlert(await api.policies(account), wanted);
  if (plan.action === 'create') {
    await api.createPolicy(account, wanted);
  } else if (plan.action === 'update') {
    await api.updatePolicy(account, plan.id, wanted);
  }
  log(`Spend alert ${SPEND_ALERT_NAME}: ${plan.action}`);
  for (const id of plan.remove) {
    await api.deletePolicy(account, id);
    log(`Spend alert ${id}: removed`);
  }
}
