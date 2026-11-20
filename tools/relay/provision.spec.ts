import { describe, expect, it, jest } from '@jest/globals';
import type { CloudflareApi } from './cloudflare-api';
import {
  ensureTurnKey,
  ensureSpendAlert,
  type Secrets,
  TURN_KEY_NAME,
} from './provision';

/** An account's TURN keys and alerts at a fake Cloudflare. */
function fakeCloudflare(keys: { uid: string; name: string }[] = []) {
  const policies: Record<string, unknown>[] = [];
  let made = 0;
  const api = {
    turnKeys: jest.fn(async () => [...keys]),
    createTurnKey: jest.fn(async (_account: string, name: string) => {
      const uid = `new${++made}`;
      keys.push({ uid, name });
      return { uid, secret: `secret-${uid}` };
    }),
    deleteTurnKey: jest.fn(async (_account: string, uid: string) => {
      keys.splice(
        keys.findIndex((key) => key.uid === uid),
        1
      );
    }),
    policies: jest.fn(async () =>
      policies.map((p, i) => ({ id: `p${i}`, ...p }))
    ),
    createPolicy: jest.fn(async (_account: string, policy: object) => {
      policies.push({ ...policy });
    }),
    updatePolicy: jest.fn(),
    deletePolicy: jest.fn(),
  };
  return { api, keys, asApi: api as unknown as CloudflareApi };
}

function fakeSecrets(stored: Record<string, string> = {}): Secrets & {
  stored: Record<string, string>;
} {
  return {
    stored,
    read: async (name) => stored[name] ?? null,
    write: async (name, value) => {
      stored[name] = value;
    },
  };
}

const log = () => undefined;

describe('ensureTurnKey', () => {
  it('creates the key and stores it, then changes nothing on a second run', async () => {
    const cloudflare = fakeCloudflare();
    const secrets = fakeSecrets();

    await ensureTurnKey(cloudflare.asApi, secrets, 'acc', log);
    await ensureTurnKey(cloudflare.asApi, secrets, 'acc', log);

    expect(cloudflare.api.createTurnKey).toHaveBeenCalledTimes(1);
    expect(JSON.parse(secrets.stored['CLOUDFLARE_TURN_KEY'] ?? '')).toEqual({
      id: 'new1',
      token: 'secret-new1',
    });
    expect(cloudflare.keys).toEqual([{ uid: 'new1', name: TURN_KEY_NAME }]);
  });

  it('replaces a key whose secret nobody holds, keeping the old one until --prune', async () => {
    const cloudflare = fakeCloudflare([{ uid: 'old', name: TURN_KEY_NAME }]);
    const secrets = fakeSecrets();

    await ensureTurnKey(cloudflare.asApi, secrets, 'acc', log);
    // The deployed function may still run on the old key's version.
    expect(cloudflare.keys.map(({ uid }) => uid)).toEqual(['old', 'new1']);

    await ensureTurnKey(cloudflare.asApi, secrets, 'acc', log, true);
    expect(cloudflare.keys.map(({ uid }) => uid)).toEqual(['new1']);
    expect(cloudflare.api.createTurnKey).toHaveBeenCalledTimes(1);
  });

  it('replaces a stored key the functions could not use, a token missing', async () => {
    const cloudflare = fakeCloudflare([{ uid: 'k1', name: TURN_KEY_NAME }]);
    const secrets = fakeSecrets({ CLOUDFLARE_TURN_KEY: '{"id":"k1"}' });

    await ensureTurnKey(cloudflare.asApi, secrets, 'acc', log);

    expect(cloudflare.api.createTurnKey).toHaveBeenCalledTimes(1);
  });

  it('stores nothing for a key created without its secret', async () => {
    const cloudflare = fakeCloudflare();
    cloudflare.api.createTurnKey.mockResolvedValueOnce({
      uid: 'k1',
      secret: '',
    });
    const secrets = fakeSecrets();

    await expect(
      ensureTurnKey(cloudflare.asApi, secrets, 'acc', log)
    ).rejects.toThrow('Cloudflare created TURN key k1 without its secret.');
    expect(secrets.stored).toEqual({});
  });
});

describe('ensureSpendAlert', () => {
  it("creates the $1 spend alert once, beside the account's own", async () => {
    const cloudflare = fakeCloudflare();

    await ensureSpendAlert(cloudflare.asApi, 'acc', 'm@example.org', log);
    await ensureSpendAlert(cloudflare.asApi, 'acc', 'm@example.org', log);

    expect(cloudflare.api.createPolicy).toHaveBeenCalledTimes(1);
    expect(cloudflare.api.createPolicy).toHaveBeenCalledWith('acc', {
      name: 'bacteria-wars-spend',
      alert_type: 'billing_budget_alert',
      enabled: true,
      filters: { total_spend_dollars: ['1'] },
      mechanisms: { email: [{ id: 'm@example.org' }] },
    });
    expect(cloudflare.api.updatePolicy).not.toHaveBeenCalled();
  });
});
