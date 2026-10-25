import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The composite queries the functions (`bacteria-wars-functions`) and the
 * game run, against the indexes the release deploys
 * (`../firestore.indexes.json`): the emulator never asks for an index,
 * production refuses the query. The spec sits beside the file, so a change
 * to the indexes alone runs it.
 */
interface Field {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}
const { indexes } = JSON.parse(
  readFileSync(join(__dirname, '../firestore.indexes.json'), 'utf8')
) as { indexes: { collectionGroup: string; fields: Field[] }[] };

const QUERIES: Record<string, { group: string; fields: Field[] }> = {
  // The game's "My matches": its own replays, newest first.
  'replays of a player': {
    group: 'replays',
    fields: [
      { fieldPath: 'players', arrayConfig: 'CONTAINS' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  // featureBest and the hourly "Not reported" sweep.
  'replays by state and age': {
    group: 'replays',
    fields: [
      { fieldPath: 'state', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'ASCENDING' },
    ],
  },
  // rebuildTop, the board pages and a player's own rank (count()).
  'visible entries in board order': {
    group: 'entries',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'sort', order: 'DESCENDING' },
      { fieldPath: 'atHour', order: 'ASCENDING' },
    ],
  },
};

describe('firestore.indexes.json', () => {
  for (const [name, query] of Object.entries(QUERIES)) {
    it(`has the index for ${name}`, () => {
      expect(indexes).toContainEqual(
        expect.objectContaining({
          collectionGroup: query.group,
          fields: query.fields,
        })
      );
    });
  }
});
