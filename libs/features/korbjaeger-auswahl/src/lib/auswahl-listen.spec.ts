import {
  auswahlDokumentLesen,
  auswahlDokumentMit,
  auswahlFelder,
  naechsterSeit,
} from './auswahl-dokument';
import {
  AUSWAHL_GRENZEN,
  AUSWAHL_LISTEN,
  AUSWAHL_LISTEN_ARTEN,
  auswahlLeer,
  auswahlOhne,
  auswahlVereint,
  LEERE_AUSWAHL,
  type AuswahlInhalt,
} from './auswahl-listen';

const VORHER: AuswahlInhalt = {
  teams: [313036, 201500],
  kinder: [{ personId: 4711 }, { personId: 4712, spitzname: 'Mia' }],
  vereinsfarben: [{ vereinId: 100, primaer: '#ff0000' }],
};

const NACHHER: AuswahlInhalt = {
  teams: [201500, 201765],
  kinder: [
    { personId: 4712, spitzname: 'Mimi' },
    { personId: 4713, spitzname: 'Ben' },
  ],
  vereinsfarben: [
    { vereinId: 100, primaer: '#00ff00', zweite: '#0000ff' },
    { vereinId: 200, primaer: '#ffffff' },
  ],
};

describe('AUSWAHL_LISTEN_ARTEN', () => {
  it('describes every list once, with a cap', () => {
    expect(Object.keys(AUSWAHL_LISTEN_ARTEN).sort()).toEqual(
      [...AUSWAHL_LISTEN].sort()
    );
    expect(Object.keys(AUSWAHL_GRENZEN).sort()).toEqual(
      [...AUSWAHL_LISTEN].sort()
    );
  });

  it('stores each list in a field of its own', () => {
    const felder = AUSWAHL_LISTEN.map(
      (liste) => AUSWAHL_LISTEN_ARTEN[liste].feld
    );

    expect(new Set(felder).size).toBe(AUSWAHL_LISTEN.length);
  });

  it.each([LEERE_AUSWAHL, VORHER])(
    'reads back what a change writes, list by list (from %#)',
    (vorher) => {
      const gespeichert = auswahlDokumentMit(
        { art: 'keins' },
        auswahlFelder(LEERE_AUSWAHL, vorher, 1)
      );
      const gelesen = auswahlDokumentLesen(gespeichert);
      const felder = auswahlFelder(vorher, NACHHER, naechsterSeit(gelesen));

      const danach = auswahlDokumentLesen(auswahlDokumentMit(gelesen, felder));

      for (const liste of AUSWAHL_LISTEN) {
        expect(danach.art === 'aktuell' && danach[liste]).toEqual(
          NACHHER[liste]
        );
      }
    }
  );
});

describe('auswahlOhne and auswahlVereint', () => {
  it('take entries out by id, and join them each once', () => {
    const ohne = auswahlOhne(NACHHER, VORHER);

    expect(ohne).toEqual({
      teams: [201765],
      kinder: [{ personId: 4713, spitzname: 'Ben' }],
      vereinsfarben: [{ vereinId: 200, primaer: '#ffffff' }],
    });
    expect(auswahlVereint(VORHER, NACHHER)).toEqual({
      teams: [...VORHER.teams, ...ohne.teams],
      kinder: [...VORHER.kinder, ...ohne.kinder],
      vereinsfarben: [...VORHER.vereinsfarben, ...ohne.vereinsfarben],
    });
  });

  it('tells an Auswahl that holds nothing', () => {
    expect(auswahlLeer(LEERE_AUSWAHL)).toBe(true);
    expect(
      auswahlLeer({ ...LEERE_AUSWAHL, kinder: [{ personId: 4711 }] })
    ).toBe(false);
  });
});
