import { readEnvelope } from './envelope';
import geplant from './fixtures/matchinfo-2843814.json';
import gespielt from './fixtures/matchinfo-2911141.json';
import abgesagt from './fixtures/matchinfo-2930311.json';
import kampflos from './fixtures/matchinfo-2930414.json';
import ohneViertel from './fixtures/matchinfo-2861436.json';
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

  it.each([
    'heimV1stand',
    'gastV1stand',
    'heimHalbzeitstand',
    'gastHalbzeitstand',
    'heimV3stand',
    'gastV3stand',
    'heimV4stand',
    'gastV4stand',
  ])('gives no quarters while %s is not recorded', (field) => {
    const data = readEnvelope(gespielt) as { matchResult: object };
    const partial = {
      ...data,
      matchResult: { ...data.matchResult, [field]: null },
    };

    expect(mapSpielDetails(partial).viertel).toEqual([]);
  });

  it('reads a played Spiel whose Verband records no quarters', () => {
    const details = mapSpielDetails(readEnvelope(ohneViertel));

    expect(details.spiel.status).toEqual({
      art: 'gespielt',
      ergebnis: { heim: 78, gast: 47 },
      bestaetigt: false,
    });
    expect(details.viertel).toEqual([]);
    expect(details.verlaengerungen).toEqual([]);
    expect(details.halle).toEqual({
      name: 'Schulsporthalle',
      strasse: 'Schulstr. 12',
      plz: '38553',
      ort: 'Wasbüttel',
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

  describe('whether the DBB keeps the Liga’s Spielberichte', () => {
    function withStatisticType(value: unknown): unknown {
      const data = readEnvelope(geplant) as { ligaData: object };
      return { ...data, ligaData: { ...data.ligaData, statisticType: value } };
    }

    it('marks a Liga of statisticType 0 as one without Spielberichte', () => {
      expect(
        mapSpielDetails(readEnvelope(abgesagt)).liga.ohneSpielberichte
      ).toBe(true);
    });

    it('goes by the Liga, not by the Spiel’s own statisticType', () => {
      // this Spiel says 0 itself, its Liga 1
      expect(mapSpielDetails(readEnvelope(geplant)).liga).not.toHaveProperty(
        'ohneSpielberichte'
      );
    });

    it.each([
      ['1', 1],
      ['null', null],
    ])('leaves it out for statisticType %s', (_name, value) => {
      expect(mapSpielDetails(withStatisticType(value)).liga).not.toHaveProperty(
        'ohneSpielberichte'
      );
    });

    it('leaves it out where the Liga has no statisticType', () => {
      const data = readEnvelope(geplant) as { ligaData: object };
      const { statisticType: _none, ...ligaData } = data.ligaData as Record<
        string,
        unknown
      >;

      expect(mapSpielDetails({ ...data, ligaData }).liga).not.toHaveProperty(
        'ohneSpielberichte'
      );
    });
  });
});
