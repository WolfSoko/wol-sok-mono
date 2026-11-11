import type { Venue } from '../domain/venue';
import type { GameDetails, Score } from '../domain/game';
import { DbbObject } from './dbb-object';
import { mapLeague } from './map-league';
import { mapGame } from './map-game';
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
export function mapGameDetails(data: unknown): GameDetails {
  const match = DbbObject.of(data, 'matchInfo');
  const result = match.optionalObject('matchResult');
  const venue = mapVenue(
    match.optionalObject('matchInfo')?.optionalObject('spielfeld')
  );
  return {
    game: mapGame(match),
    league: mapLeague(match.object('ligaData')),
    ...optionalField('venue', venue),
    quarters: result === undefined ? [] : allPeriods(result, QUARTERS),
    overtimes: result === undefined ? [] : recordedPeriods(result, OVERTIMES),
  };
}

/** The periods, or none while any of them is not recorded. */
function allPeriods(result: DbbObject, fields: PeriodFields): readonly Score[] {
  const periods = fields.map((pair) => period(result, pair));
  return periods.every(isScore) ? periods : [];
}

/** The periods that were played, in order. */
function recordedPeriods(
  result: DbbObject,
  fields: PeriodFields
): readonly Score[] {
  return fields.map((pair) => period(result, pair)).filter(isScore);
}

function period(
  result: DbbObject,
  [homeKey, awayKey]: readonly [string, string]
): Score | undefined {
  const home = result.optionalNumber(homeKey);
  const away = result.optionalNumber(awayKey);
  return home === undefined || away === undefined ? undefined : { home, away };
}

function isScore(score: Score | undefined): score is Score {
  return score !== undefined;
}

function mapVenue(court: DbbObject | undefined): Venue | undefined {
  if (court === undefined) {
    return undefined;
  }
  return {
    name: court.string('bezeichnung').trim(),
    ...optionalField('street', presentText(court, 'strasse')),
    ...optionalField('postcode', presentText(court, 'plz')),
    ...optionalField('town', presentText(court, 'ort')),
  };
}

function presentText(object: DbbObject, key: string): string | undefined {
  return object.optionalString(key)?.trim() || undefined;
}
