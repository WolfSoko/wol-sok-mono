import { rankFor, RANKS } from './ranks';

describe('rankFor', () => {
  it('starts every player as a spore', () => {
    expect(rankFor(0)).toEqual({
      rank: RANKS[0],
      number: 1,
      next: RANKS[1],
      progress: 0,
    });
  });

  it('climbs at each threshold and measures the way to the next', () => {
    const standing = rankFor(1000);

    expect(standing.rank.name).toBe('Bacillus');
    expect(standing.number).toBe(3);
    expect(standing.next?.name).toBe('Spirillum');
    expect(standing.progress).toBeCloseTo((1000 - 750) / (1500 - 750));
    expect(rankFor(750).rank.name).toBe('Bacillus');
    expect(rankFor(749).rank.name).toBe('Coccus');
  });

  it('stops at Superbug', () => {
    expect(rankFor(1_000_000)).toEqual(
      expect.objectContaining({ next: null, progress: 1, number: RANKS.length })
    );
  });

  it('climbs strictly', () => {
    RANKS.slice(1).forEach((rank, i) =>
      expect(rank.xp).toBeGreaterThan(RANKS[i].xp)
    );
  });
});
