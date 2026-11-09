import type { Tabelle, TabellenZeile } from '../domain/tabelle';
import { DbbObject } from './dbb-object';
import { mapLiga } from './map-liga';
import { mapSpielPartei } from './map-team';

/** A Liga's Tabelle (`competition/table/id/{ligaId}`). */
export function mapTabelle(data: unknown): Tabelle {
  const table = DbbObject.of(data, 'table');
  return {
    liga: mapLiga(table.object('ligaData')),
    zeilen: (
      table.optionalObject('tabelle')?.optionalObjects('entries') ?? []
    ).map(mapZeile),
  };
}

function mapZeile(entry: DbbObject): TabellenZeile {
  return {
    rang: entry.number('rang'),
    partei: mapSpielPartei(entry.object('team')),
    spiele: entry.number('anzspiele'),
    siege: entry.number('s'),
    niederlagen: entry.number('n'),
    punkte: entry.number('anzGewinnpunkte'),
    koerbe: entry.number('koerbe'),
    gegenkoerbe: entry.number('gegenKoerbe'),
    korbdifferenz: entry.number('korbdiff'),
  };
}
