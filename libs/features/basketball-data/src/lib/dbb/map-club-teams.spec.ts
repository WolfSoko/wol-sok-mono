import { readEnvelope } from './envelope';
import clubMatches from './fixtures/club-1476-actualmatches.json';
import { mapClubTeams } from './map-club-teams';

describe('mapClubTeams', () => {
  const clubTeams = mapClubTeams(readEnvelope(clubMatches));

  it('reads the Verein', () => {
    expect(clubTeams.club).toEqual({ id: 1476, name: 'Post SV Nürnberg' });
  });

  it('lists only the Verein’s own Teams, each once, by name', () => {
    const teams = clubTeams.teams.map(({ team }) => team);

    expect(teams.every((team) => team.clubId === 1476)).toBe(true);
    expect(new Set(teams.map((team) => team.id)).size).toBe(teams.length);
    expect(teams).toHaveLength(14);
    const names = teams.map((team) => team.name);
    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b, 'de')));
  });

  it('lists both Teams of a Spiel between two of its own', () => {
    const ids = clubTeams.teams.map(({ team }) => team.id);

    expect(ids).toEqual(expect.arrayContaining([166662, 166587]));
  });

  it('names the Ligen each Team played in, so Teams of one name tell apart', () => {
    const u16 = clubTeams.teams.find(({ team }) => team.id === 166583);

    expect(u16?.leagues.map((league) => league.name)).toEqual([
      'BBV-Pokal U16 männlich',
      'Bayernliga U16 männlich Nord',
    ]);
  });

  it('reads a Verein without recent Spiele as without Teams', () => {
    const data = { ...(readEnvelope(clubMatches) as object), matches: [] };

    expect(mapClubTeams(data).teams).toEqual([]);
  });
});
