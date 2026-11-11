import { dbbBoxscoreFinished } from './boxscore-finished';
import noReport from './fixtures/boxscore-2843814.json';
import rosterOnlyConfirmed from './fixtures/boxscore-2843811.json';
import rosterOnlyUnconfirmed from './fixtures/boxscore-2861436.json';
import withStats from './fixtures/boxscore-2911141.json';
import notFound from './fixtures/boxscore-not-found.json';

/** `response` with its `data` fields replaced by `fields`. */
function withFields(
  response: typeof withStats,
  fields: Record<string, unknown>
): unknown {
  return { ...response, data: { ...response.data, ...fields } };
}

describe('dbbBoxscoreFinished', () => {
  it.each([
    ['with Spielerwerte', withStats],
    ['with the Kader only', rosterOnlyConfirmed],
  ])('holds for a confirmed Spiel’s Spielbericht %s', (_case, response) => {
    expect(dbbBoxscoreFinished(response)).toBe(true);
  });

  it('holds for no Spielbericht whose result is not confirmed yet', () => {
    expect(dbbBoxscoreFinished(rosterOnlyUnconfirmed)).toBe(false);
  });

  it('holds for no Spiel without a Spielbericht yet', () => {
    expect(dbbBoxscoreFinished(noReport)).toBe(false);
  });

  it('holds for no Spielbericht with one side’s Kader missing', () => {
    expect(
      dbbBoxscoreFinished(
        withFields(withStats, {
          matchBoxscore: {
            ...withStats.data.matchBoxscore,
            guestPlayerStats: [],
          },
        })
      )
    ).toBe(false);
  });

  it.each([
    ['a null entry', null],
    ['an entry without player', { pts: 2 }],
    [
      'a named player without person id',
      {
        pts: 2,
        player: { anonym: false, person: { vorname: 'A', nachname: 'B' } },
      },
    ],
  ])('holds for no Spielbericht with %s in a Kader', (_case, entry) => {
    const { homePlayerStats } = withStats.data.matchBoxscore;

    expect(
      dbbBoxscoreFinished(
        withFields(withStats, {
          matchBoxscore: {
            ...withStats.data.matchBoxscore,
            homePlayerStats: [...homePlayerStats, entry],
          },
        })
      )
    ).toBe(false);
  });

  it.each([
    ['no result', { result: null }],
    ['a placeholder result', { result: '-:-' }],
    ['a cancelled Spiel', { abgesagt: true }],
    ['a confirmation that is no boolean', { ergebnisbestaetigt: 'true' }],
    ['no boxscore', { matchBoxscore: null }],
    [
      'player lists that are no lists',
      { matchBoxscore: { homePlayerStats: {} } },
    ],
  ])('holds for no Spielbericht with %s', (_case, fields) => {
    expect(dbbBoxscoreFinished(withFields(withStats, fields))).toBe(false);
  });

  it.each([
    ['the not-found envelope', notFound],
    ['a server error', { status: '-1', message: 'x', data: null }],
    ['no envelope', '<html>'],
    ['null', null],
    ['an envelope without data', { status: '0' }],
  ])('holds for no %s', (_case, response) => {
    expect(dbbBoxscoreFinished(response)).toBe(false);
  });
});
