import type { Halle } from '../domain/halle';
import type { SpielDetails, Spielstand } from '../domain/spiel';
import { DbbObject } from './dbb-object';
import { mapLiga } from './map-liga';
import { mapSpiel } from './map-spiel';
import { optionalField } from './optional-field';

/**
 * The DBB's fields of each quarter's points, home and guest. They hold the
 * quarter's own points, not running totals: `Halbzeitstand` is the second
 * quarter's.
 */
const QUARTERS = [
  ['heimV1stand', 'gastV1stand'],
  ['heimHalbzeitstand', 'gastHalbzeitstand'],
  ['heimV3stand', 'gastV3stand'],
  ['heimV4stand', 'gastV4stand'],
] as const;

const OVERTIMES = [
  ['heimOt1stand', 'gastOt1stand'],
  ['heimOt2stand', 'gastOt2stand'],
] as const;

type PeriodFields = readonly (readonly [string, string])[];

/** A Spiel with its Liga, Halle and periods (`match/id/{id}/matchInfo`). */
export function mapSpielDetails(data: unknown): SpielDetails {
  const match = DbbObject.of(data, 'matchInfo');
  const result = match.optionalObject('matchResult');
  const halle = mapHalle(
    match.optionalObject('matchInfo')?.optionalObject('spielfeld')
  );
  return {
    spiel: mapSpiel(match),
    liga: mapLiga(match.object('ligaData')),
    ...optionalField('halle', halle),
    viertel: result === undefined ? [] : allPeriods(result, QUARTERS),
    verlaengerungen:
      result === undefined ? [] : recordedPeriods(result, OVERTIMES),
  };
}

/** The periods, or none while any of them is not recorded. */
function allPeriods(
  result: DbbObject,
  fields: PeriodFields
): readonly Spielstand[] {
  const periods = fields.map((pair) => period(result, pair));
  return periods.every(isSpielstand) ? periods : [];
}

/** The periods that were played, in order. */
function recordedPeriods(
  result: DbbObject,
  fields: PeriodFields
): readonly Spielstand[] {
  return fields.map((pair) => period(result, pair)).filter(isSpielstand);
}

function period(
  result: DbbObject,
  [heimKey, gastKey]: readonly [string, string]
): Spielstand | undefined {
  const heim = result.optionalNumber(heimKey);
  const gast = result.optionalNumber(gastKey);
  return heim === undefined || gast === undefined ? undefined : { heim, gast };
}

function isSpielstand(stand: Spielstand | undefined): stand is Spielstand {
  return stand !== undefined;
}

function mapHalle(spielfeld: DbbObject | undefined): Halle | undefined {
  if (spielfeld === undefined) {
    return undefined;
  }
  return {
    name: spielfeld.string('bezeichnung').trim(),
    ...optionalField('strasse', presentText(spielfeld, 'strasse')),
    ...optionalField('plz', presentText(spielfeld, 'plz')),
    ...optionalField('ort', presentText(spielfeld, 'ort')),
  };
}

function presentText(object: DbbObject, key: string): string | undefined {
  return object.optionalString(key)?.trim() || undefined;
}
