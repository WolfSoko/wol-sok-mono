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
  it('counts the field goals: twos and threes made, no free throws', () => {
    expect(
      fieldGoals({
        points: 29,
        twoPointers: 9,
        threePointers: 3,
        freeThrows: { made: 2, attempted: 7 },
        fouls: 3,
      })
    ).toBe(12);
  });
});
