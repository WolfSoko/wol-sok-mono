import type { Game } from '@wolsok/feat-shared-basketball-data';
import { followedSide, gefolgterVerein } from './gefolgter-verein';

const SPIEL = {
  home: { kind: 'team', team: { id: 1, name: 'Heim', clubId: 10 } },
  away: { kind: 'team', team: { id: 2, name: 'Gast', clubId: 20 } },
} as unknown as Game;

describe('gefolgterVerein', () => {
  it('names the Verein of the side whose Team is followed', () => {
    expect(gefolgterVerein(SPIEL, [2])).toBe(20);
    expect(gefolgterVerein(SPIEL, [1])).toBe(10);
  });

  it('takes the home side where both are followed', () => {
    expect(gefolgterVerein(SPIEL, [2, 1])).toBe(10);
  });

  it('names none where no side is followed, or Meine Teams are not read', () => {
    expect(gefolgterVerein(SPIEL, [3])).toBeUndefined();
    expect(gefolgterVerein(SPIEL, undefined)).toBeUndefined();
  });

  it('skips a side the Liga fills later', () => {
    const offen = {
      ...SPIEL,
      home: { kind: 'open', label: 'Nord 1. Platz' },
    } as unknown as Game;

    expect(gefolgterVerein(offen, [1, 2])).toBe(20);
  });
});

describe('followedSide', () => {
  it('names the Team of the side whose Team is followed, the home side where both are', () => {
    expect(followedSide(SPIEL, [2])?.name).toBe('Gast');
    expect(followedSide(SPIEL, [2, 1])?.name).toBe('Heim');
  });

  it('names none where no side is followed, or Meine Teams are not read', () => {
    expect(followedSide(SPIEL, [3])).toBeUndefined();
    expect(followedSide(SPIEL, undefined)).toBeUndefined();
  });
});
