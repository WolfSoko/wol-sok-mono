import { describe, expect, it } from '@jest/globals';
import { type AlertPolicy, planSpendAlert } from './plan-spend-alert';

const wanted: AlertPolicy = {
  name: 'bacteria-wars-spend',
  alert_type: 'billing_budget_alert',
  enabled: true,
  filters: { total_spend_dollars: ['1'] },
  mechanisms: { email: [{ id: 'privacy@example.org' }] },
};

describe('planSpendAlert', () => {
  it('creates the alert when there is none of its name', () => {
    expect(
      planSpendAlert(
        [{ ...wanted, id: 'p1', name: 'Default budget alert (auto-created)' }],
        wanted
      )
    ).toEqual({ action: 'create', remove: [] });
  });

  it('keeps the alert as it is', () => {
    expect(planSpendAlert([{ ...wanted, id: 'p1' }], wanted)).toEqual({
      action: 'keep',
      id: 'p1',
      remove: [],
    });
  });

  it('keeps it whatever else Cloudflare adds to a policy', () => {
    expect(
      planSpendAlert(
        [
          {
            ...wanted,
            id: 'p1',
            created: 'then',
            description: '',
            filters: { ...wanted.filters, zones: [] },
            mechanisms: {
              // Cloudflare lists an address with more than its id.
              email: [
                Object.assign({ id: 'privacy@example.org' }, { name: 'Owner' }),
              ],
            },
          },
        ],
        wanted
      )
    ).toEqual({ action: 'keep', id: 'p1', remove: [] });
  });

  it.each([
    ['a different limit', { filters: { total_spend_dollars: ['5'] } }],
    ['switched off', { enabled: false }],
    ['another address', { mechanisms: { email: [{ id: 'old@example.org' }] } }],
  ])('updates one with %s', (_case, change) => {
    expect(
      planSpendAlert([{ ...wanted, ...change, id: 'p1' }], wanted)
    ).toEqual({ action: 'update', id: 'p1', remove: [] });
  });

  it('removes the other alerts of its name', () => {
    expect(
      planSpendAlert(
        [
          { ...wanted, id: 'p1' },
          { ...wanted, id: 'p2' },
        ],
        wanted
      )
    ).toEqual({ action: 'keep', id: 'p1', remove: ['p2'] });
  });
});
