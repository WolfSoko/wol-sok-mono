import { dbbHttpRequest } from '../lib/dbb/dbb-request';
import { dbbStatusOf } from '../lib/dbb/envelope';
import boxscoreGespielt from '../lib/dbb/fixtures/boxscore-2911141.json';
import boxscoreKeiner from '../lib/dbb/fixtures/boxscore-2843814.json';
import boxscoreNurKader from '../lib/dbb/fixtures/boxscore-2861436.json';
import matchInfoGespielt from '../lib/dbb/fixtures/matchinfo-2911141.json';
import matchInfoGeplant from '../lib/dbb/fixtures/matchinfo-2843814.json';
import matchInfoAbgesagt from '../lib/dbb/fixtures/matchinfo-2930311.json';
import matchInfoKampflos from '../lib/dbb/fixtures/matchinfo-2930414.json';
import matchInfoTeamSpiel from '../lib/dbb/fixtures/matchinfo-2861436.json';
import friendlyTable from '../lib/dbb/fixtures/table-54689.json';
import vorrundeTable from '../lib/dbb/fixtures/table-54862.json';
import teamSpiele from '../lib/dbb/fixtures/team-313036-matches.json';
import { fakeDbbAnswer } from './fake-dbb';

describe('fakeDbbAnswer', () => {
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
    [2911141, boxscoreGespielt],
    [2843814, boxscoreKeiner],
  ])('answers the boxscore of Spiel %i', (spielId, recording) => {
    const { path } = dbbHttpRequest({ kind: 'spielbericht', spielId });

    expect(fakeDbbAnswer('GET', path)).toEqual(recording);
  });

  it.each([
    { kind: 'team-spiele', teamId: 7 },
    { kind: 'tabelle', ligaId: 7 },
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
