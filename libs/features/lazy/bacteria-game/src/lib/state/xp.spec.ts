import { aMatchRecord } from '../../testing/match-record';
import { addMedal, addTotals, EMPTY_PROGRESS, Progress } from './progress';
import { matchXp, xpGain, xpOf } from './xp';

const WIN = aMatchRecord({
  levelId: 'corridors',
  boostsFired: 2,
  lost: 300,
  lowestSizeRatio: 0.8,
  captured: 400,
  enemyCrushed: 50,
  peakShare: 0.5,
});

describe('matchXp', () => {
  it('pays finishing and winning, times the difficulty', () => {
    expect(matchXp(WIN)).toBe(125);
    expect(matchXp({ ...WIN, won: false, difficulty: 'hard' })).toBe(30);
    expect(matchXp({ ...WIN, difficulty: 'easy' })).toBe(100);
  });
});

describe('xpOf', () => {
  it('counts the matches, the held medallions and the achievements', () => {
    let progress = addTotals(EMPTY_PROGRESS, { matchXp: 300 });
    progress = addMedal(progress, 'corridors', 'normal', 'gold');
    progress = addMedal(progress, 'villi', 'hard', 'bronze');
    progress = { ...progress, achievements: { blitz: '2026-10-19' } };

    expect(xpOf(progress)).toBe(300 + 70 + 20 + 50);
  });

  it('pays a medallion once, at its best', () => {
    const silver = addMedal(EMPTY_PROGRESS, 'corridors', 'normal', 'silver');

    expect(xpOf(addMedal(silver, 'corridors', 'normal', 'gold'))).toBe(70);
  });

  it('leaves out what the game no longer has', () => {
    const progress: Progress = {
      ...addMedal(EMPTY_PROGRESS, 'moon', 'easy', 'platinum'),
      achievements: { moonwalk: '2026-10-19' } as Progress['achievements'],
    };

    expect(xpOf(progress)).toBe(0);
  });
});

describe('xpGain', () => {
  it('tells a match line by line, adding up to the change in XP', () => {
    const before = addMedal(EMPTY_PROGRESS, 'corridors', 'normal', 'silver');
    const after: Progress = {
      ...addTotals(addMedal(before, 'corridors', 'normal', 'gold'), {
        matchXp: matchXp(WIN),
      }),
      achievements: { blitz: '2026-10-19', pacifist: '2026-10-19' },
    };

    const gain = xpGain(before, after, WIN);

    expect(gain.parts).toEqual([
      { label: 'Win · Normal', xp: 125 },
      { label: 'Gold medallion, a new best', xp: 30 },
      { label: '2 achievements', xp: 100 },
    ]);
    expect(gain.total).toBe(xpOf(after) - xpOf(before));
  });

  it('pays no medallion on a generated level, as the XP does not count it', () => {
    const level = 'gen:cave:9:5';
    const won = { ...WIN, levelId: level };
    const after = addTotals(addMedal(EMPTY_PROGRESS, level, 'normal', 'gold'), {
      matchXp: matchXp(won),
    });

    const gain = xpGain(EMPTY_PROGRESS, after, won);

    expect(gain.parts).toEqual([{ label: 'Win · Normal', xp: 125 }]);
    expect(gain.total).toBe(xpOf(after) - xpOf(EMPTY_PROGRESS));
  });

  it('pays a little for a match between two players', () => {
    const after = addTotals(EMPTY_PROGRESS, { matchXp: 15, couchMatches: 1 });

    expect(xpGain(EMPTY_PROGRESS, after, null)).toEqual({
      parts: [{ label: 'Two players', xp: 15 }],
      total: 15,
    });
  });
});
