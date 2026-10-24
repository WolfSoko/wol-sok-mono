import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The emulator does not enforce composite indexes, so every query of ADR
 * 0011 and ADR 0012 that needs one is listed here with the index it needs,
 * and checked against `apps/bacteria-game-remote/firestore.indexes.json`.
 * Add a query here with the code that runs it.
 */

interface IndexField {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}

interface Index {
  collectionGroup: string;
  queryScope: string;
  fields: IndexField[];
}

interface FieldOverride {
  collectionGroup: string;
  fieldPath: string;
  ttl?: boolean;
  indexes: unknown[];
}

const config = JSON.parse(
  readFileSync(
    join(__dirname, '../../bacteria-game-remote/firestore.indexes.json'),
    'utf8'
  )
) as { indexes: Index[]; fieldOverrides: FieldOverride[] };

const asc = (fieldPath: string): IndexField => ({
  fieldPath,
  order: 'ASCENDING',
});
const desc = (fieldPath: string): IndexField => ({
  fieldPath,
  order: 'DESCENDING',
});
const contains = (fieldPath: string): IndexField => ({
  fieldPath,
  arrayConfig: 'CONTAINS',
});

/** Each query by where it runs, and the composite index it needs. */
const QUERIES: [string, string, IndexField[]][] = [
  [
    'My matches: players array-contains uid, newest first',
    'replays',
    [contains('players'), desc('createdAt')],
  ],
  [
    'featureBest: state in, createdAt range',
    'replays',
    [asc('state'), asc('createdAt')],
  ],
  [
    'publicSite gallery: removedAt == null, newest featured first',
    'publicReplays',
    [asc('removedAt'), desc('featuredAt')],
  ],
  [
    'publicSite best: balanceVersion ==, score desc',
    'publicReplays',
    [asc('balanceVersion'), desc('score')],
  ],
  [
    'profileChanged: uids array-contains, removedAt == null',
    'publicReplays',
    [contains('uids'), asc('removedAt')],
  ],
  [
    'takeDown: replayId ==, removedAt == null',
    'publicReplays',
    [asc('replayId'), asc('removedAt')],
  ],
  [
    'board pages and own rank: status in, sort desc, atHour',
    'entries',
    [asc('status'), desc('sort'), asc('atHour')],
  ],
  [
    'admin profiles with pictures: avatar.kind ==, newest first',
    'profiles',
    [asc('avatar.kind'), desc('updatedAt')],
  ],
  ['admin audit of a player', 'adminAudit', [asc('target.uid'), desc('at')]],
  ['admin audit by type', 'adminAudit', [asc('type'), desc('at')]],
  ['statistics: matches running', 'rooms', [asc('taken'), asc('expireAt')]],
];

describe('firestore.indexes.json', () => {
  it.each(QUERIES)('serves %s', (_, collectionGroup, fields) => {
    expect(config.indexes).toContainEqual({
      collectionGroup,
      queryScope: 'COLLECTION',
      fields,
    });
  });

  it('holds no index no query needs', () => {
    expect(config.indexes).toHaveLength(QUERIES.length);
  });

  it.each([
    'rooms',
    'invites',
    'challenges',
    'queue',
    'replays',
    // A replay's blob and reports carry its expireAt: TTL deletes no
    // subcollection with its parent.
    'blob',
    'reports',
    'replaySubmissions',
    'replayCommands',
    'attempts',
    'notices',
    'boards',
    'entries',
    'dailyRuns',
    'endlessRuns',
    'pairs',
    'rankedReplays',
    'rankedRooms',
    'adminCommands',
    'adminStats',
    'adminAudit',
    'banTombstones',
  ])('expires %s by TTL on expireAt', (collectionGroup) => {
    expect(config.fieldOverrides).toContainEqual(
      expect.objectContaining({
        collectionGroup,
        fieldPath: 'expireAt',
        ttl: true,
      })
    );
  });

  it('indexes rooms.expireAt again, for counting the open rooms', () => {
    const rooms = config.fieldOverrides.find(
      (override) => override.collectionGroup === 'rooms'
    );
    expect(rooms?.indexes).toContainEqual({
      order: 'ASCENDING',
      queryScope: 'COLLECTION',
    });
  });
});
