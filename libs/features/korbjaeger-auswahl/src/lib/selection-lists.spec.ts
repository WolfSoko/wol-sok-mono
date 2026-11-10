import {
  auswahlDokumentLesen,
  auswahlDokumentMit,
  auswahlFelder,
  naechsterSeit,
} from './auswahl-dokument';
import {
  AUSWAHL_GRENZEN,
  AUSWAHL_LISTEN,
  LIST_DESCRIPTORS,
  selectionIsEmpty,
  selectionWithout,
  selectionJoined,
  LEERE_AUSWAHL,
  type AuswahlInhalt,
} from './selection-lists';

const BEFORE: AuswahlInhalt = {
  teams: [313036, 201500],
  kinder: [{ personId: 4711 }, { personId: 4712, spitzname: 'Mia' }],
  vereinsfarben: [{ vereinId: 100, primaer: '#ff0000' }],
};

const AFTER: AuswahlInhalt = {
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

describe('LIST_DESCRIPTORS', () => {
  it('describes every list once, with a cap', () => {
    expect(Object.keys(LIST_DESCRIPTORS).sort()).toEqual(
      [...AUSWAHL_LISTEN].sort()
    );
    expect(Object.keys(AUSWAHL_GRENZEN).sort()).toEqual(
      [...AUSWAHL_LISTEN].sort()
    );
  });

  it('stores each list in a field of its own', () => {
    const fields = AUSWAHL_LISTEN.map((list) => LIST_DESCRIPTORS[list].field);

    expect(new Set(fields).size).toBe(AUSWAHL_LISTEN.length);
  });

  it.each([LEERE_AUSWAHL, BEFORE])(
    'reads back what a change writes, list by list (from %#)',
    (before) => {
      const stored = auswahlDokumentMit(
        { art: 'keins' },
        auswahlFelder(LEERE_AUSWAHL, before, 1)
      );
      const read = auswahlDokumentLesen(stored);
      const fields = auswahlFelder(before, AFTER, naechsterSeit(read));

      const after = auswahlDokumentLesen(auswahlDokumentMit(read, fields));

      for (const list of AUSWAHL_LISTEN) {
        expect(after.art === 'aktuell' && after[list]).toEqual(AFTER[list]);
      }
    }
  );
});

describe('selectionWithout and selectionJoined', () => {
  it('take entries out by id, and join them each once', () => {
    const without = selectionWithout(AFTER, BEFORE);

    expect(without).toEqual({
      teams: [201765],
      kinder: [{ personId: 4713, spitzname: 'Ben' }],
      vereinsfarben: [{ vereinId: 200, primaer: '#ffffff' }],
    });
    expect(selectionJoined(BEFORE, AFTER)).toEqual({
      teams: [...BEFORE.teams, ...without.teams],
      kinder: [...BEFORE.kinder, ...without.kinder],
      vereinsfarben: [...BEFORE.vereinsfarben, ...without.vereinsfarben],
    });
  });

  it('tells an Auswahl that holds nothing', () => {
    expect(selectionIsEmpty(LEERE_AUSWAHL)).toBe(true);
    expect(
      selectionIsEmpty({ ...LEERE_AUSWAHL, kinder: [{ personId: 4711 }] })
    ).toBe(false);
  });
});
