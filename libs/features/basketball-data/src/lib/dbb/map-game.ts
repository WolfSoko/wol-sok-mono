import type { LeagueId } from '../domain/ids';
import type { Game, GameSide, GameStatus, Score } from '../domain/game';
import { shapeError, type DbbObject } from './dbb-object';
import { mapParticipant } from './map-team';
import { optionalField } from './optional-field';

/** How the DBB writes a result: `"57:94"`, home first. */
const RESULT = /^(\d+):(\d+)$/;

/** A result without any digit (`"-:-"`, `"abg."`) is a placeholder: none yet. */
const HAS_DIGIT = /\d/;

/** The DBB's tip-off time for "not set yet". */
const NO_TIME = '00:00';

/**
 * A Spiel from one of the DBB's match objects. `ligaId` stands in where the
 * match carries no `ligaData`, as in a Liga's own Spielplan.
 */
export function mapGame(match: DbbObject, leagueId?: LeagueId): Game {
  const time = match.optionalString('kickoffTime');
  return {
    id: match.number('matchId'),
    leagueId:
      match.optionalObject('ligaData')?.number('ligaId') ??
      requiredLeagueId(match, leagueId),
    matchday: match.number('matchDay'),
    date: match.string('kickoffDate'),
    ...optionalField('time', time === NO_TIME ? undefined : time),
    home: mapParticipant(match.object('homeTeam')),
    away: mapParticipant(match.object('guestTeam')),
    status: mapStatus(match),
  };
}

function requiredLeagueId(
  match: DbbObject,
  leagueId: LeagueId | undefined
): LeagueId {
  if (leagueId === undefined) {
    throw shapeError(`${match.path}.ligaData`, 'an object', undefined);
  }
  return leagueId;
}

function mapStatus(match: DbbObject): GameStatus {
  if (match.optionalBoolean('abgesagt')) {
    return { kind: 'cancelled' };
  }
  const result = mapResult(match);
  if (match.optionalBoolean('verzicht')) {
    return {
      kind: 'forfeited',
      forfeitedBy: forfeitedSides(match),
      ...optionalField('result', result),
    };
  }
  if (result !== undefined) {
    return {
      kind: 'played',
      result,
      confirmed: match.optionalBoolean('ergebnisbestaetigt'),
    };
  }
  return { kind: 'scheduled' };
}

function forfeitedSides(match: DbbObject): readonly GameSide[] {
  const sides: GameSide[] = [];
  if (match.object('homeTeam').optionalBoolean('verzicht')) {
    sides.push('home');
  }
  if (match.object('guestTeam').optionalBoolean('verzicht')) {
    sides.push('away');
  }
  return sides;
}

function mapResult(match: DbbObject): Score | undefined {
  const result = match.optionalString('result');
  if (result === undefined || !HAS_DIGIT.test(result)) {
    return undefined;
  }
  const parts = RESULT.exec(result);
  if (parts === null) {
    throw shapeError(`${match.path}.result`, 'a result like "57:94"', result);
  }
  return { home: Number(parts[1]), away: Number(parts[2]) };
}
