import type { Gender } from '../domain/gender';
import type { League } from '../domain/league';
import type { Season } from '../domain/season';
import { shapeError, type DbbObject } from './dbb-object';
import { optionalField } from './optional-field';
import { ownValue } from './own-value';

/** The DBB's `statisticType` of a Liga it keeps no Spielberichte for. */
const NO_STATISTICS = 0;

/**
 * The DBB's Verband „Bundesligen". Within it, a men's Liga without
 * Spielberichte is one of the professional leagues (BBL, ProA, ProB,
 * BBL-Pokal), whose results the DBB never confirms (#2953: 0 of 262
 * confirmed). Its women's and youth Ligen and such Ligen of other Verbände
 * confirm theirs.
 */
const BUNDESLIGA_ASSOCIATION = 100;

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
  const gender = mapGender(ligaData, 'geschlecht');
  const withoutGameReports = keepsNoGameReports(ligaData);
  return {
    id: ligaData.number('ligaId'),
    name: ligaData.string('liganame').trim(),
    association: { id: associationId, name: ligaData.string('verbandName') },
    ageGroup: ligaData.string('akName'),
    gender,
    division: ligaData.string('skName'),
    ...optionalField('district', district),
    ...optionalField('season', season),
    ...(withoutGameReports ? { withoutGameReports: true } : {}),
    ...(withoutGameReports && isMensProfessionalLeague(associationId, gender)
      ? { resultsNeverConfirmed: true }
      : {}),
  };
}

function keepsNoGameReports(ligaData: DbbObject): boolean {
  return ligaData.optionalNumber('statisticType') === NO_STATISTICS;
}

/** Whether a Liga without Spielberichte is a men's professional league. */
function isMensProfessionalLeague(
  associationId: number,
  gender: Gender
): boolean {
  return associationId === BUNDESLIGA_ASSOCIATION && gender === 'male';
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
