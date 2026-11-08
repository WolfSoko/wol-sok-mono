import { dbbBoxscoreFinished } from './boxscore-finished';
import keinBericht from './fixtures/boxscore-2843814.json';
import nurKaderBestaetigt from './fixtures/boxscore-2843811.json';
import nurKader from './fixtures/boxscore-2861436.json';
import mitWerten from './fixtures/boxscore-2911141.json';
import notFound from './fixtures/boxscore-not-found.json';

describe('dbbBoxscoreFinished', () => {
  it.each([
    ['with Spielerwerte', mitWerten],
    ['with the Kader only, its result confirmed', nurKaderBestaetigt],
    ['with the Kader only, its result not confirmed yet', nurKader],
  ])('holds for a played Spiel’s Spielbericht %s', (_case, response) => {
    expect(dbbBoxscoreFinished(response)).toBe(true);
  });

  it('holds for no Spiel without a Spielbericht yet', () => {
    expect(dbbBoxscoreFinished(keinBericht)).toBe(false);
  });

  it('holds for no Kader of a Spiel without a result yet', () => {
    const ohneErgebnis = {
      ...mitWerten,
      data: { ...mitWerten.data, result: null },
    };

    expect(dbbBoxscoreFinished(ohneErgebnis)).toBe(false);
  });

  it('holds for no cancelled Spiel', () => {
    const abgesagt = {
      ...mitWerten,
      data: { ...mitWerten.data, abgesagt: true },
    };

    expect(dbbBoxscoreFinished(abgesagt)).toBe(false);
  });

  it.each([
    ['the not-found envelope', notFound],
    ['a server error', { status: '-1', message: 'x', data: null }],
    ['no envelope', '<html>'],
    ['an envelope of another shape', { status: '0', data: { matchId: 'x' } }],
  ])('holds for no %s', (_case, response) => {
    expect(dbbBoxscoreFinished(response)).toBe(false);
  });
});
