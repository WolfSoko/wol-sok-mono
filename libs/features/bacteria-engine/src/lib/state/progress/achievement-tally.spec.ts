import { ACHIEVEMENT_IDS } from './achievement-ids';
import { achievementTally } from './achievement-tally';

describe('achievementTally', () => {
  const total = ACHIEVEMENT_IDS.length;

  it('counts none of none earned', () => {
    expect(achievementTally({})).toEqual({ earned: 0, total, percent: 0 });
  });

  it('counts the achievements earned, as a share in whole percent', () => {
    expect(
      achievementTally({ blitz: '2026-10-19', 'lab-member': '2026-11-20' })
    ).toEqual({ earned: 2, total, percent: Math.round(200 / total) });
  });

  it('counts no id the game does not know', () => {
    expect(
      achievementTally({ blitz: '2026-10-19', retired: '2026-01-01' } as never)
        .earned
    ).toBe(1);
  });

  it('is full once every achievement is earned', () => {
    const all = Object.fromEntries(
      ACHIEVEMENT_IDS.map((id) => [id, '2026-11-20'])
    );
    expect(achievementTally(all).percent).toBe(100);
  });
});
