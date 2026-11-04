import { rankFor, RANKS, xpClimb } from './ranks';

describe('rankFor', () => {
  it('starts every player as a spore', () => {
    expect(rankFor(0)).toEqual({
      rank: RANKS[0],
      number: 1,
      next: RANKS[1],
      progress: 0,
      toNext: 250,
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
      expect.objectContaining({
        next: null,
        progress: 1,
        toNext: null,
        number: RANKS.length,
      })
    );
  });

  it('climbs strictly', () => {
    RANKS.slice(1).forEach((rank, i) =>
      expect(rank.xp).toBeGreaterThan(RANKS[i].xp)
    );
  });
});

describe('xpClimb', () => {
  it('shows the part held and the part the match added', () => {
    const climb = xpClimb(1000, 250);

    expect(climb.rankUp).toBe(false);
    expect(climb.held).toBeCloseTo(100 * (250 / 750));
    expect(climb.gained).toBeCloseTo(100 * (250 / 750));
  });

  it('starts the bar over after a rank up', () => {
    const climb = xpClimb(1400, 250);

    expect(climb.rankUp).toBe(true);
    expect(climb.standing.rank.name).toBe('Spirillum');
    expect(climb.held).toBe(0);
    expect(climb.gained).toBeCloseTo(100 * (150 / 1500));
  });
});
