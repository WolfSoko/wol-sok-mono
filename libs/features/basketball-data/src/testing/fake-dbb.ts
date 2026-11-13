import { CLUB_GAMES_DAYS } from '../lib/dbb/dbb-basketball-data';
import {
  dbbHttpRequest,
  type DbbHttpRequest,
  type DbbRequest,
  type DbbTransport,
} from '../lib/dbb/dbb-request';
import { NO_LEAGUE_FILTER } from '../lib/domain/league-search';
import boxscore2843811 from '../lib/dbb/fixtures/boxscore-2843811.json';
import boxscore2843814 from '../lib/dbb/fixtures/boxscore-2843814.json';
import boxscore2861436 from '../lib/dbb/fixtures/boxscore-2861436.json';
import boxscore2911141 from '../lib/dbb/fixtures/boxscore-2911141.json';
import boxscore2861555 from '../lib/dbb/fixtures/boxscore-2861555.json';
import club1837Actualmatches from '../lib/dbb/fixtures/club-1837-actualmatches.json';
import clubNotFound from '../lib/dbb/fixtures/club-not-found.json';
import boxscoreNotFound from '../lib/dbb/fixtures/boxscore-not-found.json';
import matchinfo2843814 from '../lib/dbb/fixtures/matchinfo-2843814.json';
import matchinfo2861436 from '../lib/dbb/fixtures/matchinfo-2861436.json';
import matchinfo2911141 from '../lib/dbb/fixtures/matchinfo-2911141.json';
import matchinfo2930311 from '../lib/dbb/fixtures/matchinfo-2930311.json';
import matchinfo2930414 from '../lib/dbb/fixtures/matchinfo-2930414.json';
import matchinfoNotFound from '../lib/dbb/fixtures/matchinfo-not-found.json';
import spielplan54862 from '../lib/dbb/fixtures/spielplan-54862.json';
import spielplanNotFound from '../lib/dbb/fixtures/spielplan-not-found.json';
import table54689 from '../lib/dbb/fixtures/table-54689.json';
import table54862 from '../lib/dbb/fixtures/table-54862.json';
import tableNotFound from '../lib/dbb/fixtures/table-not-found.json';
import team163073Matches from '../lib/dbb/fixtures/team-163073-matches.json';
import team313036Matches from '../lib/dbb/fixtures/team-313036-matches.json';
import teamNotFound from '../lib/dbb/fixtures/team-not-found.json';
import wamDataAlle from '../lib/dbb/fixtures/wam-data-alle.json';
import wamDataNiedersachsen from '../lib/dbb/fixtures/wam-data-niedersachsen.json';
import wamDataNiedersachsenU12 from '../lib/dbb/fixtures/wam-data-niedersachsen-u12.json';
import wamDataNiedersachsenU12m from '../lib/dbb/fixtures/wam-data-niedersachsen-u12-jugend-maennlich.json';
import wamListNiedersachsenU12m10 from '../lib/dbb/fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-10.json';
import wamListNiedersachsenU12m20 from '../lib/dbb/fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-20.json';

/** The Team wizard's steps to Team 313036's Vorrunde, as the e2e takes them. */
const NIEDERSACHSEN = { ...NO_LEAGUE_FILTER, associationIds: [7] };
const NIEDERSACHSEN_U12 = { ...NIEDERSACHSEN, ageGroupIds: [12] };
const NIEDERSACHSEN_U12_YOUTH_MALE = {
  ...NIEDERSACHSEN_U12,
  ageGroupGenderIds: ['2_1'],
};

/**
 * The recorded answers: the Team wizard's Liga searches down to the male
 * U12 youth Ligen of Niedersachsen (all three pages) and the Spielplan of
 * Team 313036's Vorrunde there, Team 313036's Spiele, its two Ligen's Tabellen,
 * its Verein's Spiele of the weeks around 8 November 2026,
 * one of its Spiele with a Kader-only Spielbericht not confirmed yet,
 * a BBL Team's Spiele (163073, results the DBB never confirms), and
 * the Spiele of the adapter's cases (played with quarters and Spielerwerte,
 * a confirmed Kader-only Spielbericht, planned without a Spielbericht,
 * cancelled, forfeited).
 */
const RECORDINGS: ReadonlyArray<readonly [DbbRequest, unknown]> = [
  [{ kind: 'league-search', filter: NO_LEAGUE_FILTER }, wamDataAlle],
  [{ kind: 'league-search', filter: NIEDERSACHSEN }, wamDataNiedersachsen],
  [
    { kind: 'league-search', filter: NIEDERSACHSEN_U12 },
    wamDataNiedersachsenU12,
  ],
  [
    { kind: 'league-search', filter: NIEDERSACHSEN_U12_YOUTH_MALE },
    wamDataNiedersachsenU12m,
  ],
  [
    {
      kind: 'league-page',
      filter: NIEDERSACHSEN_U12_YOUTH_MALE,
      startIndex: 10,
    },
    wamListNiedersachsenU12m10,
  ],
  [
    {
      kind: 'league-page',
      filter: NIEDERSACHSEN_U12_YOUTH_MALE,
      startIndex: 20,
    },
    wamListNiedersachsenU12m20,
  ],
  [{ kind: 'schedule', leagueId: 54862 }, spielplan54862],
  [{ kind: 'team-games', teamId: 313036 }, team313036Matches],
  [{ kind: 'team-games', teamId: 163073 }, team163073Matches],
  [
    { kind: 'club-games', clubId: 1837, days: CLUB_GAMES_DAYS },
    club1837Actualmatches,
  ],
  [{ kind: 'standings', leagueId: 54689 }, table54689],
  [{ kind: 'standings', leagueId: 54862 }, table54862],
  [{ kind: 'game-info', gameId: 2861436 }, matchinfo2861436],
  [{ kind: 'game-info', gameId: 2911141 }, matchinfo2911141],
  [{ kind: 'game-info', gameId: 2843814 }, matchinfo2843814],
  [{ kind: 'game-info', gameId: 2930311 }, matchinfo2930311],
  [{ kind: 'game-info', gameId: 2930414 }, matchinfo2930414],
  [{ kind: 'game-report', gameId: 2861436 }, boxscore2861436],
  [{ kind: 'game-report', gameId: 2911141 }, boxscore2911141],
  [{ kind: 'game-report', gameId: 2843811 }, boxscore2843811],
  [{ kind: 'game-report', gameId: 2843814 }, boxscore2843814],
  [{ kind: 'game-report', gameId: 2861555 }, boxscore2861555],
];

/** The recorded answers, by the call `dbbHttpRequest` builds for them. */
const RECORDED: ReadonlyMap<string, unknown> = new Map(
  RECORDINGS.map(([request, answer]) => [
    callKeyOf(dbbHttpRequest(request)),
    answer,
  ])
);

/** What the DBB answers for an id it does not know: status `"1"`. */
const NOT_FOUND: ReadonlyArray<readonly [RegExp, unknown]> = [
  [/^team\/id\/\d+\/matches$/, teamNotFound],
  [/^club\/id\/\d+\/actualmatches\?rangeDays=\d+$/, clubNotFound],
  [/^competition\/table\/id\/\d+$/, tableNotFound],
  [/^competition\/spielplan\/id\/\d+$/, spielplanNotFound],
  [/^match\/id\/\d+\/matchInfo$/, matchinfoNotFound],
  [/^match\/id\/\d+\/boxscore$/, boxscoreNotFound],
];

/**
 * How the DBB answers a call of `path` (relative to `DBB_BASE_URL`, as
 * `dbbHttpRequest` builds it) with `body` (a POST's JSON, spacing and key order aside),
 * from the anonymised fixtures: the recording of a recorded read, the DBB's
 * not-found envelope for a GET of any other id of a known read, and
 * `undefined` for a read the fake does not know. For specs and the app's
 * e2e fake DBB server.
 */
export function fakeDbbAnswer(
  method: string,
  path: string,
  body?: string
): unknown {
  switch (method) {
    case 'GET':
      return (
        RECORDED.get(callKey('GET', path)) ??
        NOT_FOUND.find(([pattern]) => pattern.test(path))?.[1]
      );
    case 'POST': {
      const parsed = parsedOrUndefined(body);
      return parsed === undefined
        ? undefined
        : RECORDED.get(callKey('POST', path, parsed));
    }
    default:
      return undefined;
  }
}

/** One key per call: its method, its path and a POST's body's content. */
function callKey(method: string, path: string, body?: unknown): string {
  return body === undefined
    ? `${method} ${path}`
    : `${method} ${path} ${canonical(body)}`;
}

/** The key of the call `dbbHttpRequest` builds. */
function callKeyOf(call: DbbHttpRequest): string {
  return call.method === 'POST'
    ? callKey(call.method, call.path, call.body)
    : callKey(call.method, call.path);
}

/** `value` as JSON with every object's keys sorted: equal content, equal text. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))
        )
      : inner
  );
}

function parsedOrUndefined(body: string | undefined): unknown {
  if (body === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/**
 * A transport that answers every read from the recorded fixtures
 * (`fakeDbbAnswer`), for specs that read them through `DbbBasketballData`.
 */
export const recordedDbbTransport: DbbTransport = async (request) => {
  const call = dbbHttpRequest(request);
  return call.method === 'POST'
    ? fakeDbbAnswer(call.method, call.path, JSON.stringify(call.body))
    : fakeDbbAnswer(call.method, call.path);
};
