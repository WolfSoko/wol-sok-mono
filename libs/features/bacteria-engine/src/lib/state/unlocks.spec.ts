import { activeArena, arenaLocks, colorLocks, newCosmetics } from './unlocks';
import { LEVELS } from './levels';
import { addMedal, addTotals, EMPTY_PROGRESS, Progress } from './progress';

describe('colorLocks', () => {
  it('leaves orange and blue free and locks the rest with what opens them', () => {
    const locks = colorLocks(EMPTY_PROGRESS);

    expect('orange' in locks).toBe(false);
    expect('blue' in locks).toBe(false);
    expect(locks).toEqual({
      green: 'Earn First Blood',
      yellow: 'Earn a gold medallion',
      cyan: 'Earn Pacifist',
      pink: 'Reach the rank Bacillus',
      purple: 'Reach the rank Biofilm',
      red: 'Earn Hard Boiled',
    });
  });

  it('opens colours with achievements, medallions and ranks', () => {
    const progress: Progress = {
      ...addTotals(addMedal(EMPTY_PROGRESS, 'villi', 'easy', 'gold'), {
        matchXp: 3000,
      }),
      achievements: { 'first-blood': '2026-10-19' },
    };

    expect(Object.keys(colorLocks(progress))).toEqual(['cyan', 'red']);
  });
});

describe('arenaLocks', () => {
  it("opens a level's arena with gold on it, at any difficulty", () => {
    const progress = addMedal(EMPTY_PROGRESS, LEVELS[2].id, 'hard', 'platinum');
    const locks = arenaLocks(progress);

    expect(LEVELS[2].id in locks).toBe(false);
    expect(locks[LEVELS[3].id]).toBe('Gold on Inner Ring');
    expect(
      LEVELS[0].id in
        arenaLocks(addMedal(EMPTY_PROGRESS, LEVELS[0].id, 'easy', 'silver'))
    ).toBe(true);
  });
});

describe('activeArena', () => {
  it('draws a chosen arena once it is earned', () => {
    expect(activeArena('villi', {})).toBe('villi');
    expect(activeArena('villi', { villi: 'Gold on Villi' })).toBeNull();
    expect(activeArena(null, {})).toBeNull();
  });
});

describe('newCosmetics', () => {
  it('names what a change of the progress opened', () => {
    const after: Progress = {
      ...addMedal(EMPTY_PROGRESS, 'hourglass', 'normal', 'gold'),
      achievements: { 'first-blood': '2026-10-19' },
    };
    const locks = (progress: Progress) => ({
      colors: colorLocks(progress),
      arenas: arenaLocks(progress),
    });

    expect(newCosmetics(locks(EMPTY_PROGRESS), locks(after))).toEqual([
      'Green colonies',
      'Yellow colonies',
      'Hourglass arena',
    ]);
    expect(newCosmetics(locks(after), locks(after))).toEqual([]);
  });
});
