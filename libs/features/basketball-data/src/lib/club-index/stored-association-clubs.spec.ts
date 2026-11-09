import type { AssociationClubs } from './club-index';
import {
  CLUB_INDEX_VERSION,
  parseAssociationClubs,
  storedAssociationClubs,
} from './stored-association-clubs';

const BAYERN: AssociationClubs = {
  association: { id: 2, name: 'Bayern' },
  clubs: [{ id: 1476, name: 'Post SV Nürnberg' }],
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
      association: BAYERN.association,
      clubs: [{ id: 1, name: 'A' }],
      updatedAt: BAYERN.updatedAt,
    });
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
  ])('skips a document with %s', (_case, data) => {
    expect(parseAssociationClubs(data)).toBeUndefined();
  });
});
