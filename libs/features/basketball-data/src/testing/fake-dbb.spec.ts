import {
  DBB_BASE_URL,
  dbbFetchInput,
  dbbHttpRequest,
  type DbbRequest,
} from '../lib/dbb/dbb-request';
import { NO_LEAGUE_FILTER } from '../lib/domain/league-search';
import { dbbStatusOf } from '../lib/dbb/envelope';
import boxscorePlayed from '../lib/dbb/fixtures/boxscore-2911141.json';
import boxscoreNone from '../lib/dbb/fixtures/boxscore-2843814.json';
import boxscoreRosterOnlyConfirmed from '../lib/dbb/fixtures/boxscore-2843811.json';
import boxscoreRosterOnly from '../lib/dbb/fixtures/boxscore-2861436.json';
import matchInfoPlayed from '../lib/dbb/fixtures/matchinfo-2911141.json';
import matchInfoScheduled from '../lib/dbb/fixtures/matchinfo-2843814.json';
import matchInfoCancelled from '../lib/dbb/fixtures/matchinfo-2930311.json';
import matchInfoForfeited from '../lib/dbb/fixtures/matchinfo-2930414.json';
import matchInfoTeamGame from '../lib/dbb/fixtures/matchinfo-2861436.json';
import friendlyTable from '../lib/dbb/fixtures/table-54689.json';
import firstRoundTable from '../lib/dbb/fixtures/table-54862.json';
import firstRoundSchedule from '../lib/dbb/fixtures/spielplan-54862.json';
import teamGames from '../lib/dbb/fixtures/team-313036-matches.json';
import clubGames from '../lib/dbb/fixtures/club-1837-actualmatches.json';
import { CLUB_GAMES_DAYS } from '../lib/dbb/dbb-basketball-data';
import allLeagues from '../lib/dbb/fixtures/wam-data-alle.json';
import niedersachsen from '../lib/dbb/fixtures/wam-data-niedersachsen.json';
import niedersachsenU12 from '../lib/dbb/fixtures/wam-data-niedersachsen-u12.json';
import nsU12m from '../lib/dbb/fixtures/wam-data-niedersachsen-u12-jugend-maennlich.json';
import nsU12mSecond from '../lib/dbb/fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-10.json';
import nsU12mThird from '../lib/dbb/fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-20.json';
import { fakeDbbAnswer } from './fake-dbb';

const NIEDERSACHSEN = { ...NO_LEAGUE_FILTER, associationIds: [7] };
const NIEDERSACHSEN_U12 = { ...NIEDERSACHSEN, ageGroupIds: [12] };
const NIEDERSACHSEN_U12_YOUTH_MALE = {
  ...NIEDERSACHSEN_U12,
  ageGroupGenderIds: ['2_1'],
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
    ['nothing picked', NO_LEAGUE_FILTER, allLeagues],
    ['a Verband', NIEDERSACHSEN, niedersachsen],
    ['its age group', NIEDERSACHSEN_U12, niedersachsenU12],
    ['its gender too', NIEDERSACHSEN_U12_YOUTH_MALE, nsU12m],
  ])('answers the Liga search with %s', (_case, filter, recording) => {
    expect(answerTo({ kind: 'league-search', filter })).toEqual(recording);
  });

  it.each([
    [10, nsU12mSecond],
    [20, nsU12mThird],
  ])('answers page %i of the Liga list', (startIndex, recording) => {
    expect(
      answerTo({
        kind: 'league-page',
        filter: NIEDERSACHSEN_U12_YOUTH_MALE,
        startIndex,
      })
    ).toEqual(recording);
  });

  it('answers the Spielplan of Team 313036’s Vorrunde', () => {
    expect(answerTo({ kind: 'schedule', leagueId: 54862 })).toEqual(
      firstRoundSchedule
    );
  });

  it('takes a body that differs only in its spacing', () => {
    const { body } = dbbFetchInput(
      DBB_BASE_URL,
      dbbHttpRequest({ kind: 'league-search', filter: NIEDERSACHSEN }),
      {}
    );
    const spaced = JSON.stringify(JSON.parse(body ?? ''), null, 2);

    expect(fakeDbbAnswer('POST', 'wam/data', spaced)).toEqual(niedersachsen);
  });

  it('takes a body with its keys in another order', () => {
    const { body } = dbbFetchInput(
      DBB_BASE_URL,
      dbbHttpRequest({ kind: 'league-search', filter: NIEDERSACHSEN }),
      {}
    );
    const reversed = Object.fromEntries(
      Object.entries(JSON.parse(body ?? '{}') as object).reverse()
    );

    expect(fakeDbbAnswer('POST', 'wam/data', JSON.stringify(reversed))).toEqual(
      niedersachsen
    );
  });

  it.each([
    ['a filter it has no recording of', '{"token":0,"verbandIds":[2]}'],
    ['no body', undefined],
    ['a body that is no JSON', '{'],
  ])('knows no Liga search with %s', (_case, body) => {
    expect(fakeDbbAnswer('POST', 'wam/data', body)).toBeUndefined();
  });

  it('answers a recorded read with its recording', () => {
    const { path } = dbbHttpRequest({ kind: 'team-games', teamId: 313036 });

    expect(fakeDbbAnswer('GET', path)).toEqual(teamGames);
  });

  it('answers the Spiele of Team 313036’s Verein, as the adapter asks for them', () => {
    expect(
      answerTo({
        kind: 'club-games',
        clubId: 1837,
        days: CLUB_GAMES_DAYS,
      })
    ).toEqual(clubGames);
  });

  it('answers the Spiele of a Verein it does not know as not found', () => {
    const answer = answerTo({
      kind: 'club-games',
      clubId: 7,
      days: CLUB_GAMES_DAYS,
    });

    expect(dbbStatusOf(answer)).toBe('not-found');
  });

  it.each([
    [54689, friendlyTable],
    [54862, firstRoundTable],
  ])("answers the Tabelle of Team 313036's Liga %i", (leagueId, recording) => {
    const { path } = dbbHttpRequest({ kind: 'standings', leagueId });

    expect(fakeDbbAnswer('GET', path)).toEqual(recording);
  });

  it.each([
    [2861436, matchInfoTeamGame],
    [2911141, matchInfoPlayed],
    [2843814, matchInfoScheduled],
    [2930311, matchInfoCancelled],
    [2930414, matchInfoForfeited],
  ])('answers the match info of Spiel %i', (gameId, recording) => {
    const { path } = dbbHttpRequest({ kind: 'game-info', gameId });

    expect(fakeDbbAnswer('GET', path)).toEqual(recording);
  });

  it.each([
    [2861436, boxscoreRosterOnly],
    [2843811, boxscoreRosterOnlyConfirmed],
    [2911141, boxscorePlayed],
    [2843814, boxscoreNone],
  ])('answers the boxscore of Spiel %i', (gameId, recording) => {
    const { path } = dbbHttpRequest({ kind: 'game-report', gameId });

    expect(fakeDbbAnswer('GET', path)).toEqual(recording);
  });

  it.each([
    { kind: 'team-games', teamId: 7 },
    { kind: 'standings', leagueId: 7 },
    { kind: 'schedule', leagueId: 7 },
    { kind: 'game-info', gameId: 7 },
    { kind: 'game-report', gameId: 7 },
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
