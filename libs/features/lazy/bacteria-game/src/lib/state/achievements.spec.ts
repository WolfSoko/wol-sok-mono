import { ACHIEVEMENT_IDS, isAchievementId } from './achievement-ids';
import { ACHIEVEMENTS, earnAchievements, getAchievement } from './achievements';
import { LEVELS } from './levels';
import { MatchRecord } from './medallions';
import { addMedal, EMPTY_PROGRESS, NO_TOTALS, Progress } from './progress';

/** A plain win: a minute long, two boosts, nothing remarkable. */
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
  enemyLost: 450,
  peakShare: 0.5,
};

function earnedBy(
  match: MatchRecord | null,
  progress: Progress = EMPTY_PROGRESS
): string[] {
  return earnAchievements(progress, match, '2026-10-19').earned;
}

describe('achievements', () => {
  it('has one rule per id, in the same order', () => {
    expect(ACHIEVEMENTS.map(({ id }) => id)).toEqual([...ACHIEVEMENT_IDS]);
    expect(isAchievementId('blitz')).toBe(true);
    expect(isAchievementId('moonwalk')).toBe(false);
    expect(getAchievement('siege').name).toBe('Siege');
  });

  it('earns nothing for a plain win before the totals count it', () => {
    expect(earnedBy(WIN)).toEqual([]);
  });

  it.each([
    ['pacifist', { boostsFired: 0 }],
    ['blitz', { durationSec: 44 }],
    ['comeback', { lowestSizeRatio: 0.2 }],
    ['siege', { durationSec: 301 }],
    ['clean-sweep', { lost: 99 }],
    ['full-dish', { peakShare: 0.96 }],
  ] as const)('earns %s for a match that does it', (id, changes) => {
    expect(earnedBy({ ...WIN, ...changes })).toEqual([id]);
  });

  it('asks a win for the match achievements, except Full Dish', () => {
    const lost = { ...WIN, won: false };
    expect(
      earnedBy({ ...lost, boostsFired: 0, durationSec: 30, lost: 0 })
    ).toEqual([]);
    expect(earnedBy({ ...lost, peakShare: 1 })).toEqual(['full-dish']);
  });

  it('earns the lifetime ones from the totals', () => {
    const progress: Progress = {
      ...EMPTY_PROGRESS,
      totals: {
        ...NO_TOTALS,
        wins: 1,
        enemyCrushed: 500,
        captured: 10_000,
        couchMatches: 10,
      },
    };

    expect(earnedBy(null, progress)).toEqual([
      'first-blood',
      'gatekeeper',
      'converter',
      'couch-war',
    ]);
  });

  it('earns the medallion ones from the cabinet', () => {
    let progress = addMedal(EMPTY_PROGRESS, 'villi', 'easy', 'platinum');
    for (const level of LEVELS.slice(0, 4)) {
      progress = addMedal(progress, level.id, 'easy', 'gold');
    }
    expect(earnedBy(null, progress)).toEqual(['flawless', 'petri-scholar']);

    for (const level of LEVELS) {
      progress = addMedal(progress, level.id, 'hard', 'bronze');
    }
    expect(earnedBy(null, progress)).toContain('hard-boiled');
  });

  it('earns each once, and marks the day', () => {
    const first = earnAchievements(
      EMPTY_PROGRESS,
      { ...WIN, boostsFired: 0 },
      '2026-10-19'
    );
    expect(first.progress.achievements).toEqual({ pacifist: '2026-10-19' });

    const again = earnAchievements(
      first.progress,
      { ...WIN, boostsFired: 0 },
      '2026-10-20'
    );
    expect(again.earned).toEqual([]);
    expect(again.progress).toBe(first.progress);
  });
});
