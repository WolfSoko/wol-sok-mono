import { crumbleShape } from './crumble-shape';

describe('crumbleShape', () => {
  it('should not crack dust', () => {
    expect(crumbleShape('dust', 0.5)).toEqual({
      coarseCrack: 0,
      fineCrack: 0,
      shardGrow: 0,
    });
  });

  it('should widen the cracks while the element decays', () => {
    expect(crumbleShape('cracks', 0.1).coarseCrack).toBeLessThan(
      crumbleShape('cracks', 0.5).coarseCrack
    );
  });

  it('should add fine cracks later', () => {
    expect(crumbleShape('cracks', 0.05).fineCrack).toBe(0);
    expect(crumbleShape('cracks', 0.5).fineCrack).toBeGreaterThan(0);
  });

  it('should only move shards', () => {
    expect(crumbleShape('cracks', 0.5).shardGrow).toBe(0);
    expect(crumbleShape('chunks', 0.5).shardGrow).toBe(0);
    expect(crumbleShape('shards', 0.5).shardGrow).toBeGreaterThan(0);
  });

  it('should keep chunk cracks thin and without fine cracks', () => {
    expect(crumbleShape('chunks', 0.9).coarseCrack).toBeLessThan(
      crumbleShape('shards', 0.9).coarseCrack
    );
    expect(crumbleShape('chunks', 0.9).fineCrack).toBe(0);
  });
});
