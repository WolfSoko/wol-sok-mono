import { caughtError } from '../../testing/caught-error';
import { DbbObject } from './dbb-object';
import { readEnvelope } from './envelope';
import bayern from './fixtures/spielplan-54308.json';
import vorrunde from './fixtures/spielplan-54379.json';
import hauptrunde from './fixtures/spielplan-54857.json';
import { mapSpiel } from './map-spiel';

interface Spielplan {
  readonly ligaData: { readonly ligaId: number };
  readonly matches: readonly Record<string, unknown>[];
}

function matchOf(response: unknown, matchId: number): Record<string, unknown> {
  const spielplan = readEnvelope(response) as Spielplan;
  const match = spielplan.matches.find((m) => m['matchId'] === matchId);
  if (match === undefined) {
    throw new Error(`no match ${matchId} in the fixture`);
  }
  return match;
}

function spiel(response: unknown, matchId: number, overrides: object = {}) {
  const match = { ...matchOf(response, matchId), ...overrides };
  return mapSpiel(
    DbbObject.of(match, 'match'),
    (readEnvelope(response) as Spielplan).ligaData.ligaId
  );
}

describe('mapSpiel', () => {
  it('reads a played Spiel with its confirmed result', () => {
    expect(spiel(bayern, 2911132)).toEqual({
      id: 2911132,
      ligaId: 54308,
      spieltag: 1,
      datum: '2026-09-26',
      uhrzeit: '11:00',
      heim: {
        art: 'team',
        team: { id: 272599, name: 'Freak City Bamberg', vereinId: 1932 },
      },
      gast: {
        art: 'team',
        team: { id: 156618, name: 'Post SV Nürnberg', vereinId: 1476 },
      },
      status: {
        art: 'gespielt',
        ergebnis: { heim: 57, gast: 94 },
        bestaetigt: true,
      },
    });
  });

  it('tells a result the Verband has not confirmed yet', () => {
    expect(spiel(bayern, 2911135).status).toEqual({
      art: 'gespielt',
      ergebnis: { heim: 71, gast: 83 },
      bestaetigt: false,
    });
  });

  it('reads a Spiel without a result as planned', () => {
    expect(spiel(bayern, 2911146).status).toEqual({ art: 'geplant' });
  });

  it('reads a forfeit with the side that gave up', () => {
    expect(spiel(vorrunde, 2843812).status).toEqual({
      art: 'kampflos',
      verzichtet: ['heim'],
    });
    expect(spiel(vorrunde, 2843809).status).toEqual({
      art: 'kampflos',
      verzichtet: ['gast'],
    });
  });

  it('keeps the result a forfeit is scored with', () => {
    expect(spiel(vorrunde, 2843812, { result: '20:0' }).status).toEqual({
      art: 'kampflos',
      verzichtet: ['heim'],
      ergebnis: { heim: 20, gast: 0 },
    });
  });

  it('reads a cancelled Spiel', () => {
    expect(spiel(bayern, 2911146, { abgesagt: true }).status).toEqual({
      art: 'abgesagt',
    });
  });

  it('reads a slot without a Team by its name', () => {
    const slot = spiel(hauptrunde, 2861786);

    expect(slot.heim).toEqual({ art: 'offen', bezeichnung: 'Nord 1. Platz' });
    expect(slot.gast).toEqual({ art: 'offen', bezeichnung: 'Süd 1. Platz' });
  });

  it('leaves out a tip-off the DBB has not set', () => {
    expect(
      spiel(bayern, 2911146, { kickoffTime: '00:00' }).uhrzeit
    ).toBeUndefined();
  });

  it('takes the Liga from the match where it carries one', () => {
    const match = { ...matchOf(bayern, 2911132), ligaData: { ligaId: 99 } };

    expect(mapSpiel(DbbObject.of(match, 'match')).ligaId).toBe(99);
  });

  it('refuses a match without a Liga', () => {
    expect(
      caughtError(() =>
        mapSpiel(DbbObject.of(matchOf(bayern, 2911132), 'match'))
      ).message
    ).toBe('match.ligaData: expected an object, got nothing');
  });

  it('refuses a result it cannot read', () => {
    expect(
      caughtError(() => spiel(bayern, 2911132, { result: '57-94' })).message
    ).toBe('match.result: expected a result like "57:94", got "57-94"');
  });
});
