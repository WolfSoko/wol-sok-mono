import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEngine } from '../engine';
import { BIG_MAP_COST, rerunCost } from '../replays/budgets';
import { tombstoneKey } from './tombstones';

describe('ban tombstones', () => {
  it('key a Google identity with an HMAC of the secret', () => {
    const key = tombstoneKey('a-secret-of-32-random-bytes-here');
    const other = tombstoneKey('another-secret-of-32-random-byte');
    expect(key.idOf('google-1')).toMatch(/^[0-9a-f]{64}$/);
    expect(key.idOf('google-1')).toBe(key.idOf('google-1'));
    expect(key.idOf('google-1')).not.toBe(key.idOf('google-2'));
    expect(key.idOf('google-1')).not.toBe(other.idOf('google-1'));
    expect(key.idOf('google-1')).not.toContain('google-1');
  });

  it('refuse a missing or short secret', () => {
    expect(() => tombstoneKey('')).toThrow();
    expect(() => tombstoneKey('short')).toThrow();
  });

  it('read the key from Secret Manager, never from a literal', () => {
    const main = readFileSync(join(__dirname, '../main.ts'), 'utf8');
    expect(main).toContain("defineSecret('BAN_TOMBSTONE_KEY')");
    expect(main).toMatch(/tombstoneKey\(BAN_TOMBSTONE_KEY\.value\(\)\)/);
  });
});

describe('the verification budget', () => {
  it('charges a big map more than its ticks', async () => {
    const engine = await loadEngine();
    expect(rerunCost(engine, 'quarantine', 600)).toBe(600);
    expect(rerunCost(engine, 'expanse', 600)).toBe(600 * BIG_MAP_COST);
    expect(rerunCost(engine, engine.dailyLevelId('2026-10-24'), 600)).toBe(600);
  });
});
