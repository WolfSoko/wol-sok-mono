import { parseIndexedClubs } from './indexed-clubs';

const BAYERN = { id: 2, name: 'Bayern' };
const POST_SV = { id: 1476, name: 'Post SV Nürnberg', associations: [BAYERN] };

describe('parseIndexedClubs', () => {
  it('reads the index the club route serves', () => {
    expect(parseIndexedClubs([POST_SV])).toEqual([POST_SV]);
    expect(parseIndexedClubs([])).toEqual([]);
  });

  it('keeps only the fields of a Club and its Associations', () => {
    expect(
      parseIndexedClubs([
        {
          ...POST_SV,
          extra: 'x',
          associations: [{ ...BAYERN, extra: 'y' }],
        },
      ])
    ).toEqual([POST_SV]);
  });

  it.each([
    ['no list', { clubs: [] }],
    ['an id that is no DBB id', [{ ...POST_SV, id: -1 }]],
    ['a name that is no text', [{ ...POST_SV, name: 7 }]],
    ['an empty name', [{ ...POST_SV, name: '  ' }]],
    ['no Associations', [{ id: 1476, name: 'Post SV Nürnberg' }]],
    [
      'an Association without a name',
      [{ ...POST_SV, associations: [{ id: 2 }] }],
    ],
  ])('reads nothing from %s', (_case, body) => {
    expect(parseIndexedClubs(body)).toBeUndefined();
  });
});
