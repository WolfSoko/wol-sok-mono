import type { AuswahlInhalt } from './auswahl-dokument';
import { AUSWAHL_GRENZEN } from './auswahl-dokument';
import { zusammenfuehren } from './zusammenfuehren';

const LEER: AuswahlInhalt = { teams: [], kinder: [] };

describe('zusammenfuehren', () => {
  it("takes the device's choices into an empty account", () => {
    const geraet: AuswahlInhalt = {
      teams: [313036, 201500],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
    };

    expect(zusammenfuehren(LEER, geraet)).toEqual({
      inhalt: geraet,
      uebrig: { teams: [], kinder: [] },
    });
  });

  it("keeps an account's choices where the device holds none", () => {
    const konto: AuswahlInhalt = {
      teams: [313036],
      kinder: [{ personId: 4711 }],
    };

    expect(zusammenfuehren(konto, LEER).inhalt).toBe(konto);
  });

  it("joins overlapping choices: the account's first, each once", () => {
    const konto: AuswahlInhalt = {
      teams: [313036, 201765],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }, { personId: 4712 }],
    };
    const geraet: AuswahlInhalt = {
      teams: [201500, 313036],
      kinder: [
        { personId: 4713 },
        { personId: 4711, spitzname: 'Mia' },
        { personId: 4712, spitzname: 'Mo' },
      ],
    };

    expect(zusammenfuehren(konto, geraet).inhalt).toEqual({
      teams: [313036, 201765, 201500],
      kinder: [
        // the account's Spitzname wins; the device fills a missing one
        { personId: 4711, spitzname: 'Mimi' },
        { personId: 4712, spitzname: 'Mo' },
        { personId: 4713 },
      ],
    });
  });

  it('changes nothing of an account already set up with these choices', () => {
    const konto: AuswahlInhalt = {
      teams: [313036, 201500],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
    };

    const { inhalt: zusammen } = zusammenfuehren(konto, {
      teams: [201500],
      kinder: [{ personId: 4711 }],
    });

    expect(zusammen.teams).toBe(konto.teams);
    expect(zusammen.kinder).toBe(konto.kinder);
  });

  it('gives the same on a second sign-in as on the first', () => {
    const konto: AuswahlInhalt = { teams: [313036], kinder: [] };
    const geraet: AuswahlInhalt = {
      teams: [201500],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
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
    };
    const geraet: AuswahlInhalt = {
      teams: [1, 9001, 9002, 9003, 9004],
      kinder: [{ personId: 9001 }, { personId: 1, spitzname: 'Mimi' }],
    };

    const { inhalt, uebrig } = zusammenfuehren(konto, geraet);

    expect(inhalt.teams).toEqual([...konto.teams, 9001, 9002]);
    expect(inhalt.kinder).toHaveLength(AUSWAHL_GRENZEN.kinder);
    // a Spitzname for a Kind the account holds still joins
    expect(inhalt.kinder[0]).toEqual({ personId: 1, spitzname: 'Mimi' });
    expect(uebrig).toEqual({
      teams: [9003, 9004],
      kinder: [{ personId: 9001 }],
    });
  });
});
