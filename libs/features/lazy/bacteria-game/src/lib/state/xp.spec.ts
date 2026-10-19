import { MatchRecord } from './medallions';
import { xpForCouchMatch, xpForMatch } from './xp';

const WIN: MatchRecord = {
  levelId: 'corridors',
  difficulty: 'normal',
  won: true,
  durationSec: 60,
  boostsFired: 2,
  lost: 300,
  peakCount: 1000,
  lowestSizeRatio: 0.8,
  captured: 400,
  enemyCrushed: 50,
  peakShare: 0.5,
};

describe('xpForMatch', () => {
  it('pays finishing and winning, times the difficulty', () => {
    expect(xpForMatch(WIN, null, null, 0)).toEqual({
      parts: [{ label: 'Win · Normal', xp: 125 }],
      total: 125,
    });
    expect(
      xpForMatch({ ...WIN, won: false, difficulty: 'hard' }, null, null, 0)
        .total
    ).toBe(30);
  });

  it('pays a medallion in full only as a new best', () => {
    expect(xpForMatch(WIN, 'gold', 'silver', 0).parts[1]).toEqual({
      label: 'Gold medallion, a new best',
      xp: 70,
    });
    expect(xpForMatch(WIN, 'gold', 'gold', 0).parts[1]).toEqual({
      label: 'Gold medallion',
      xp: 18,
    });
  });

  it('pays every achievement', () => {
    const gain = xpForMatch(WIN, 'bronze', null, 2);

    expect(gain.parts.at(-1)).toEqual({ label: '2 achievements', xp: 100 });
    expect(gain.total).toBe(125 + 20 + 100);
  });
});

describe('xpForCouchMatch', () => {
  it('pays a little for a match between two players', () => {
    expect(xpForCouchMatch(0).total).toBe(15);
    expect(xpForCouchMatch(1).parts).toEqual([
      { label: 'Two players', xp: 15 },
      { label: 'Achievement', xp: 50 },
    ]);
  });
});
