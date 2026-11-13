import { readEnvelope } from './envelope';
import scheduled from './fixtures/matchinfo-2843814.json';
import played from './fixtures/matchinfo-2911141.json';
import cancelled from './fixtures/matchinfo-2930311.json';
import forfeited from './fixtures/matchinfo-2930414.json';
import withoutQuarters from './fixtures/matchinfo-2861436.json';
import { mapGameDetails } from './map-game-details';

/** The recorded `envelope` with `fields` changed in its `ligaData`. */
function withLigaData(envelope: unknown, fields: object): unknown {
  const data = readEnvelope(envelope) as { ligaData: object };
  return { ...data, ligaData: { ...data.ligaData, ...fields } };
}

describe('mapGameDetails', () => {
  describe('of a played Spiel', () => {
    const details = mapGameDetails(readEnvelope(played));

    it('reads the Spiel with its result and Liga', () => {
      expect(details.game.id).toBe(2911141);
      expect(details.game.status).toEqual({
        kind: 'played',
        result: { home: 99, away: 90 },
        confirmed: true,
      });
      expect(details.league.name).toBe(
        'Bayernliga U14 männlich Einteilungsrunde Nord'
      );
    });

    it('reads each quarter’s own points, adding up to the result', () => {
      expect(details.quarters).toEqual([
        { home: 26, away: 26 },
        { home: 30, away: 23 },
        { home: 29, away: 18 },
        { home: 14, away: 23 },
      ]);
      expect(
        details.quarters.reduce((sum, quarters) => sum + quarters.home, 0)
      ).toBe(99);
      expect(details.overtimes).toEqual([]);
    });

    it('reads the Halle', () => {
      expect(details.venue).toEqual({
        name: 'Paul-Moor-Schule',
        street: 'Schafhofstr. 27',
        postcode: '90411',
        town: 'Nürnberg',
      });
    });

    it('reads an overtime', () => {
      const data = readEnvelope(played) as { matchResult: object };
      const withOvertime = {
        ...data,
        matchResult: { ...data.matchResult, heimOt1stand: 8, gastOt1stand: 6 },
      };

      expect(mapGameDetails(withOvertime).overtimes).toEqual([
        { home: 8, away: 6 },
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
    const data = readEnvelope(played) as { matchResult: object };
    const partial = {
      ...data,
      matchResult: { ...data.matchResult, [field]: null },
    };

    expect(mapGameDetails(partial).quarters).toEqual([]);
  });

  it('reads a played Spiel whose Verband records no quarters', () => {
    const details = mapGameDetails(readEnvelope(withoutQuarters));

    expect(details.game.status).toEqual({
      kind: 'played',
      result: { home: 78, away: 47 },
      confirmed: false,
    });
    expect(details.quarters).toEqual([]);
    expect(details.overtimes).toEqual([]);
    expect(details.venue).toEqual({
      name: 'Schulsporthalle',
      street: 'Schulstr. 12',
      postcode: '38553',
      town: 'Wasbüttel',
    });
  });

  it('reads a planned Spiel without periods, with its Halle', () => {
    const details = mapGameDetails(readEnvelope(scheduled));

    expect(details.game.status).toEqual({ kind: 'scheduled' });
    expect(details.game.date).toBe('2026-11-15');
    expect(details.game.time).toBe('10:00');
    expect(details.quarters).toEqual([]);
    expect(details.venue?.name).toBe('Grundschule Nortorf');
  });

  it('reads a cancelled Spiel', () => {
    const details = mapGameDetails(readEnvelope(cancelled));

    expect(details.game.status).toEqual({ kind: 'cancelled' });
    expect(details.quarters).toEqual([]);
  });

  it('reads a forfeited Spiel with the side that gave up', () => {
    const details = mapGameDetails(readEnvelope(forfeited));

    expect(details.game.status).toEqual({
      kind: 'forfeited',
      forfeitedBy: ['away'],
    });
    expect(details.venue).toEqual({
      name: 'Weinberghalle',
      street: 'Herbartstr.',
      postcode: '91522',
      town: 'Ansbach',
    });
  });

  it('leaves out the Halle and the parts of its address the DBB lacks', () => {
    const data = readEnvelope(forfeited) as { matchInfo: object };
    const withoutAddress = {
      ...data,
      matchInfo: {
        ...data.matchInfo,
        spielfeld: { bezeichnung: 'Weinberghalle', strasse: ' ', plz: null },
      },
    };
    const withoutVenue = { ...data, matchInfo: null };

    expect(mapGameDetails(withoutAddress).venue).toEqual({
      name: 'Weinberghalle',
    });
    expect(mapGameDetails(withoutVenue).venue).toBeUndefined();
  });

  describe('whether the DBB ever confirms the Liga’s results', () => {
    const BBL = {
      verbandId: 100,
      akName: 'Senioren',
      geschlecht: 'männlich',
      statisticType: 0,
    };

    it.each([
      ['statisticType 0', BBL],
      ['statisticType 1', { ...BBL, statisticType: 1 }],
      ['a null statisticType', { ...BBL, statisticType: null }],
    ])(
      'marks a men’s Senioren Liga of the Bundesligen (BBL, ProA, ProB, BBL-Pokal) with %s',
      (_case, fields) => {
        expect(
          mapGameDetails(withLigaData(cancelled, fields)).league
            .resultsNeverConfirmed
        ).toBe(true);
      }
    );

    it.each([
      [
        'a men’s Senioren Liga of a Landesverband without Spielberichte',
        { ...BBL, verbandId: 2 },
      ],
      [
        'a women’s Liga of the Bundesligen (DBBL-Pokal Top4)',
        { ...BBL, geschlecht: 'weiblich' },
      ],
      [
        'a men’s youth Liga of the Bundesligen (NBBL)',
        { ...BBL, akName: 'U19', statisticType: 1 },
      ],
    ])('leaves it out for %s', (_case, fields) => {
      expect(
        mapGameDetails(withLigaData(cancelled, fields)).league
      ).not.toHaveProperty('resultsNeverConfirmed');
    });
  });

  describe('whether the DBB keeps the Liga’s Spielberichte', () => {
    it('marks a Liga of statisticType 0 as one without Spielberichte', () => {
      expect(
        mapGameDetails(readEnvelope(cancelled)).league.withoutGameReports
      ).toBe(true);
    });

    it('goes by the Liga, not by the Spiel’s own statisticType', () => {
      // this Spiel says 0 itself, its Liga 1
      expect(mapGameDetails(readEnvelope(scheduled)).league).not.toHaveProperty(
        'ohneSpielberichte'
      );
    });

    it.each([
      ['1', 1],
      ['null', null],
    ])('leaves it out for statisticType %s', (_name, value) => {
      expect(
        mapGameDetails(withLigaData(scheduled, { statisticType: value })).league
      ).not.toHaveProperty('ohneSpielberichte');
    });

    it('leaves it out where the Liga has no statisticType', () => {
      const data = readEnvelope(scheduled) as { ligaData: object };
      const { statisticType: _none, ...ligaData } = data.ligaData as Record<
        string,
        unknown
      >;

      expect(mapGameDetails({ ...data, ligaData }).league).not.toHaveProperty(
        'ohneSpielberichte'
      );
    });
  });
});
