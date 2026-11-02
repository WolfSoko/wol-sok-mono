import { parseAdminStats, snapshotHour } from './admin-stats';

describe('admin statistics', () => {
  it('reads what it can, a missing figure as 0', () => {
    const stats = parseAdminStats({
      accounts: 12,
      online: 'many',
      entries: { xp: 3, broken: 'x' },
      today: { verifyMs: 4000 },
      at: { toMillis: () => 1000 },
    });
    expect(stats).toMatchObject({
      accounts: 12,
      online: 0,
      bans: 0,
      entries: { xp: 3 },
      today: { verifyMs: 4000 },
      at: 1000,
    });
    expect(parseAdminStats(undefined)).toBeNull();
    expect(parseAdminStats({})?.at).toBeNull();
  });

  it('reads the hour of a snapshot id', () => {
    expect(snapshotHour('h_2026102512')).toBe(Date.UTC(2026, 9, 25, 12));
    expect(snapshotHour('now')).toBeNull();
    expect(snapshotHour('h_20261025')).toBeNull();
  });
});
