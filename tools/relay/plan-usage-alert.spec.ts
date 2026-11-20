import { describe, expect, it } from '@jest/globals';
import { planUsageAlert, type AlertPolicy } from './plan-usage-alert';

const wanted: AlertPolicy = {
  name: 'bacteria-wars-turn-usage',
  alert_type: 'billing_usage_alert',
  enabled: true,
  filters: { product: ['realtime_turn'], limit: ['100'] },
  mechanisms: { email: [{ id: 'privacy@example.org' }] },
};

describe('planUsageAlert', () => {
  it('creates the alert when there is none of its name', () => {
    expect(
      planUsageAlert([{ ...wanted, id: 'p1', name: 'other' }], wanted)
    ).toEqual({ action: 'create', remove: [] });
  });

  it('keeps the alert as it is', () => {
    expect(planUsageAlert([{ ...wanted, id: 'p1' }], wanted)).toEqual({
      action: 'keep',
      id: 'p1',
      remove: [],
    });
  });

  it('keeps it whatever else Cloudflare adds to a policy', () => {
    expect(
      planUsageAlert(
        [{ ...wanted, id: 'p1', created: 'then', description: '' }],
        wanted
      )
    ).toEqual({ action: 'keep', id: 'p1', remove: [] });
  });

  it.each([
    [
      'a different limit',
      { filters: { product: ['realtime_turn'], limit: ['5'] } },
    ],
    ['switched off', { enabled: false }],
    ['another address', { mechanisms: { email: [{ id: 'old@example.org' }] } }],
  ])('updates one with %s', (_case, change) => {
    expect(
      planUsageAlert([{ ...wanted, ...change, id: 'p1' }], wanted)
    ).toEqual({ action: 'update', id: 'p1', remove: [] });
  });

  it('removes the other alerts of its name', () => {
    expect(
      planUsageAlert(
        [
          { ...wanted, id: 'p1' },
          { ...wanted, id: 'p2' },
        ],
        wanted
      )
    ).toEqual({ action: 'keep', id: 'p1', remove: ['p2'] });
  });
});
