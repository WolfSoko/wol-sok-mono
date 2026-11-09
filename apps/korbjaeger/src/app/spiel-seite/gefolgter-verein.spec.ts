import type { Spiel } from '@wolsok/feat-shared-basketball-data';
import { gefolgterVerein } from './gefolgter-verein';

const SPIEL = {
  heim: { art: 'team', team: { id: 1, name: 'Heim', vereinId: 10 } },
  gast: { art: 'team', team: { id: 2, name: 'Gast', vereinId: 20 } },
} as unknown as Spiel;

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
      heim: { art: 'offen', bezeichnung: 'Nord 1. Platz' },
    } as unknown as Spiel;

    expect(gefolgterVerein(offen, [1, 2])).toBe(20);
  });
});
