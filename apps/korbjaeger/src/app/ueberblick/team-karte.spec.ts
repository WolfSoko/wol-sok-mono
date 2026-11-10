import { kartenName, type TeamKarte } from './team-karte';

describe('kartenName', () => {
  it('names a Team by its name once its Saison was read', () => {
    const karte = {
      art: 'geladen',
      teamId: 313036,
      name: 'MTV Wasbüttel',
      verein: { id: 4242, name: 'MTV Wasbüttel' },
      ausfaelle: [],
      saisonBeendet: false,
    } as const satisfies TeamKarte;

    expect(kartenName(karte)).toBe('MTV Wasbüttel');
  });

  it('names a Team by its id while it loads or where its read failed', () => {
    expect(kartenName({ art: 'laedt', teamId: 201500 })).toBe('Team 201500');
    expect(kartenName({ art: 'fehler', teamId: 201500, text: 'Fehler' })).toBe(
      'Team 201500'
    );
  });
});
