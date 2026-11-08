import type {
  Facette,
  LigaSeite,
  LigaSuche,
  LigaSucheFacetten,
} from '../domain/liga-suche';
import { DbbObject, shapeError } from './dbb-object';
import { mapLiga } from './map-liga';

const AKG_GESCHLECHTER: Readonly<Record<string, string>> = {
  m: 'männlich',
  w: 'weiblich',
};

/** The facets and first page of the DBB's Liga search (`wam/data`). */
export function mapLigaSuche(data: unknown): LigaSuche {
  const suche = DbbObject.of(data, 'wam');
  return {
    facetten: mapFacetten(suche),
    ersteSeite: mapLigaListe(suche.object('ligaListe')),
  };
}

/** One page of the DBB's Liga list (`wam/liga/list`). */
export function mapLigaSeite(data: unknown): LigaSeite {
  return mapLigaListe(DbbObject.of(data, 'ligaListe'));
}

function mapLigaListe(liste: DbbObject): LigaSeite {
  return {
    startIndex: liste.number('startAtIndex'),
    ligen: liste.optionalObjects('ligen').map(mapLiga),
    weitere: liste.boolean('hasMoreData'),
  };
}

function mapFacetten(suche: DbbObject): LigaSucheFacetten {
  return {
    verbaende: suche.optionalObjects('verbaende').map(mapFacette),
    altersklassen: suche.optionalObjects('altersklassen').map(mapFacette),
    altersgruppenGeschlechter: suche
      .optionalObjects('agkGeschlechtList')
      .map(mapAltersgruppeGeschlecht),
  };
}

function mapFacette(facette: DbbObject): Facette<number> {
  return {
    id: facette.number('id'),
    name: facette.string('label'),
    treffer: facette.number('hits'),
  };
}

function mapAltersgruppeGeschlecht(facette: DbbObject): Facette<string> {
  const kurz = facette.string('geschlecht');
  const geschlecht = AKG_GESCHLECHTER[kurz];
  if (geschlecht === undefined) {
    throw shapeError(`${facette.path}.geschlecht`, 'm or w', kurz);
  }
  return {
    id: facette.string('id'),
    name: `${facette.string('akg')} ${geschlecht}`,
    treffer: facette.number('hits'),
  };
}
