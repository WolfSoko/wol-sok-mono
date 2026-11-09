import {
  isHiddenPerson,
  isPerson,
  namesOf,
  personIdOf,
  playerIdOf,
} from './fixture-persons';

describe('fixture persons', () => {
  it('takes any object with a first or last name as a person, with or without id', () => {
    expect(isPerson({ id: 7, vorname: 'A', nachname: 'B' })).toBe(true);
    expect(isPerson({ vorname: 'A' })).toBe(true);
    expect(isPerson({ nachname: 'B' })).toBe(true);
    expect(isPerson({ teamname: 'Kieler TB', id: 7 })).toBe(false);
  });

  it('takes a person whose names are stars as hidden', () => {
    expect(
      isHiddenPerson({ id: 0, vorname: '***', nachname: '****', anonym: true })
    ).toBe(true);
    expect(
      isHiddenPerson({ id: 0, vorname: 'Real', nachname: '****', anonym: true })
    ).toBe(false);
  });

  it('lists the names a person has', () => {
    expect(namesOf({ vorname: 'A', nachname: null })).toEqual(['A']);
  });

  it('reads ids, absent where null or missing', () => {
    expect(personIdOf({ id: 881456 })).toBe(881456);
    expect(personIdOf({ id: null })).toBeUndefined();
    expect(playerIdOf({})).toBeUndefined();
    expect(playerIdOf({ playerId: 4456015 })).toBe(4456015);
  });

  it('refuses an id that is no number', () => {
    expect(() => personIdOf({ id: '881456' })).toThrow('id is no number');
    expect(() => playerIdOf({ playerId: '4456015' })).toThrow(
      'playerId is no number'
    );
  });
});
