import { dbbHttpRequest } from '../lib/dbb/dbb-request';
import { dbbStatusOf } from '../lib/dbb/envelope';
import teamSpiele from '../lib/dbb/fixtures/team-313036-matches.json';
import { fakeDbbAnswer } from './fake-dbb';

describe('fakeDbbAnswer', () => {
  it('answers a recorded read with its recording', () => {
    const { path } = dbbHttpRequest({ kind: 'team-spiele', teamId: 313036 });

    expect(fakeDbbAnswer('GET', path)).toEqual(teamSpiele);
  });

  it('answers a read of an id it has no recording of as the DBB does', () => {
    const { path } = dbbHttpRequest({ kind: 'team-spiele', teamId: 7 });

    expect(dbbStatusOf(fakeDbbAnswer('GET', path))).toBe('not-found');
  });

  it.each([
    ['an unknown path', 'GET', 'team/id/313036/players'],
    ['a non-numeric id', 'GET', 'team/id/abc/matches'],
    ['another method', 'POST', 'team/id/313036/matches'],
    ['a path with more after it', 'GET', 'team/id/313036/matches/1'],
  ])('knows nothing of %s', (_case, method, path) => {
    expect(fakeDbbAnswer(method, path)).toBeUndefined();
  });
});
