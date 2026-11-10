import {
  BasketballDataError,
  clubFinder,
  type IndexedClub,
} from '@wolsok/feat-shared-basketball-data';
import { VEREINSLISTE_NICHT_ERREICHBAR } from '../fehler/fehler-text';
import { clubSearchView, MAX_CLUB_HITS } from './club-search-view';

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
