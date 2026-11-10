import type { Standings, StandingsRow } from '../domain/standings';
import { DbbObject } from './dbb-object';
import { mapLeague } from './map-league';
import { mapParticipant } from './map-team';

/** A Liga's Tabelle (`competition/table/id/{ligaId}`). */
export function mapStandings(data: unknown): Standings {
  const table = DbbObject.of(data, 'table');
  return {
    league: mapLeague(table.object('ligaData')),
    rows: (
      table.optionalObject('tabelle')?.optionalObjects('entries') ?? []
    ).map(mapRow),
  };
}

function mapRow(entry: DbbObject): StandingsRow {
  return {
    rank: entry.number('rang'),
    participant: mapParticipant(entry.object('team')),
    games: entry.number('anzspiele'),
    wins: entry.number('s'),
    losses: entry.number('n'),
    points: entry.number('anzGewinnpunkte'),
    pointsFor: entry.number('koerbe'),
    pointsAgainst: entry.number('gegenKoerbe'),
    pointDifference: entry.number('korbdiff'),
  };
}
