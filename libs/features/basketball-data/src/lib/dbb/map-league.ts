import type { Gender } from '../domain/gender';
import type { League } from '../domain/league';
import type { Season } from '../domain/season';
import { shapeError, type DbbObject } from './dbb-object';
import { optionalField } from './optional-field';
import { ownValue } from './own-value';

/** The DBB's `statisticType` of a Liga it keeps no Spielberichte for. */
const NO_STATISTICS = 0;

/**
 * The DBB's Verband „Bundesligen". Its men's Ligen of the age group
 * „Senioren" are the professional leagues (BBL, ProA, ProB, BBL-Pokal),
 * whose results the DBB never confirms (#2953: 0 of 262 confirmed). Its
 * women's and youth Ligen and the Ligen of other Verbände confirm theirs.
 *
 * Checked against every Liga the DBB lists for the Verband
 * (`wam/liga/list`, `verbandIds: [100]`) on 2026-11-13 (#3056): its men's
 * Senioren Ligen were exactly those of #2953's survey, all of
 * `statisticType` 0; its other men's Ligen were NBBL and JBBL (U19, U16,
 * `statisticType` 1). Re-check that list when the DBB adds a Liga there.
 */
const BUNDESLIGA_ASSOCIATION = 100;

/** The DBB's `akName` of the adults' age group. */
const SENIOR_AGE_GROUP = 'Senioren';

const GENDERS: Readonly<Record<string, Gender>> = {
  männlich: 'male',
  weiblich: 'female',
  mix: 'mixed',
};

/** A Liga from the DBB's `ligaData`, as every endpoint carries it. */
export function mapLeague(ligaData: DbbObject): League {
  const district = ligaData.optionalString('bezirkName');
  const season = mapSeason(ligaData);
  const associationId = ligaData.number('verbandId');
  const ageGroup = ligaData.string('akName');
  const gender = mapGender(ligaData, 'geschlecht');
  const withoutGameReports = keepsNoGameReports(ligaData);
  return {
    id: ligaData.number('ligaId'),
    name: ligaData.string('liganame').trim(),
    association: { id: associationId, name: ligaData.string('verbandName') },
    ageGroup,
    gender,
    division: ligaData.string('skName'),
    ...optionalField('district', district),
    ...optionalField('season', season),
    ...(withoutGameReports ? { withoutGameReports: true } : {}),
    ...(isMensProfessionalLeague(associationId, ageGroup, gender)
      ? { resultsNeverConfirmed: true }
      : {}),
  };
}

function keepsNoGameReports(ligaData: DbbObject): boolean {
  return ligaData.optionalNumber('statisticType') === NO_STATISTICS;
}

/**
 * Whether a Liga is a men's professional league. Every endpoint's `ligaData`
 * carries these fields, while only a Spiel's details, Spielplan and Tabelle
 * carry `statisticType` (a Team's and a Verein's Spiele and the Liga search
 * send `null`, #3056).
 */
function isMensProfessionalLeague(
  associationId: number,
  ageGroup: string,
  gender: Gender
): boolean {
  return (
    associationId === BUNDESLIGA_ASSOCIATION &&
    ageGroup === SENIOR_AGE_GROUP &&
    gender === 'male'
  );
}

function mapSeason(ligaData: DbbObject): Season | undefined {
  const id = ligaData.optionalNumber('seasonId');
  const name = ligaData.optionalString('seasonName');
  return id === undefined || name === undefined ? undefined : { id, name };
}

function mapGender(object: DbbObject, key: string): Gender {
  const text = object.string(key);
  const gender = ownValue(GENDERS, text);
  if (gender === undefined) {
    throw shapeError(
      `${object.path}.${key}`,
      'männlich, weiblich or mix',
      text
    );
  }
  return gender;
}
