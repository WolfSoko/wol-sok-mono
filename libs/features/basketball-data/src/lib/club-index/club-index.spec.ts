import { clubFinder, mergeAssociationClubs } from './club-index';
import type { AssociationClubs, IndexedClub } from './club-index';

const BAYERN = { id: 2, name: 'Bayern' };
const NIEDERSACHSEN = { id: 7, name: 'Niedersachsen' };
const REGIONALLIGA = { id: 30, name: 'Regionalliga Südost' };

const WASBUETTEL: IndexedClub = {
  id: 1837,
  name: 'MTV Wasbüttel',
  associations: [NIEDERSACHSEN],
};
const POST_SV: IndexedClub = {
  id: 1476,
  name: 'Post SV Nürnberg',
  associations: [BAYERN],
};
const STRASSBURG: IndexedClub = {
  id: 9,
  name: 'TV Großstraße',
  associations: [BAYERN],
};
const INDEX = [WASBUETTEL, POST_SV, STRASSBURG];

describe('clubFinder', () => {
  const find = clubFinder(INDEX);

  it.each(['wasbuttel', 'Wasbüttel', 'mtv was', '  MTV   wasbüttel '])(
    'finds MTV Wasbüttel for %j',
    (term) => {
      expect(find(term)).toEqual([WASBUETTEL]);
    }
  );

  it('finds a name by every word, in any order', () => {
    expect(find('nurnberg post')).toEqual([POST_SV]);
  });

  it('folds ß and diacritics on both sides', () => {
    expect(find('grossstrasse')).toEqual([STRASSBURG]);
    expect(find('Großstraße')).toEqual([STRASSBURG]);
  });

  it('finds nothing for an empty term', () => {
    expect(find('')).toEqual([]);
    expect(find('   ')).toEqual([]);
  });

  it('finds nothing when one word is missing', () => {
    expect(find('post bamberg')).toEqual([]);
  });

  it('keeps the order of the index', () => {
    expect(find('tv')).toEqual([WASBUETTEL, STRASSBURG]);
  });

  it('finds nothing in an empty index', () => {
    expect(clubFinder([])('post')).toEqual([]);
  });
});

describe('mergeAssociationClubs', () => {
  function list(
    association: AssociationClubs['association'],
    clubs: AssociationClubs['clubs']
  ): AssociationClubs {
    return { association, clubs, updatedAt: 0 };
  }

  it('lists each club once, by name, with every association it plays in, by name', () => {
    const merged = mergeAssociationClubs([
      list(REGIONALLIGA, [{ id: 1476, name: 'Post SV Nürnberg' }]),
      list(BAYERN, [
        { id: 1476, name: 'Post SV Nürnberg' },
        { id: 1932, name: 'Freak City Bamberg' },
      ]),
      list(NIEDERSACHSEN, [{ id: 1837, name: 'MTV Wasbüttel' }]),
    ]);

    expect(merged).toEqual([
      { id: 1932, name: 'Freak City Bamberg', associations: [BAYERN] },
      { id: 1837, name: 'MTV Wasbüttel', associations: [NIEDERSACHSEN] },
      {
        id: 1476,
        name: 'Post SV Nürnberg',
        associations: [BAYERN, REGIONALLIGA],
      },
    ]);
  });

  it('takes the name of the most recently updated list where they differ', () => {
    const merged = mergeAssociationClubs([
      { ...list(BAYERN, [{ id: 1, name: 'Neu' }]), updatedAt: 2 },
      { ...list(REGIONALLIGA, [{ id: 1, name: 'Alt' }]), updatedAt: 1 },
    ]);

    expect(merged.map(({ name }) => name)).toEqual(['Neu']);
  });

  it("prefers a Club's own name to a Team's that stood in for it", () => {
    const merged = mergeAssociationClubs([
      {
        ...list(BAYERN, [{ id: 1, name: 'Post SV 2', nameFromTeam: true }]),
        updatedAt: 2,
      },
      { ...list(REGIONALLIGA, [{ id: 1, name: 'Post SV' }]), updatedAt: 1 },
    ]);

    expect(merged).toEqual([
      { id: 1, name: 'Post SV', associations: [BAYERN, REGIONALLIGA] },
    ]);
  });

  it('gives an empty list for no lists', () => {
    expect(mergeAssociationClubs([])).toEqual([]);
  });
});
