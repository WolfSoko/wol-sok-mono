import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import wamData from './fixtures/wam-data-bayern-u14.json';
import zweiteSeite from './fixtures/wam-liga-list-bayern-u14-10.json';
import letzteSeite from './fixtures/wam-liga-list-schleswig-holstein-jugend-30.json';
import { mapLigaSeite, mapLigaSuche } from './map-liga-suche';

describe('mapLigaSuche', () => {
  const suche = mapLigaSuche(readEnvelope(wamData));

  it('reads the Verband, age group and gender facets', () => {
    expect(suche.facetten.verbaende).toContainEqual({
      id: 2,
      name: 'Bayern',
      treffer: 57,
    });
    expect(suche.facetten.altersklassen).toContainEqual({
      id: 14,
      name: 'U14',
      treffer: 57,
    });
    expect(suche.facetten.altersgruppenGeschlechter).toEqual([
      { id: '2_1', name: 'Jugend männlich', treffer: 41 },
      { id: '2_2', name: 'Jugend weiblich', treffer: 16 },
    ]);
  });

  it('reads the first page of Ligen', () => {
    expect(suche.ersteSeite.startIndex).toBe(0);
    expect(suche.ersteSeite.weitere).toBe(true);
    expect(suche.ersteSeite.ligen).toHaveLength(10);
    expect(suche.ersteSeite.ligen[0]).toEqual({
      id: 54308,
      name: 'Bayernliga U14 männlich Einteilungsrunde Nord',
      verband: { id: 2, name: 'Bayern' },
      altersklasse: 'U14',
      geschlecht: 'männlich',
      spielklasse: 'Bayernliga',
    });
  });

  it('refuses a gender facet it cannot name', () => {
    const data = {
      ...(readEnvelope(wamData) as object),
      agkGeschlechtList: [
        { id: '2_3', akg: 'Jugend', geschlecht: 'x', hits: 1 },
      ],
    };

    expect(caughtError(() => mapLigaSuche(data)).message).toBe(
      'wam.agkGeschlechtList[0].geschlecht: expected m or w, got "x"'
    );
  });
});

describe('mapLigaSeite', () => {
  it('reads a later page, with the Bezirk of a Liga below the Verband', () => {
    const seite = mapLigaSeite(readEnvelope(zweiteSeite));

    expect(seite.startIndex).toBe(10);
    expect(seite.weitere).toBe(true);
    expect(seite.ligen.map((liga) => liga.id)).toContain(53790);
    expect(seite.ligen.find((liga) => liga.id === 53790)?.bezirk).toBe(
      'Oberbayern'
    );
  });

  it('knows the last page', () => {
    const seite = mapLigaSeite(readEnvelope(letzteSeite));

    expect(seite.startIndex).toBe(30);
    expect(seite.weitere).toBe(false);
    expect(seite.ligen).toHaveLength(7);
    expect(seite.ligen[0].verband.name).toBe('Schleswig-Holstein');
  });

  it('refuses a Liga of an unknown gender', () => {
    const data = readEnvelope(letzteSeite) as { ligen: object[] };
    const broken = {
      ...data,
      ligen: [{ ...data.ligen[0], geschlecht: 'divers' }],
    };

    expect(caughtError(() => mapLigaSeite(broken)).kind).toBe(
      'unexpected-shape'
    );
  });
});

describe('gender lookups', () => {
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'refuse the inherited key %s as a Liga gender and a facet',
    (key) => {
      const liste = readEnvelope(letzteSeite) as { ligen: object[] };
      const liga = {
        ...liste,
        ligen: [{ ...liste.ligen[0], geschlecht: key }],
      };
      const suche = {
        ...(readEnvelope(wamData) as object),
        agkGeschlechtList: [
          { id: '2_1', akg: 'Jugend', geschlecht: key, hits: 1 },
        ],
      };

      expect(caughtError(() => mapLigaSeite(liga)).kind).toBe(
        'unexpected-shape'
      );
      expect(caughtError(() => mapLigaSuche(suche)).kind).toBe(
        'unexpected-shape'
      );
    }
  );
});
