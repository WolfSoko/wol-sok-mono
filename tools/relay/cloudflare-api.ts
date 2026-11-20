import type { ListedTurnKey } from './plan-turn-key';
import type { AlertPolicy, ListedPolicy } from './plan-usage-alert';

const API = 'https://api.cloudflare.com/client/v4';

/** The longest wait for one of Cloudflare's answers. */
const TIMEOUT_MS = 20_000;

/** An alert type as `available_alerts` lists it. */
export interface AvailableAlert {
  type: string;
  display_name?: string;
  filter_options?: unknown;
}

/**
 * The few calls of Cloudflare's API that `turn-key` makes, with the
 * account API token (`CLOUDFLARE_API_TOKEN`). A refusal throws with the
 * call and Cloudflare's own error messages, never with the token.
 */
export class CloudflareApi {
  public constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  public async accounts(): Promise<{ id: string; name: string }[]> {
    return this.call('GET', '/accounts');
  }

  public async turnKeys(account: string): Promise<ListedTurnKey[]> {
    return this.call('GET', `/accounts/${account}/calls/turn_keys`);
  }

  /** A new TURN key and its secret, which Cloudflare shows only now. */
  public async createTurnKey(
    account: string,
    name: string
  ): Promise<{ uid: string; secret: string }> {
    return this.call('POST', `/accounts/${account}/calls/turn_keys`, { name });
  }

  public async deleteTurnKey(account: string, uid: string): Promise<void> {
    await this.call('DELETE', `/accounts/${account}/calls/turn_keys/${uid}`);
  }

  /** Every alert type, by group, as Cloudflare offers them to the account. */
  public async availableAlerts(
    account: string
  ): Promise<Record<string, AvailableAlert[]>> {
    return this.call(
      'GET',
      `/accounts/${account}/alerting/v3/available_alerts`
    );
  }

  public async policies(account: string): Promise<ListedPolicy[]> {
    return this.call('GET', `/accounts/${account}/alerting/v3/policies`);
  }

  public async createPolicy(
    account: string,
    policy: AlertPolicy
  ): Promise<void> {
    await this.call(
      'POST',
      `/accounts/${account}/alerting/v3/policies`,
      policy
    );
  }

  public async updatePolicy(
    account: string,
    id: string,
    policy: AlertPolicy
  ): Promise<void> {
    await this.call(
      'PUT',
      `/accounts/${account}/alerting/v3/policies/${id}`,
      policy
    );
  }

  public async deletePolicy(account: string, id: string): Promise<void> {
    await this.call(
      'DELETE',
      `/accounts/${account}/alerting/v3/policies/${id}`
    );
  }

  private async call<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await this.fetchFn(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const answer = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      result?: T;
      errors?: { message?: string }[];
    };
    if (!response.ok || answer.success === false) {
      const why = (answer.errors ?? [])
        .map(({ message }) => message)
        .filter(Boolean)
        .join('; ');
      throw new Error(
        `Cloudflare ${method} ${path} answered ${response.status}${why ? `: ${why}` : ''}`
      );
    }
    return answer.result as T;
  }
}
