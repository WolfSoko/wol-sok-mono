import {
  dbbHttpRequest,
  type DbbHttpRequest,
  type DbbRequest,
} from '../lib/dbb/dbb-request';
import { KEIN_LIGA_FILTER } from '../lib/domain/liga-suche';
import boxscore2843811 from '../lib/dbb/fixtures/boxscore-2843811.json';
import boxscore2843814 from '../lib/dbb/fixtures/boxscore-2843814.json';
import boxscore2861436 from '../lib/dbb/fixtures/boxscore-2861436.json';
import boxscore2911141 from '../lib/dbb/fixtures/boxscore-2911141.json';
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
import team313036Matches from '../lib/dbb/fixtures/team-313036-matches.json';
import teamNotFound from '../lib/dbb/fixtures/team-not-found.json';
import wamDataAlle from '../lib/dbb/fixtures/wam-data-alle.json';
import wamDataNiedersachsen from '../lib/dbb/fixtures/wam-data-niedersachsen.json';
import wamDataNiedersachsenU12 from '../lib/dbb/fixtures/wam-data-niedersachsen-u12.json';
import wamDataNiedersachsenU12m from '../lib/dbb/fixtures/wam-data-niedersachsen-u12-jugend-maennlich.json';
import wamListNiedersachsenU12m10 from '../lib/dbb/fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-10.json';
import wamListNiedersachsenU12m20 from '../lib/dbb/fixtures/wam-liga-list-niedersachsen-u12-jugend-maennlich-20.json';

/** The Team wizard's steps to Team 313036's Vorrunde, as the e2e takes them. */
const NIEDERSACHSEN = { ...KEIN_LIGA_FILTER, verbandIds: [7] };
const NIEDERSACHSEN_U12 = { ...NIEDERSACHSEN, altersklasseIds: [12] };
const NIEDERSACHSEN_U12_JUGEND_MAENNLICH = {
  ...NIEDERSACHSEN_U12,
  altersgruppeGeschlechtIds: ['2_1'],
};

/**
 * The recorded answers: the Team wizard's Liga searches down to the male
 * U12 youth Ligen of Niedersachsen (all three pages) and the Spielplan of
 * Team 313036's Vorrunde there, Team 313036's Spiele, its two Ligen's Tabellen,
 * one of its Spiele with a Kader-only Spielbericht not confirmed yet, and
 * the Spiele of the adapter's cases (played with quarters and Spielerwerte,
 * a confirmed Kader-only Spielbericht, planned without a Spielbericht,
 * cancelled, forfeited).
 */
const RECORDINGS: ReadonlyArray<readonly [DbbRequest, unknown]> = [
  [{ kind: 'liga-suche', filter: KEIN_LIGA_FILTER }, wamDataAlle],
  [{ kind: 'liga-suche', filter: NIEDERSACHSEN }, wamDataNiedersachsen],
  [{ kind: 'liga-suche', filter: NIEDERSACHSEN_U12 }, wamDataNiedersachsenU12],
  [
    { kind: 'liga-suche', filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH },
    wamDataNiedersachsenU12m,
  ],
  [
    {
      kind: 'liga-seite',
      filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH,
      startIndex: 10,
    },
    wamListNiedersachsenU12m10,
  ],
  [
    {
      kind: 'liga-seite',
      filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH,
      startIndex: 20,
    },
    wamListNiedersachsenU12m20,
  ],
  [{ kind: 'spielplan', ligaId: 54862 }, spielplan54862],
  [{ kind: 'team-spiele', teamId: 313036 }, team313036Matches],
  [{ kind: 'tabelle', ligaId: 54689 }, table54689],
  [{ kind: 'tabelle', ligaId: 54862 }, table54862],
  [{ kind: 'spiel-info', spielId: 2861436 }, matchinfo2861436],
  [{ kind: 'spiel-info', spielId: 2911141 }, matchinfo2911141],
  [{ kind: 'spiel-info', spielId: 2843814 }, matchinfo2843814],
  [{ kind: 'spiel-info', spielId: 2930311 }, matchinfo2930311],
  [{ kind: 'spiel-info', spielId: 2930414 }, matchinfo2930414],
  [{ kind: 'spielbericht', spielId: 2861436 }, boxscore2861436],
  [{ kind: 'spielbericht', spielId: 2911141 }, boxscore2911141],
  [{ kind: 'spielbericht', spielId: 2843811 }, boxscore2843811],
  [{ kind: 'spielbericht', spielId: 2843814 }, boxscore2843814],
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
    : `${method} ${path} ${kanonisch(body)}`;
}

/** The key of the call `dbbHttpRequest` builds. */
function callKeyOf(call: DbbHttpRequest): string {
  return call.method === 'POST'
    ? callKey(call.method, call.path, call.body)
    : callKey(call.method, call.path);
}

/** `value` as JSON with every object's keys sorted: equal content, equal text. */
function kanonisch(value: unknown): string {
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
