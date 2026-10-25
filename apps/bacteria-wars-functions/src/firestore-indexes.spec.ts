import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The composite queries the functions run (`firestore-queries.json`, beside
 * this spec) against the indexes the release deploys
 * (`apps/bacteria-game-remote/firestore.indexes.json`): the emulator never
 * asks for an index, production refuses the query. A change to the
 * functions runs this spec; a change to the indexes runs the remote's
 * `firestore-indexes.spec.ts`, which checks the same list.
 */
interface Field {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}
const read = (path: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, path), 'utf8'));
const { indexes } = read(
  '../../bacteria-game-remote/firestore.indexes.json'
) as { indexes: { collectionGroup: string; fields: Field[] }[] };
const queries = read('firestore-queries.json') as Record<
  string,
  { group: string; fields: Field[] }
>;

describe("the functions' composite queries", () => {
  for (const [name, query] of Object.entries(queries)) {
    it(`have the index for ${name}`, () => {
      expect(indexes).toContainEqual(
        expect.objectContaining({
          collectionGroup: query.group,
          fields: query.fields,
        })
      );
    });
  }
});
