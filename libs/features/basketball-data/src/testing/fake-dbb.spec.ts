import {
  DBB_BASE_URL,
  dbbFetchInput,
  dbbHttpRequest,
  type DbbRequest,
} from '../lib/dbb/dbb-request';
import { KEIN_LIGA_FILTER } from '../lib/domain/liga-suche';
import { dbbStatusOf } from '../lib/dbb/envelope';
import boxscoreGespielt from '../lib/dbb/fixtures/boxscore-2911141.json';
import boxscoreKeiner from '../lib/dbb/fixtures/boxscore-2843814.json';
import boxscoreNurKaderBestaetigt from '../lib/dbb/fixtures/boxscore-2843811.json';
import boxscoreNurKader from '../lib/dbb/fixtures/boxscore-2861436.json';
import matchInfoGespielt from '../lib/dbb/fixtures/matchinfo-2911141.json';
import matchInfoGeplant from '../lib/dbb/fixtures/matchinfo-2843814.json';
import matchInfoAbgesagt from '../lib/dbb/fixtures/matchinfo-2930311.json';
import matchInfoKampflos from '../lib/dbb/fixtures/matchinfo-2930414.json';
import matchInfoTeamSpiel from '../lib/dbb/fixtures/matchinfo-2861436.json';
import friendlyTable from '../lib/dbb/fixtures/table-54689.json';
import vorrundeTable from '../lib/dbb/fixtures/table-54862.json';
import vorrundeSpielplan from '../lib/dbb/fixtures/spielplan-54862.json';
import teamSpiele from '../lib/dbb/fixtures/team-313036-matches.json';
import alleLigen from '../lib/dbb/fixtures/wam-data-alle.json';
import niedersachsen from '../lib/dbb/fixtures/wam-data-niedersachsen.json';
import niedersachsenU12 from '../lib/dbb/fixtures/wam-data-niedersachsen-u12.json';
import nsU12m from '../lib/dbb/fixtures/wam-data-niedersachsen-u12-jugend-maennlich.json';
import nsU12mZweite from '../lib/dbb/fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-10.json';
import nsU12mDritte from '../lib/dbb/fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-20.json';
import { fakeDbbAnswer } from './fake-dbb';

const NIEDERSACHSEN = { ...KEIN_LIGA_FILTER, verbandIds: [7] };
const NIEDERSACHSEN_U12 = { ...NIEDERSACHSEN, altersklasseIds: [12] };
const NIEDERSACHSEN_U12_JUGEND_MAENNLICH = {
  ...NIEDERSACHSEN_U12,
  altersgruppeGeschlechtIds: ['2_1'],
};

/** How the DBB answers `request`, sent as the proxy sends it. */
function answerTo(request: DbbRequest): unknown {
  const { method, url, body } = dbbFetchInput(
    DBB_BASE_URL,
    dbbHttpRequest(request),
    {}
  );
  return fakeDbbAnswer(method, url.slice(`${DBB_BASE_URL}/`.length), body);
}

describe('fakeDbbAnswer', () => {
  it.each([
    ['nothing picked', KEIN_LIGA_FILTER, alleLigen],
    ['a Verband', NIEDERSACHSEN, niedersachsen],
    ['its age group', NIEDERSACHSEN_U12, niedersachsenU12],
    ['its gender too', NIEDERSACHSEN_U12_JUGEND_MAENNLICH, nsU12m],
  ])('answers the Liga search with %s', (_case, filter, recording) => {
    expect(answerTo({ kind: 'liga-suche', filter })).toEqual(recording);
  });

  it.each([
    [10, nsU12mZweite],
    [20, nsU12mDritte],
  ])('answers page %i of the Liga list', (startIndex, recording) => {
    expect(
      answerTo({
        kind: 'liga-seite',
        filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH,
        startIndex,
      })
    ).toEqual(recording);
  });

  it('answers the Spielplan of Team 313036’s Vorrunde', () => {
    expect(answerTo({ kind: 'spielplan', ligaId: 54862 })).toEqual(
      vorrundeSpielplan
    );
  });

  it('takes a body that differs only in its spacing', () => {
    const { body } = dbbFetchInput(
      DBB_BASE_URL,
      dbbHttpRequest({ kind: 'liga-suche', filter: NIEDERSACHSEN }),
      {}
    );
    const spaced = JSON.stringify(JSON.parse(body ?? ''), null, 2);

    expect(fakeDbbAnswer('POST', 'wam/data', spaced)).toEqual(niedersachsen);
  });

  it.each([
    ['a filter it has no recording of', '{"token":0,"verbandIds":[2]}'],
    ['no body', undefined],
    ['a body that is no JSON', '{'],
  ])('knows no Liga search with %s', (_case, body) => {
    expect(fakeDbbAnswer('POST', 'wam/data', body)).toBeUndefined();
  });

  it('answers a recorded read with its recording', () => {
    const { path } = dbbHttpRequest({ kind: 'team-spiele', teamId: 313036 });

    expect(fakeDbbAnswer('GET', path)).toEqual(teamSpiele);
  });

  it.each([
    [54689, friendlyTable],
    [54862, vorrundeTable],
  ])("answers the Tabelle of Team 313036's Liga %i", (ligaId, recording) => {
    const { path } = dbbHttpRequest({ kind: 'tabelle', ligaId });

    expect(fakeDbbAnswer('GET', path)).toEqual(recording);
  });

  it.each([
    [2861436, matchInfoTeamSpiel],
    [2911141, matchInfoGespielt],
    [2843814, matchInfoGeplant],
    [2930311, matchInfoAbgesagt],
    [2930414, matchInfoKampflos],
  ])('answers the match info of Spiel %i', (spielId, recording) => {
    const { path } = dbbHttpRequest({ kind: 'spiel-info', spielId });

    expect(fakeDbbAnswer('GET', path)).toEqual(recording);
  });

  it.each([
    [2861436, boxscoreNurKader],
    [2843811, boxscoreNurKaderBestaetigt],
    [2911141, boxscoreGespielt],
    [2843814, boxscoreKeiner],
  ])('answers the boxscore of Spiel %i', (spielId, recording) => {
    const { path } = dbbHttpRequest({ kind: 'spielbericht', spielId });

    expect(fakeDbbAnswer('GET', path)).toEqual(recording);
  });

  it.each([
    { kind: 'team-spiele', teamId: 7 },
    { kind: 'tabelle', ligaId: 7 },
    { kind: 'spielplan', ligaId: 7 },
    { kind: 'spiel-info', spielId: 7 },
    { kind: 'spielbericht', spielId: 7 },
  ] as const)(
    'answers a read of an id it has no recording of as the DBB does: %o',
    (request) => {
      const { path } = dbbHttpRequest(request);

      expect(dbbStatusOf(fakeDbbAnswer('GET', path))).toBe('not-found');
    }
  );

  it.each([
    ['an unknown path', 'GET', 'team/id/313036/players'],
    ['a non-numeric id', 'GET', 'team/id/abc/matches'],
    ['another method', 'POST', 'team/id/313036/matches'],
    ['a path with more after it', 'GET', 'team/id/313036/matches/1'],
    ['a Tabelle with more after it', 'GET', 'competition/table/id/54862/1'],
    ['a boxscore with more after it', 'GET', 'match/id/2911141/boxscore/1'],
  ])('knows nothing of %s', (_case, method, path) => {
    expect(fakeDbbAnswer(method, path)).toBeUndefined();
  });
});
