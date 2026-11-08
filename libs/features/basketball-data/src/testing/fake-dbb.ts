import { dbbHttpRequest, type DbbRequest } from '../lib/dbb/dbb-request';
import table54689 from '../lib/dbb/fixtures/table-54689.json';
import table54862 from '../lib/dbb/fixtures/table-54862.json';
import tableNotFound from '../lib/dbb/fixtures/table-not-found.json';
import team313036Matches from '../lib/dbb/fixtures/team-313036-matches.json';
import teamNotFound from '../lib/dbb/fixtures/team-not-found.json';

/** The recorded answers: Team 313036's Spiele and its two Ligen's Tabellen. */
const RECORDINGS: ReadonlyArray<readonly [DbbRequest, unknown]> = [
  [{ kind: 'team-spiele', teamId: 313036 }, team313036Matches],
  [{ kind: 'tabelle', ligaId: 54689 }, table54689],
  [{ kind: 'tabelle', ligaId: 54862 }, table54862],
];

/** The recorded answers, by the path `dbbHttpRequest` builds for them. */
const RECORDED: ReadonlyMap<string, unknown> = new Map(
  RECORDINGS.map(([request, answer]) => [dbbHttpRequest(request).path, answer])
);

/** What the DBB answers for an id it does not know: status `"1"`. */
const NOT_FOUND: ReadonlyArray<readonly [RegExp, unknown]> = [
  [/^team\/id\/\d+\/matches$/, teamNotFound],
  [/^competition\/table\/id\/\d+$/, tableNotFound],
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
