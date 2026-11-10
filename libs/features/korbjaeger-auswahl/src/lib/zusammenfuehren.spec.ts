import { AUSWAHL_GRENZEN, type AuswahlInhalt } from './selection-lists';
import { zusammenfuehren } from './zusammenfuehren';

const LEER: AuswahlInhalt = { teams: [], kinder: [], vereinsfarben: [] };

describe('zusammenfuehren', () => {
  it("takes the device's choices into an empty account", () => {
    const geraet: AuswahlInhalt = {
      teams: [313036, 201500],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
      vereinsfarben: [],
    };

    expect(zusammenfuehren(LEER, geraet)).toEqual({
      inhalt: geraet,
      uebrig: LEER,
    });
  });

  it("gives the device's Teams no place of their own: they join after the account's", () => {
    const konto: AuswahlInhalt = {
      ...LEER,
      teams: [201765],
      teamsSeit: new Map([[201765, 50]]),
    };
    const geraet: AuswahlInhalt = {
      ...LEER,
      teams: [313036],
      teamsSeit: new Map([[313036, 1]]),
    };

    const { inhalt } = zusammenfuehren(konto, geraet);

    expect(inhalt.teams).toEqual([201765, 313036]);
    expect(inhalt.teamsSeit?.has(313036) ?? false).toBe(false);
  });

  it("keeps an account's choices where the device holds none", () => {
    const konto: AuswahlInhalt = {
      teams: [313036],
      kinder: [{ personId: 4711 }],
      vereinsfarben: [],
    };

    expect(zusammenfuehren(konto, LEER).inhalt).toBe(konto);
  });

  it("joins overlapping choices: the account's first, each once", () => {
    const konto: AuswahlInhalt = {
      teams: [313036, 201765],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }, { personId: 4712 }],
      vereinsfarben: [],
    };
    const geraet: AuswahlInhalt = {
      teams: [201500, 313036],
      kinder: [
        { personId: 4713 },
        { personId: 4711, spitzname: 'Mia' },
        { personId: 4712, spitzname: 'Mo' },
      ],
      vereinsfarben: [],
    };

    expect(zusammenfuehren(konto, geraet).inhalt).toEqual({
      teams: [313036, 201765, 201500],
      kinder: [
        // the account's Spitzname wins; the device fills a missing one
        { personId: 4711, spitzname: 'Mimi' },
        { personId: 4712, spitzname: 'Mo' },
        { personId: 4713 },
      ],
      vereinsfarben: [],
    });
  });

  it('changes nothing of an account already set up with these choices', () => {
    const konto: AuswahlInhalt = {
      teams: [313036, 201500],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
      vereinsfarben: [],
    };

    const { inhalt: zusammen } = zusammenfuehren(konto, {
      teams: [201500],
      kinder: [{ personId: 4711 }],
      vereinsfarben: [],
    });

    expect(zusammen.teams).toBe(konto.teams);
    expect(zusammen.kinder).toBe(konto.kinder);
  });

  it('gives the same on a second sign-in as on the first', () => {
    const konto: AuswahlInhalt = {
      teams: [313036],
      kinder: [],
      vereinsfarben: [],
    };
    const geraet: AuswahlInhalt = {
      teams: [201500],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
      vereinsfarben: [],
    };
    const einmal = zusammenfuehren(konto, geraet).inhalt;

    expect(zusammenfuehren(einmal, geraet).inhalt).toEqual(einmal);
  });

  it("takes the device's choices only up to the caps, the account's first", () => {
    const ids = (anzahl: number, ab: number) =>
      Array.from({ length: anzahl }, (_, i) => ab + i);
    const konto: AuswahlInhalt = {
      teams: ids(AUSWAHL_GRENZEN.teams - 2, 1),
      kinder: ids(AUSWAHL_GRENZEN.kinder, 1).map((personId) => ({ personId })),
      vereinsfarben: [],
    };
    const geraet: AuswahlInhalt = {
      teams: [1, 9001, 9002, 9003, 9004],
      kinder: [{ personId: 9001 }, { personId: 1, spitzname: 'Mimi' }],
      vereinsfarben: [],
    };

    const { inhalt, uebrig } = zusammenfuehren(konto, geraet);

    expect(inhalt.teams).toEqual([...konto.teams, 9001, 9002]);
    expect(inhalt.kinder).toHaveLength(AUSWAHL_GRENZEN.kinder);
    // a Spitzname for a Kind the account holds still joins
    expect(inhalt.kinder[0]).toEqual({ personId: 1, spitzname: 'Mimi' });
    expect(uebrig).toEqual({
      teams: [9003, 9004],
      kinder: [{ personId: 9001 }],
      vereinsfarben: [],
    });
  });

  it("takes the device's Vereinsfarben for the other Vereine, the account's winning", () => {
    const konto: AuswahlInhalt = {
      ...LEER,
      vereinsfarben: [{ vereinId: 4343, primaer: '#1d4ed8' }],
    };
    const geraet: AuswahlInhalt = {
      ...LEER,
      vereinsfarben: [
        { vereinId: 4242, primaer: '#c8102e' },
        { vereinId: 4343, primaer: '#007a3d' },
      ],
    };

    const { inhalt, uebrig } = zusammenfuehren(konto, geraet);

    expect(inhalt.vereinsfarben).toEqual([
      { vereinId: 4242, primaer: '#c8102e' },
      { vereinId: 4343, primaer: '#1d4ed8' },
    ]);
    expect(uebrig.vereinsfarben).toEqual([]);
    expect(zusammenfuehren(inhalt, geraet).inhalt).toBe(inhalt);
  });

  it("takes the device's Vereinsfarben only up to their cap", () => {
    const farben = (anzahl: number, ab: number) =>
      Array.from({ length: anzahl }, (_, i) => ({
        vereinId: ab + i,
        primaer: '#c8102e',
      }));
    const konto: AuswahlInhalt = {
      ...LEER,
      vereinsfarben: farben(AUSWAHL_GRENZEN.vereinsfarben - 1, 1),
    };
    const geraet: AuswahlInhalt = { ...LEER, vereinsfarben: farben(2, 9001) };

    const { inhalt, uebrig } = zusammenfuehren(konto, geraet);

    expect(inhalt.vereinsfarben).toHaveLength(AUSWAHL_GRENZEN.vereinsfarben);
    expect(uebrig.vereinsfarben).toEqual([
      { vereinId: 9002, primaer: '#c8102e' },
    ]);
  });
});
