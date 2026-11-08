import { dbbHttpRequest } from '../lib/dbb/dbb-request';
import team313036Matches from '../lib/dbb/fixtures/team-313036-matches.json';
import teamNotFound from '../lib/dbb/fixtures/team-not-found.json';

/** The recorded answers, by the path `dbbHttpRequest` builds for them. */
const RECORDED: ReadonlyMap<string, unknown> = new Map([
  [
    dbbHttpRequest({ kind: 'team-spiele', teamId: 313036 }).path,
    team313036Matches,
  ],
]);

/** What the DBB answers for an id it does not know: status `"1"`. */
const NOT_FOUND: ReadonlyArray<readonly [RegExp, unknown]> = [
  [/^team\/id\/\d+\/matches$/, teamNotFound],
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
