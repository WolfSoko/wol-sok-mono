import type { AuswahlInhalt } from './auswahl-dokument';
import { zusammenfuehren } from './zusammenfuehren';

const LEER: AuswahlInhalt = { teams: [], kinder: [] };

describe('zusammenfuehren', () => {
  it("takes the device's choices into an empty account", () => {
    const geraet: AuswahlInhalt = {
      teams: [313036, 201500],
      kinder: [{ personId: 4711, spitzname: 'Mimi' }],
    };

    expect(zusammenfuehren(LEER, geraet)).toEqual(geraet);
  });

  it("keeps an account's choices where the device holds none", () => {
    const konto: AuswahlInhalt = {
      teams: [313036],
      kinder: [{ personId: 4711 }],
    };

    expect(zusammenfuehren(konto, LEER)).toBe(konto);
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

    expect(zusammenfuehren(konto, geraet)).toEqual({
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

    const zusammen = zusammenfuehren(konto, {
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
    const einmal = zusammenfuehren(konto, geraet);

    expect(zusammenfuehren(einmal, geraet)).toEqual(einmal);
  });
});
