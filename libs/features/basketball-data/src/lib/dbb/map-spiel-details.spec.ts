import { readEnvelope } from './envelope';
import geplant from './fixtures/matchinfo-2843814.json';
import gespielt from './fixtures/matchinfo-2911141.json';
import abgesagt from './fixtures/matchinfo-2930311.json';
import kampflos from './fixtures/matchinfo-2930414.json';
import { mapSpielDetails } from './map-spiel-details';

describe('mapSpielDetails', () => {
  describe('of a played Spiel', () => {
    const details = mapSpielDetails(readEnvelope(gespielt));

    it('reads the Spiel with its result and Liga', () => {
      expect(details.spiel.id).toBe(2911141);
      expect(details.spiel.status).toEqual({
        art: 'gespielt',
        ergebnis: { heim: 99, gast: 90 },
        bestaetigt: true,
      });
      expect(details.liga.name).toBe(
        'Bayernliga U14 männlich Einteilungsrunde Nord'
      );
    });

    it('reads each quarter’s own points, adding up to the result', () => {
      expect(details.viertel).toEqual([
        { heim: 26, gast: 26 },
        { heim: 30, gast: 23 },
        { heim: 29, gast: 18 },
        { heim: 14, gast: 23 },
      ]);
      expect(
        details.viertel.reduce((sum, viertel) => sum + viertel.heim, 0)
      ).toBe(99);
      expect(details.verlaengerungen).toEqual([]);
    });

    it('reads the Halle', () => {
      expect(details.halle).toEqual({
        name: 'Paul-Moor-Schule',
        strasse: 'Schafhofstr. 27',
        plz: '90411',
        ort: 'Nürnberg',
      });
    });

    it('reads an overtime', () => {
      const data = readEnvelope(gespielt) as { matchResult: object };
      const withOvertime = {
        ...data,
        matchResult: { ...data.matchResult, heimOt1stand: 8, gastOt1stand: 6 },
      };

      expect(mapSpielDetails(withOvertime).verlaengerungen).toEqual([
        { heim: 8, gast: 6 },
      ]);
    });
  });

  it('reads a planned Spiel without periods, with its Halle', () => {
    const details = mapSpielDetails(readEnvelope(geplant));

    expect(details.spiel.status).toEqual({ art: 'geplant' });
    expect(details.spiel.datum).toBe('2026-11-15');
    expect(details.spiel.uhrzeit).toBe('10:00');
    expect(details.viertel).toEqual([]);
    expect(details.halle?.name).toBe('Grundschule Nortorf');
  });

  it('reads a cancelled Spiel', () => {
    const details = mapSpielDetails(readEnvelope(abgesagt));

    expect(details.spiel.status).toEqual({ art: 'abgesagt' });
    expect(details.viertel).toEqual([]);
  });

  it('reads a forfeited Spiel with the side that gave up', () => {
    const details = mapSpielDetails(readEnvelope(kampflos));

    expect(details.spiel.status).toEqual({
      art: 'kampflos',
      verzichtet: ['gast'],
    });
    expect(details.halle).toEqual({
      name: 'Weinberghalle',
      strasse: 'Herbartstr.',
      plz: '91522',
      ort: 'Ansbach',
    });
  });

  it('leaves out the Halle and the parts of its address the DBB lacks', () => {
    const data = readEnvelope(kampflos) as { matchInfo: object };
    const withoutAddress = {
      ...data,
      matchInfo: {
        ...data.matchInfo,
        spielfeld: { bezeichnung: 'Weinberghalle', strasse: ' ', plz: null },
      },
    };
    const withoutHalle = { ...data, matchInfo: null };

    expect(mapSpielDetails(withoutAddress).halle).toEqual({
      name: 'Weinberghalle',
    });
    expect(mapSpielDetails(withoutHalle).halle).toBeUndefined();
  });
});
