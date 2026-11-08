import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import table from './fixtures/table-54308.json';
import { mapTabelle } from './map-tabelle';

describe('mapTabelle', () => {
  const tabelle = mapTabelle(readEnvelope(table));

  it('reads the Liga with its Saison', () => {
    expect(tabelle.liga.id).toBe(54308);
    expect(tabelle.liga.saison).toEqual({ id: 2026, name: '2026/2027' });
  });

  it('reads each line, the Team by its permanent id', () => {
    expect(tabelle.zeilen).toHaveLength(7);
    expect(tabelle.zeilen[0]).toEqual({
      rang: 1,
      team: { id: 156618, name: 'Post SV Nürnberg', vereinId: 1476 },
      spiele: 4,
      siege: 4,
      niederlagen: 0,
      punkte: 8,
      koerbe: 411,
      gegenkoerbe: 288,
      korbdifferenz: 123,
    });
    expect(tabelle.zeilen.map((zeile) => zeile.rang)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('reads a Liga that keeps no Tabelle yet as empty', () => {
    const data = { ...(readEnvelope(table) as object), tabelle: null };

    expect(mapTabelle(data).zeilen).toEqual([]);
  });

  it('refuses a line without its Team', () => {
    const data = readEnvelope(table) as { tabelle: { entries: object[] } };
    const broken = {
      ...data,
      tabelle: { entries: [{ ...data.tabelle.entries[0], team: null }] },
    };

    expect(caughtError(() => mapTabelle(broken)).message).toBe(
      'table.tabelle.entries[0].team: expected an object, got null'
    );
  });
});
