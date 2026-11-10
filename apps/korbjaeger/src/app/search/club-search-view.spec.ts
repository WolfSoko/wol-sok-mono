import {
  BasketballDataError,
  clubFinder,
  type IndexedClub,
} from '@wolsok/feat-shared-basketball-data';
import { VEREINSLISTE_NICHT_ERREICHBAR } from '../fehler/fehler-text';
import {
  clubSearchStatus,
  clubSearchView,
  MAX_CLUB_HITS,
  type ClubSearchView,
} from './club-search-view';

const BAYERN = { id: 2, name: 'Bayern' };
const REGIONALLIGA = { id: 30, name: 'Regionalliga Südost' };
const POST_SV: IndexedClub = {
  id: 1476,
  name: 'Post SV Nürnberg',
  associations: [BAYERN, REGIONALLIGA],
};
const find = clubFinder([POST_SV]);

describe('clubSearchView', () => {
  it('waits for a term of two characters', () => {
    expect(clubSearchView({ find, error: undefined, term: '' })).toEqual({
      kind: 'typing',
      tooShort: false,
    });
    expect(clubSearchView({ find, error: undefined, term: ' p ' })).toEqual({
      kind: 'typing',
      tooShort: true,
    });
  });

  it('loads until the list is there', () => {
    expect(
      clubSearchView({ find: undefined, error: undefined, term: 'post' })
    ).toEqual({ kind: 'loading' });
  });

  it('says why the list failed, whatever is typed', () => {
    expect(
      clubSearchView({
        find: undefined,
        error: new BasketballDataError('unavailable', 'x'),
        term: '',
      })
    ).toEqual({ kind: 'failed', text: VEREINSLISTE_NICHT_ERREICHBAR });
  });

  it('lists the matches with their Verbände', () => {
    expect(
      clubSearchView({ find, error: undefined, term: 'nurnberg' })
    ).toEqual({
      kind: 'hits',
      hits: [
        {
          id: 1476,
          name: 'Post SV Nürnberg',
          associations: 'Bayern · Regionalliga Südost',
        },
      ],
      more: false,
    });
  });

  it('lists no more than the first matches and says there are more', () => {
    const many = Array.from(
      { length: MAX_CLUB_HITS + 1 },
      (_, at): IndexedClub => ({
        id: at + 1,
        name: `TSV ${at}`,
        associations: [BAYERN],
      })
    );

    const view = clubSearchView({
      find: clubFinder(many),
      error: undefined,
      term: 'tsv',
    });

    expect(view).toMatchObject({ kind: 'hits', more: true });
    expect(view.kind === 'hits' && view.hits.length).toBe(MAX_CLUB_HITS);
  });

  it('lists nothing for a term no Verein matches', () => {
    expect(clubSearchView({ find, error: undefined, term: 'xyz' })).toEqual({
      kind: 'hits',
      hits: [],
      more: false,
    });
  });
});

describe('clubSearchStatus', () => {
  const hits = (count: number, more = false): ClubSearchView => ({
    kind: 'hits',
    hits: Array.from({ length: count }, (_, at) => ({
      id: at + 1,
      name: `TSV ${at}`,
      associations: 'Bayern',
    })),
    more,
  });

  it.each<[string, ClubSearchView, string]>([
    ['nothing typed', { kind: 'typing', tooShort: false }, ''],
    [
      'too little typed',
      { kind: 'typing', tooShort: true },
      'Bitte mindestens zwei Zeichen eingeben.',
    ],
    ['the list loading', { kind: 'loading' }, ''],
    ['the list failed', { kind: 'failed', text: 'x' }, ''],
    [
      'no match',
      hits(0),
      'Kein Verein gefunden. Bitte anders schreiben oder kürzer eingeben.',
    ],
    ['one match', hits(1), 'Ein Verein gefunden.'],
    ['matches', hits(3), '3 Vereine gefunden.'],
    [
      'too many matches',
      hits(MAX_CLUB_HITS, true),
      `Mehr als ${MAX_CLUB_HITS} Vereine gefunden. Bitte genauer eingeben.`,
    ],
  ])('says what fits %s', (_case, view, text) => {
    expect(clubSearchStatus(view)).toBe(text);
  });
});
