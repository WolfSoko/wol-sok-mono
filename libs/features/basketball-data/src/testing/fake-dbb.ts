import { dbbHttpRequest, type DbbRequest } from '../lib/dbb/dbb-request';
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
import table54689 from '../lib/dbb/fixtures/table-54689.json';
import table54862 from '../lib/dbb/fixtures/table-54862.json';
import tableNotFound from '../lib/dbb/fixtures/table-not-found.json';
import team313036Matches from '../lib/dbb/fixtures/team-313036-matches.json';
import teamNotFound from '../lib/dbb/fixtures/team-not-found.json';

/**
 * The recorded answers: Team 313036's Spiele, its two Ligen's Tabellen,
 * one of its Spiele with a Kader-only Spielbericht, and the Spiele of the
 * adapter's cases (played with quarters and Spielerwerte, planned without
 * a Spielbericht, cancelled, forfeited).
 */
const RECORDINGS: ReadonlyArray<readonly [DbbRequest, unknown]> = [
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
  [{ kind: 'spielbericht', spielId: 2843814 }, boxscore2843814],
];

/** The recorded answers, by the path `dbbHttpRequest` builds for them. */
const RECORDED: ReadonlyMap<string, unknown> = new Map(
  RECORDINGS.map(([request, answer]) => [dbbHttpRequest(request).path, answer])
);

/** What the DBB answers for an id it does not know: status `"1"`. */
const NOT_FOUND: ReadonlyArray<readonly [RegExp, unknown]> = [
  [/^team\/id\/\d+\/matches$/, teamNotFound],
  [/^competition\/table\/id\/\d+$/, tableNotFound],
  [/^match\/id\/\d+\/matchInfo$/, matchinfoNotFound],
  [/^match\/id\/\d+\/boxscore$/, boxscoreNotFound],
];

/**
 * How the DBB answers a GET of `path` (relative to `DBB_BASE_URL`, as
 * `dbbHttpRequest` builds it), from the anonymised fixtures: the recording
 * of a recorded read, the DBB's not-found envelope for any other id of a
 * known read, and `undefined` for a read the fake does not know. For specs
 * and the app's e2e fake DBB server.
 */
export function fakeDbbAnswer(method: string, path: string): unknown {
  if (method !== 'GET') {
    return undefined;
  }
  return (
    RECORDED.get(path) ?? NOT_FOUND.find(([pattern]) => pattern.test(path))?.[1]
  );
}
