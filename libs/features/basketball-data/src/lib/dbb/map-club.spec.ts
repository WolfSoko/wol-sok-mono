import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import clubMatches from './fixtures/club-1476-actualmatches.json';
import { mapClub } from './map-club';

describe('mapClub', () => {
  it('reads the Verein of a Verein’s Spiele', () => {
    expect(mapClub(readEnvelope(clubMatches))).toEqual({
      id: 1476,
      name: 'Post SV Nürnberg',
    });
  });

  it('reads the Verein without reading its Spiele', () => {
    const data = {
      ...(readEnvelope(clubMatches) as object),
      matches: [{ matchId: 'not a Spiel' }],
    };

    expect(mapClub(data).name).toBe('Post SV Nürnberg');
  });

  it('rejects an answer without its Verein as unexpected', () => {
    const data = { ...(readEnvelope(clubMatches) as object), club: null };

    expect(caughtError(() => mapClub(data)).kind).toBe('unexpected-shape');
  });
});
