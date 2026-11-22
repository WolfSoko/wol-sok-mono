import { ACHIEVEMENTS } from '@wolsok/feat-shared-bacteria-engine';
import { achievementsToUnlock } from './achievements';
import type { AchievementState } from './games-api';

const nameOf = (id: string) =>
  ACHIEVEMENTS.find((achievement) => achievement.id === id)?.name ?? id;

/** Play's list: each named achievement under the Play id `P-<id>`. */
const onPlay = (...ids: string[]) =>
  ids.map((id) => ({ id: `P-${id}`, name: nameOf(id) }));

const states = (entries: Record<string, AchievementState>) =>
  new Map(Object.entries(entries).map(([id, state]) => [`P-${id}`, state]));

describe('achievementsToUnlock', () => {
  it('unlocks earned achievements Play shows hidden, revealed or without a state', () => {
    expect(
      achievementsToUnlock(
        ['first-blood', 'pacifist', 'blitz'],
        onPlay('first-blood', 'pacifist', 'blitz'),
        states({ 'first-blood': 'HIDDEN', pacifist: 'REVEALED' })
      )
    ).toEqual({
      unlock: [
        { id: 'P-first-blood', name: 'First Blood' },
        { id: 'P-pacifist', name: 'Pacifist' },
        { id: 'P-blitz', name: 'Blitz' },
      ],
      missing: [],
      ambiguous: [],
    });
  });

  it('skips what Play shows unlocked already', () => {
    expect(
      achievementsToUnlock(
        ['first-blood'],
        onPlay('first-blood'),
        states({ 'first-blood': 'UNLOCKED' })
      ).unlock
    ).toEqual([]);
  });

  it('names an earned achievement Play does not list, and skips it', () => {
    expect(
      achievementsToUnlock(
        ['first-blood', 'lab-member'],
        onPlay('first-blood'),
        new Map()
      )
    ).toEqual({
      unlock: [{ id: 'P-first-blood', name: 'First Blood' }],
      missing: [nameOf('lab-member')],
      ambiguous: [],
    });
  });

  it('skips a name Play lists twice, since the game cannot tell its own', () => {
    expect(
      achievementsToUnlock(
        ['first-blood'],
        [
          { id: 'A', name: 'First Blood' },
          { id: 'B', name: 'First Blood' },
        ],
        new Map()
      )
    ).toEqual({ unlock: [], missing: [], ambiguous: ['First Blood'] });
  });

  it('never unlocks what the game has not earned, or names it does not know', () => {
    expect(
      achievementsToUnlock(
        ['first-blood'],
        [...onPlay('first-blood', 'pacifist'), { id: 'X', name: 'Unknown' }],
        new Map()
      ).unlock
    ).toEqual([{ id: 'P-first-blood', name: 'First Blood' }]);
  });

  it('unlocks nothing for nothing earned', () => {
    expect(achievementsToUnlock([], onPlay('first-blood'), new Map())).toEqual({
      unlock: [],
      missing: [],
      ambiguous: [],
    });
  });
});
