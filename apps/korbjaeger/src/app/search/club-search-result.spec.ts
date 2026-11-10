import {
  clubSearch,
  type IndexedClub,
} from '@wolsok/feat-shared-basketball-data';
import { clubSearchResult, MAX_HITS } from './club-search-result';

function club(id: number, name: string): IndexedClub {
  return { id, name, associations: [{ id: 7, name: 'Niedersachsen' }] };
}

const WASBUETTEL = club(1837, 'MTV Wasbüttel');
const INDEX = [WASBUETTEL, club(1476, 'Post SV Nürnberg')];

function resultFor(index: readonly IndexedClub[], term: string) {
  return clubSearchResult(index.length, clubSearch(index), term);
}

describe('clubSearchResult', () => {
  it('lists the Clubs a term matches', () => {
    expect(resultFor(INDEX, 'wasbuttel')).toEqual({
      kind: 'hits',
      clubs: [WASBUETTEL],
      more: false,
    });
  });

  it.each(['', ' ', 'w', ' w '])('waits for a longer term than %j', (term) => {
    expect(resultFor(INDEX, term)).toEqual({ kind: 'too-short' });
  });

  it('says so where nothing matches', () => {
    expect(resultFor(INDEX, 'bamberg')).toEqual({ kind: 'no-hits' });
  });

  it('says the index is still being built while it holds no Club', () => {
    expect(resultFor([], 'wasbuttel')).toEqual({ kind: 'empty-index' });
    expect(resultFor([], '')).toEqual({ kind: 'empty-index' });
  });

  it(`lists at most ${MAX_HITS} Clubs, and says there are more`, () => {
    const many = Array.from({ length: MAX_HITS + 1 }, (_, i) =>
      club(i + 1, `TSV ${String(i).padStart(2, '0')}`)
    );

    const result = resultFor(many, 'tsv');

    expect(result.kind === 'hits' && result.clubs).toEqual(
      many.slice(0, MAX_HITS)
    );
    expect(result.kind === 'hits' && result.more).toBe(true);
  });

  it(`says there are no more at exactly ${MAX_HITS}`, () => {
    const many = Array.from({ length: MAX_HITS }, (_, i) =>
      club(i + 1, `TSV ${i}`)
    );

    const result = resultFor(many, 'tsv');

    expect(result.kind === 'hits' && result.more).toBe(false);
  });
});
