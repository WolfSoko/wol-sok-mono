import { playerStatsOf } from '../../testing/player-stats';
import { fieldGoals, isNamed, type RosterEntry } from './game-report';

describe('isNamed', () => {
  it('tells a named player from an Anonymer Spieler', () => {
    const named: RosterEntry = {
      kind: 'named',
      personId: 7,
      firstName: 'Alvo',
      lastName: 'Ahornfeld',
    };
    const anonymous: RosterEntry = { kind: 'anonymous' };

    expect(isNamed(named)).toBe(true);
    expect(isNamed(anonymous)).toBe(false);
  });
});

describe('fieldGoals', () => {
  it('adds up twos and threes, made and attempted, no free throws', () => {
    expect(
      fieldGoals(
        playerStatsOf({
          points: 29,
          twoPointers: { made: 9, attempted: 14 },
          threePointers: { made: 3, attempted: 5 },
          freeThrows: { made: 2, attempted: 7 },
        })
      )
    ).toEqual({ made: 12, attempted: 19 });
  });
});
