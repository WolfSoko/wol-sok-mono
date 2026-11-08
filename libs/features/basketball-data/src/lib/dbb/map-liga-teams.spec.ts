import { readEnvelope } from './envelope';
import vorrunde from './fixtures/spielplan-54379.json';
import hauptrunde from './fixtures/spielplan-54857.json';
import { mapLigaTeams } from './map-liga-teams';

describe('mapLigaTeams', () => {
  it('lists each Team of the Spielplan once, by name', () => {
    expect(mapLigaTeams(readEnvelope(vorrunde))).toEqual([
      { id: 281627, name: 'BBC Rendsburg', vereinId: 3582 },
      { id: 234544, name: 'Kieler TB', vereinId: 1149 },
      { id: 314384, name: 'TSV Kronshagen', vereinId: 2639 },
      { id: 317492, name: 'TuS Nortorf', vereinId: 3696 },
    ]);
  });

  it('leaves out slots still waiting for a Team', () => {
    expect(mapLigaTeams(readEnvelope(hauptrunde))).toEqual([]);
  });

  it('reads a Liga without Spiele yet as without Teams', () => {
    const data = { ...(readEnvelope(vorrunde) as object), matches: null };

    expect(mapLigaTeams(data)).toEqual([]);
  });
});
