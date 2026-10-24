import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEngine } from '../engine';
import { BIG_MAP_COST, GPU_INT_COST, rerunCost } from '../replays/budgets';
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
    const cpu = engine.REPLAY_VERSION;
    expect(rerunCost(engine, 'quarantine', 600, cpu)).toBe(600);
    expect(rerunCost(engine, 'expanse', 600, cpu)).toBe(600 * BIG_MAP_COST);
    expect(rerunCost(engine, engine.dailyLevelId('2026-10-24'), 600, cpu)).toBe(
      600
    );
  });

  it('charges a gpu-int replay (version 5) more than its ticks', async () => {
    const engine = await loadEngine();
    const gpuInt = engine.GPU_INT_REPLAY_VERSION;
    const daily = engine.dailyLevelId('2026-10-24');
    expect(rerunCost(engine, daily, 600, gpuInt)).toBe(600 * GPU_INT_COST);
    expect(rerunCost(engine, daily, 121, gpuInt)).toBe(
      Math.ceil(121 * GPU_INT_COST)
    );
    expect(rerunCost(engine, 'expanse', 600, gpuInt)).toBe(
      600 * BIG_MAP_COST * GPU_INT_COST
    );
    // The evolved CPU formats stay at their ticks.
    expect(rerunCost(engine, daily, 600, engine.LADDER_REPLAY_VERSION)).toBe(
      600
    );
  });
});
