import type { AssociationClubs } from './club-index';
import {
  CLUB_INDEX_VERSION,
  parseAssociationClubs,
  parseAssociationClubsList,
  parseClubIndex,
  storedAssociationClubs,
} from './stored-association-clubs';

const BAYERN: AssociationClubs = {
  association: { id: 2, name: 'Bayern' },
  clubs: [
    { id: 1476, name: 'Post SV Nürnberg' },
    { id: 1932, name: 'Freak City Bamberg 2', nameFromTeam: true },
  ],
  updatedAt: 1_700_000_000_000,
};

describe('the stored club index', () => {
  it('reads back what it stores', () => {
    expect(parseAssociationClubs(storedAssociationClubs(BAYERN))).toEqual(
      BAYERN
    );
  });

  it('stores the version and nothing beyond the fields', () => {
    const club = { id: 1, name: 'A', contact: 'x' };
    const extra: AssociationClubs = { ...BAYERN, clubs: [club] };

    expect(storedAssociationClubs(extra)).toEqual({
      version: CLUB_INDEX_VERSION,
      offered: true,
      association: BAYERN.association,
      clubs: [{ id: 1, name: 'A' }],
      updatedAt: BAYERN.updatedAt,
    });
  });

  it('reads the lists of several documents, skipping one it cannot read', () => {
    expect(
      parseAssociationClubsList([
        storedAssociationClubs(BAYERN),
        { version: 9 },
      ])
    ).toEqual([BAYERN]);
  });

  it.each<[string, unknown]>([
    ['nothing', undefined],
    ['another version', { ...storedAssociationClubs(BAYERN), version: 2 }],
    [
      'no association',
      { ...storedAssociationClubs(BAYERN), association: null },
    ],
    [
      'a club without a name',
      { ...storedAssociationClubs(BAYERN), clubs: [{ id: 1, name: ' ' }] },
    ],
    [
      'a club id that is no DBB id',
      { ...storedAssociationClubs(BAYERN), clubs: [{ id: -1, name: 'A' }] },
    ],
    [
      'clubs that are no list',
      { ...storedAssociationClubs(BAYERN), clubs: {} },
    ],
    ['no time', { ...storedAssociationClubs(BAYERN), updatedAt: 'gestern' }],
    [
      'a stand-in mark that is not true',
      {
        ...storedAssociationClubs(BAYERN),
        clubs: [{ id: 1, name: 'A', nameFromTeam: false }],
      },
    ],
  ])('skips a document with %s', (_case, data) => {
    expect(parseAssociationClubs(data)).toBeUndefined();
  });
});

describe('parseClubIndex', () => {
  const BERLIN: AssociationClubs = {
    association: { id: 3, name: 'Berlin' },
    clubs: [{ id: 700, name: 'ALBA Berlin' }],
    updatedAt: 1_700_000_000_001,
  };

  it('calls an index without documents incomplete', () => {
    expect(parseClubIndex([])).toEqual({ lists: [], complete: false });
  });

  it('calls it complete once every document holds a list, a pending crawl beside one included', () => {
    expect(
      parseClubIndex([
        storedAssociationClubs(BAYERN),
        { ...storedAssociationClubs(BERLIN), attemptedAt: 42 },
      ])
    ).toEqual({ lists: [BAYERN, BERLIN], complete: true });
  });

  it.each([
    ['a Verband noted before its first crawl', { offered: true }],
    ['a first crawl still pending', { offered: true, attemptedAt: 42 }],
    [
      'a list stored before the crawl noted Verbände',
      { ...storedAssociationClubs(BERLIN), offered: undefined },
    ],
    ['a document of another version', { version: 99 }],
  ])('calls it incomplete beside %s', (_case, data) => {
    expect(
      parseClubIndex([storedAssociationClubs(BAYERN), data])
    ).toMatchObject({
      complete: false,
    });
    expect(
      parseClubIndex([storedAssociationClubs(BAYERN), data]).lists
    ).toContainEqual(BAYERN);
  });
});
