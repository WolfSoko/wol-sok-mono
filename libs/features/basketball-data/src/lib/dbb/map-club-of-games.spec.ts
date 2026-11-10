import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import clubMatches from './fixtures/club-1476-actualmatches.json';
import { mapClubOfGames } from './map-club-of-games';

describe('mapClubOfGames', () => {
  it('reads the Verein of a Verein’s Spiele', () => {
    expect(mapClubOfGames(readEnvelope(clubMatches))).toEqual({
      id: 1476,
      name: 'Post SV Nürnberg',
    });
  });

  it('reads the Verein without reading its Spiele', () => {
    const data = {
      ...(readEnvelope(clubMatches) as object),
      matches: [{ matchId: 'not a Spiel' }],
    };

    expect(mapClubOfGames(data).name).toBe('Post SV Nürnberg');
  });

  it('reads a Verein without Spiele in the range', () => {
    const data = { ...(readEnvelope(clubMatches) as object), matches: [] };

    expect(mapClubOfGames(data)).toEqual({
      id: 1476,
      name: 'Post SV Nürnberg',
    });
  });

  it('rejects an answer without its Verein as unexpected', () => {
    const data = { ...(readEnvelope(clubMatches) as object), club: null };

    expect(caughtError(() => mapClubOfGames(data)).kind).toBe(
      'unexpected-shape'
    );
  });
});
