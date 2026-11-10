import { readEnvelope } from './envelope';
import firstRound from './fixtures/spielplan-54379.json';
import mainRound from './fixtures/spielplan-54857.json';
import { mapLeagueTeams } from './map-league-teams';

describe('mapLeagueTeams', () => {
  it('lists each Team of the Spielplan once, by name', () => {
    expect(mapLeagueTeams(readEnvelope(firstRound))).toEqual([
      { id: 281627, name: 'BBC Rendsburg', clubId: 3582 },
      { id: 234544, name: 'Kieler TB', clubId: 1149 },
      { id: 314384, name: 'TSV Kronshagen', clubId: 2639 },
      { id: 317492, name: 'TuS Nortorf', clubId: 3696 },
    ]);
  });

  it('leaves out slots still waiting for a Team', () => {
    expect(mapLeagueTeams(readEnvelope(mainRound))).toEqual([]);
  });

  it('reads a Liga without Spiele yet as without Teams', () => {
    const data = { ...(readEnvelope(firstRound) as object), matches: null };

    expect(mapLeagueTeams(data)).toEqual([]);
  });
});
