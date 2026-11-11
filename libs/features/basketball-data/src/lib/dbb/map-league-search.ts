import type {
  Facet,
  LeaguePage,
  LeagueSearch,
  LeagueSearchFacets,
} from '../domain/league-search';
import { DbbObject, shapeError } from './dbb-object';
import { mapLeague } from './map-league';
import { ownValue } from './own-value';

const AGE_GROUP_GENDERS: Readonly<Record<string, string>> = {
  m: 'männlich',
  w: 'weiblich',
};

/** The facets and first page of the DBB's Liga search (`wam/data`). */
export function mapLeagueSearch(data: unknown): LeagueSearch {
  const search = DbbObject.of(data, 'wam');
  return {
    facets: mapFacets(search),
    firstPage: mapLeagueList(search.object('ligaListe')),
  };
}

/** One page of the DBB's Liga list (`wam/liga/list`). */
export function mapLeaguePage(data: unknown): LeaguePage {
  return mapLeagueList(DbbObject.of(data, 'ligaListe'));
}

function mapLeagueList(list: DbbObject): LeaguePage {
  return {
    startIndex: list.number('startAtIndex'),
    leagues: list.optionalObjects('ligen').map(mapLeague),
    more: list.boolean('hasMoreData'),
  };
}

function mapFacets(search: DbbObject): LeagueSearchFacets {
  return {
    associations: search.optionalObjects('verbaende').map(mapFacet),
    ageGroups: search.optionalObjects('altersklassen').map(mapFacet),
    ageGroupGenders: search
      .optionalObjects('agkGeschlechtList')
      .map(mapAgeGroupGender),
  };
}

function mapFacet(facet: DbbObject): Facet<number> {
  return {
    id: facet.number('id'),
    name: facet.string('label'),
    hits: facet.number('hits'),
  };
}

function mapAgeGroupGender(facet: DbbObject): Facet<string> {
  const short = facet.string('geschlecht');
  const gender = ownValue(AGE_GROUP_GENDERS, short);
  if (gender === undefined) {
    throw shapeError(`${facet.path}.geschlecht`, 'm or w', short);
  }
  return {
    id: facet.string('id'),
    name: `${facet.string('akg')} ${gender}`,
    hits: facet.number('hits'),
  };
}
