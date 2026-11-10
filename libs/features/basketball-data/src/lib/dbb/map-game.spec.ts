import { caughtError } from '../../testing/caught-error';
import { DbbObject } from './dbb-object';
import { readEnvelope } from './envelope';
import bayern from './fixtures/spielplan-54308.json';
import firstRound from './fixtures/spielplan-54379.json';
import mainRound from './fixtures/spielplan-54857.json';
import { mapGame } from './map-game';

interface DbbSchedule {
  readonly ligaData: { readonly ligaId: number };
  readonly matches: readonly Record<string, unknown>[];
}

function matchOf(response: unknown, matchId: number): Record<string, unknown> {
  const schedule = readEnvelope(response) as DbbSchedule;
  const match = schedule.matches.find((m) => m['matchId'] === matchId);
  if (match === undefined) {
    throw new Error(`no match ${matchId} in the fixture`);
  }
  return match;
}

function game(response: unknown, matchId: number, overrides: object = {}) {
  const match = { ...matchOf(response, matchId), ...overrides };
  return mapGame(
    DbbObject.of(match, 'match'),
    (readEnvelope(response) as DbbSchedule).ligaData.ligaId
  );
}

describe('mapGame', () => {
  it('reads a played Spiel with its confirmed result', () => {
    expect(game(bayern, 2911132)).toEqual({
      id: 2911132,
      leagueId: 54308,
      matchday: 1,
      date: '2026-09-26',
      time: '11:00',
      home: {
        kind: 'team',
        team: { id: 272599, name: 'Freak City Bamberg', clubId: 1932 },
      },
      away: {
        kind: 'team',
        team: { id: 156618, name: 'Post SV Nürnberg', clubId: 1476 },
      },
      status: {
        kind: 'played',
        result: { home: 57, away: 94 },
        confirmed: true,
      },
    });
  });

  it('tells a result the Verband has not confirmed yet', () => {
    expect(game(bayern, 2911135).status).toEqual({
      kind: 'played',
      result: { home: 71, away: 83 },
      confirmed: false,
    });
  });

  it('reads a Spiel without a result as planned', () => {
    expect(game(bayern, 2911146).status).toEqual({ kind: 'scheduled' });
  });

  it('reads a forfeit with the side that gave up', () => {
    expect(game(firstRound, 2843812).status).toEqual({
      kind: 'forfeited',
      forfeitedBy: ['home'],
    });
    expect(game(firstRound, 2843809).status).toEqual({
      kind: 'forfeited',
      forfeitedBy: ['away'],
    });
  });

  it('keeps the result a forfeit is scored with', () => {
    expect(game(firstRound, 2843812, { result: '20:0' }).status).toEqual({
      kind: 'forfeited',
      forfeitedBy: ['home'],
      result: { home: 20, away: 0 },
    });
  });

  it('reads a cancelled Spiel', () => {
    expect(game(bayern, 2911146, { abgesagt: true }).status).toEqual({
      kind: 'cancelled',
    });
  });

  it('reads a cancelled Spiel whatever stands in its result', () => {
    expect(
      game(bayern, 2911146, { abgesagt: true, result: 'abg.' }).status
    ).toEqual({
      kind: 'cancelled',
    });
    expect(game(bayern, 2911132, { abgesagt: true }).status).toEqual({
      kind: 'cancelled',
    });
  });

  it.each(['-:-', '', ' ', 'abg.'])(
    'reads the placeholder result %j as no result',
    (result) => {
      expect(game(bayern, 2911146, { result }).status).toEqual({
        kind: 'scheduled',
      });
      expect(game(firstRound, 2843812, { result }).status).toEqual({
        kind: 'forfeited',
        forfeitedBy: ['home'],
      });
    }
  );

  it('reads a slot without a Team by its name', () => {
    const slot = game(mainRound, 2861786);

    expect(slot.home).toEqual({ kind: 'open', label: 'Nord 1. Platz' });
    expect(slot.away).toEqual({ kind: 'open', label: 'Süd 1. Platz' });
  });

  it('leaves out a tip-off the DBB has not set', () => {
    expect(
      game(bayern, 2911146, { kickoffTime: '00:00' }).time
    ).toBeUndefined();
  });

  it('takes the Liga from the match where it carries one', () => {
    const match = { ...matchOf(bayern, 2911132), ligaData: { ligaId: 99 } };

    expect(mapGame(DbbObject.of(match, 'match')).leagueId).toBe(99);
  });

  it('refuses a match without a Liga', () => {
    expect(
      caughtError(() =>
        mapGame(DbbObject.of(matchOf(bayern, 2911132), 'match'))
      ).message
    ).toBe('match.ligaData: expected an object, got nothing');
  });

  it('refuses a result it cannot read', () => {
    expect(
      caughtError(() => game(bayern, 2911132, { result: '57-94' })).message
    ).toBe('match.result: expected a result like "57:94", got "57-94"');
  });
});
