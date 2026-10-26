import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The composite queries the game and the functions (`bacteria-wars-functions`)
 * run, against the indexes the release deploys (`../firestore.indexes.json`):
 * the emulator never asks for an index, production refuses the query. The
 * spec sits beside the file, so a change to the indexes alone runs it. The
 * functions keep their queries in `firestore-queries.json`, read here too,
 * and check them in a spec of their own, which a change to them runs.
 */
interface Field {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}
/** A collection group query needs an index of that scope. */
type Scope = 'COLLECTION' | 'COLLECTION_GROUP';
type Queries = Record<
  string,
  { group: string; scope?: Scope; fields: Field[] }
>;
const read = (path: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, path), 'utf8'));
const { indexes } = read('../firestore.indexes.json') as {
  indexes: { collectionGroup: string; queryScope: Scope; fields: Field[] }[];
};

const GAME_QUERIES: Queries = {
  // The game's "My matches": its own replays, newest first.
  'replays of a player': {
    group: 'replays',
    fields: [
      { fieldPath: 'players', arrayConfig: 'CONTAINS' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  // The game's leaderboards (ADR 0012): a page below the top 50, status in
  // the visible ones, `startAfter` the last row (the document id follows
  // `atHour` in the index's direction) ...
  'board page': {
    group: 'entries',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'sort', order: 'DESCENDING' },
      { fieldPath: 'atHour', order: 'ASCENDING' },
    ],
  },
  // ... and the player's own position: count() of the visible entries
  // with a higher sort, ordered alike so the same index serves it.
  'own rank count': {
    group: 'entries',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'sort', order: 'DESCENDING' },
      { fieldPath: 'atHour', order: 'ASCENDING' },
    ],
  },
  // The admin area's audit (ADR 0012): a player's entries, and a type's.
  'audit entries of a player': {
    group: 'adminAudit',
    fields: [
      { fieldPath: 'target.uid', order: 'ASCENDING' },
      { fieldPath: 'at', order: 'DESCENDING' },
    ],
  },
  'audit entries of a type': {
    group: 'adminAudit',
    fields: [
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'at', order: 'DESCENDING' },
    ],
  },
  // The admin area's uploaded pictures, newest first.
  'profiles with an uploaded picture': {
    group: 'profiles',
    fields: [
      { fieldPath: 'avatar.kind', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
  },
  // The admin area's Balance view: a balance version, by level.
  'level statistics of a balance version': {
    group: 'levelStats',
    fields: [
      { fieldPath: 'balanceVersion', order: 'ASCENDING' },
      { fieldPath: 'level', order: 'ASCENDING' },
    ],
  },
};
const FUNCTION_QUERIES = read(
  '../../bacteria-wars-functions/src/firestore-queries.json'
) as Queries;

/** The client code that queries Firestore: the game and the admin area. */
const CLIENT_SOURCES = [
  '../../../libs/features/lazy/bacteria-game/src',
  '../../../libs/features/lazy/bacteria-wars-admin/src',
];
/**
 * An order on the document id alone, descending: production wants an
 * index on `__name__` for it, which `firestore.indexes.json` does not
 * hold and the release does not create, while the emulator answers it.
 */
const ID_DESCENDING = /orderBy\(\s*\w+\.documentId\(\),\s*'desc'\s*\)/;

function sourcesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /(?<!\.spec)\.ts$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe('firestore.indexes.json', () => {
  it('serves no client query ordered by the document id, descending', () => {
    const offenders = CLIENT_SOURCES.flatMap((dir) =>
      sourcesIn(join(__dirname, dir))
    ).filter((file) => ID_DESCENDING.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  for (const [name, query] of Object.entries({
    ...GAME_QUERIES,
    ...FUNCTION_QUERIES,
  })) {
    it(`has the index for ${name}`, () => {
      expect(indexes).toContainEqual(
        expect.objectContaining({
          collectionGroup: query.group,
          queryScope: query.scope ?? 'COLLECTION',
          fields: query.fields,
        })
      );
    });
  }
});
