import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import table from './fixtures/table-54308.json';
import friendlyTable from './fixtures/table-54689.json';
import vorrundeTable from './fixtures/table-54862.json';
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

  it('reads every line of a Vorrunde, its Teams by the ids their Spiele name', () => {
    const vorrunde = mapTabelle(readEnvelope(vorrundeTable));

    expect(vorrunde.liga.name).toBe('Regionsvorrunde Nord Braunschweig mu12');
    expect(vorrunde.zeilen[1]).toEqual({
      rang: 2,
      team: { id: 313036, name: 'MTV Wasbüttel -RST-', vereinId: 1837 },
      spiele: 5,
      siege: 4,
      niederlagen: 1,
      punkte: 8,
      koerbe: 470,
      gegenkoerbe: 204,
      korbdifferenz: 266,
    });
    expect(vorrunde.zeilen.map((zeile) => zeile.team.id)).toEqual([
      313040, 313036, 201500, 320898, 319164, 322695,
    ]);
  });

  it('reads a friendly Liga, which the DBB keeps no Tabelle for, as empty', () => {
    const testspiele = mapTabelle(readEnvelope(friendlyTable));

    expect(testspiele.liga.id).toBe(54689);
    expect(testspiele.zeilen).toEqual([]);
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
