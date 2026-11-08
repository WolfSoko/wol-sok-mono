import { dbbHttpRequest } from '../lib/dbb/dbb-request';
import { dbbStatusOf } from '../lib/dbb/envelope';
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
    { kind: 'team-spiele', teamId: 7 },
    { kind: 'tabelle', ligaId: 7 },
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
  ])('knows nothing of %s', (_case, method, path) => {
    expect(fakeDbbAnswer(method, path)).toBeUndefined();
  });
});
