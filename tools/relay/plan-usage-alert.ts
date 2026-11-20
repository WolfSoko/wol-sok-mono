import { isDeepStrictEqual } from 'node:util';

/** A notification policy as Cloudflare's alerting API takes it. */
export interface AlertPolicy {
  name: string;
  alert_type: string;
  enabled: boolean;
  filters: Record<string, string[]>;
  mechanisms: { email: { id: string }[] };
}

/** A policy as Cloudflare lists it, with whatever else it adds. */
export type ListedPolicy = AlertPolicy & { id: string } & Record<
    string,
    unknown
  >;

/** What `turn-key` does about the usage alert. */
export type UsageAlertPlan =
  | { action: 'keep'; id: string; remove: string[] }
  | { action: 'update'; id: string; remove: string[] }
  | { action: 'create'; remove: string[] };

/** The addresses a policy emails, as Cloudflare lists them or as wanted. */
function emailsOf(policy: Pick<AlertPolicy, 'mechanisms'>): string[] {
  return (policy.mechanisms?.email ?? []).map(({ id }) => id).sort();
}

/**
 * Whether the usage alert is in place as `wanted`: found by its name, kept
 * when its type, switch, the filters it sets and its addresses are the
 * wanted ones, whatever else Cloudflare adds to them,
 * updated otherwise, created when there is none. Other policies of the
 * name are removed.
 */
export function planUsageAlert(
  policies: readonly ListedPolicy[],
  wanted: AlertPolicy
): UsageAlertPlan {
  const [first, ...others] = policies.filter(
    (policy) => policy.name === wanted.name
  );
  const remove = others.map((policy) => policy.id);
  if (first === undefined) {
    return { action: 'create', remove };
  }
  const same =
    first.alert_type === wanted.alert_type &&
    first.enabled === wanted.enabled &&
    Object.entries(wanted.filters).every(([key, values]) =>
      isDeepStrictEqual(first.filters?.[key], values)
    ) &&
    isDeepStrictEqual(emailsOf(first), emailsOf(wanted));
  return { action: same ? 'keep' : 'update', id: first.id, remove };
}
