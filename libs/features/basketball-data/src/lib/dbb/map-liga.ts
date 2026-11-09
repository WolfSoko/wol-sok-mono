import type { Geschlecht } from '../domain/geschlecht';
import type { Liga } from '../domain/liga';
import type { Saison } from '../domain/saison';
import { shapeError, type DbbObject } from './dbb-object';
import { optionalField } from './optional-field';
import { ownValue } from './own-value';

/** The DBB's `statisticType` of a Liga it keeps no Spielberichte for. */
const NO_STATISTICS = 0;

const GESCHLECHTER: Readonly<Record<string, Geschlecht>> = {
  männlich: 'männlich',
  weiblich: 'weiblich',
  mix: 'mix',
};

/** A Liga from the DBB's `ligaData`, as every endpoint carries it. */
export function mapLiga(ligaData: DbbObject): Liga {
  const bezirk = ligaData.optionalString('bezirkName');
  const saison = mapSaison(ligaData);
  return {
    id: ligaData.number('ligaId'),
    name: ligaData.string('liganame').trim(),
    verband: {
      id: ligaData.number('verbandId'),
      name: ligaData.string('verbandName'),
    },
    altersklasse: ligaData.string('akName'),
    geschlecht: mapGeschlecht(ligaData, 'geschlecht'),
    spielklasse: ligaData.string('skName'),
    ...optionalField('bezirk', bezirk),
    ...optionalField('saison', saison),
    ...(keepsNoSpielberichte(ligaData) ? { ohneSpielberichte: true } : {}),
  };
}

function keepsNoSpielberichte(ligaData: DbbObject): boolean {
  return ligaData.optionalNumber('statisticType') === NO_STATISTICS;
}

function mapSaison(ligaData: DbbObject): Saison | undefined {
  const id = ligaData.optionalNumber('seasonId');
  const name = ligaData.optionalString('seasonName');
  return id === undefined || name === undefined ? undefined : { id, name };
}

function mapGeschlecht(object: DbbObject, key: string): Geschlecht {
  const text = object.string(key);
  const geschlecht = ownValue(GESCHLECHTER, text);
  if (geschlecht === undefined) {
    throw shapeError(
      `${object.path}.${key}`,
      'männlich, weiblich or mix',
      text
    );
  }
  return geschlecht;
}
