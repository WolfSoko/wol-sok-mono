import { parseIndexedClubs } from './indexed-clubs';

const NIEDERSACHSEN = { id: 7, name: 'Niedersachsen' };
const WASBUETTEL = {
  id: 1837,
  name: 'MTV Wasbüttel',
  associations: [NIEDERSACHSEN],
};

describe('parseIndexedClubs', () => {
  it('reads the Clubs of the answer', () => {
    expect(parseIndexedClubs([WASBUETTEL])).toEqual([WASBUETTEL]);
  });

  it('reads an empty index', () => {
    expect(parseIndexedClubs([])).toEqual([]);
  });

  it('keeps only the fields a Club has', () => {
    expect(
      parseIndexedClubs([
        {
          ...WASBUETTEL,
          extra: 'x',
          associations: [{ ...NIEDERSACHSEN, extra: 1 }],
        },
      ])
    ).toEqual([WASBUETTEL]);
  });

  it.each([
    ['no id', { name: 'TV', associations: [] }],
    ['an id that is no DBB id', { id: -1, name: 'TV', associations: [] }],
    ['an empty name', { id: 1, name: ' ', associations: [] }],
    ['no associations', { id: 1, name: 'TV' }],
    ['an odd association', { id: 1, name: 'TV', associations: [{ id: 2 }] }],
    ['no object', 'TV'],
  ])('drops an entry with %s', (_, entry) => {
    expect(parseIndexedClubs([entry, WASBUETTEL])).toEqual([WASBUETTEL]);
  });

  it.each([{}, null, 'clubs'])(
    'rejects an answer that is no list (%j)',
    (body) => {
      expect(() => parseIndexedClubs(body)).toThrow(
        expect.objectContaining({ kind: 'unexpected-shape' })
      );
    }
  );
});
