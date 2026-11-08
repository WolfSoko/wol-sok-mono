import type { LigaId } from '../domain/ids';
import type {
  Spiel,
  SpielSeite,
  SpielStatus,
  Spielstand,
} from '../domain/spiel';
import { shapeError, type DbbObject } from './dbb-object';
import { mapSpielPartei } from './map-team';
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
export function mapSpiel(match: DbbObject, ligaId?: LigaId): Spiel {
  const uhrzeit = match.optionalString('kickoffTime');
  return {
    id: match.number('matchId'),
    ligaId:
      match.optionalObject('ligaData')?.number('ligaId') ??
      requiredLigaId(match, ligaId),
    spieltag: match.number('matchDay'),
    datum: match.string('kickoffDate'),
    ...optionalField('uhrzeit', uhrzeit === NO_TIME ? undefined : uhrzeit),
    heim: mapSpielPartei(match.object('homeTeam')),
    gast: mapSpielPartei(match.object('guestTeam')),
    status: mapStatus(match),
  };
}

function requiredLigaId(match: DbbObject, ligaId: LigaId | undefined): LigaId {
  if (ligaId === undefined) {
    throw shapeError(`${match.path}.ligaData`, 'an object', undefined);
  }
  return ligaId;
}

function mapStatus(match: DbbObject): SpielStatus {
  if (match.optionalBoolean('abgesagt')) {
    return { art: 'abgesagt' };
  }
  const ergebnis = mapErgebnis(match);
  if (match.optionalBoolean('verzicht')) {
    return {
      art: 'kampflos',
      verzichtet: verzichteteSeiten(match),
      ...optionalField('ergebnis', ergebnis),
    };
  }
  if (ergebnis !== undefined) {
    return {
      art: 'gespielt',
      ergebnis,
      bestaetigt: match.optionalBoolean('ergebnisbestaetigt'),
    };
  }
  return { art: 'geplant' };
}

function verzichteteSeiten(match: DbbObject): readonly SpielSeite[] {
  const seiten: SpielSeite[] = [];
  if (match.object('homeTeam').optionalBoolean('verzicht')) {
    seiten.push('heim');
  }
  if (match.object('guestTeam').optionalBoolean('verzicht')) {
    seiten.push('gast');
  }
  return seiten;
}

function mapErgebnis(match: DbbObject): Spielstand | undefined {
  const result = match.optionalString('result');
  if (result === undefined || !HAS_DIGIT.test(result)) {
    return undefined;
  }
  const parts = RESULT.exec(result);
  if (parts === null) {
    throw shapeError(`${match.path}.result`, 'a result like "57:94"', result);
  }
  return { heim: Number(parts[1]), gast: Number(parts[2]) };
}
