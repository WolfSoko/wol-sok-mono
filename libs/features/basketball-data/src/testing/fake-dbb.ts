import team313036Matches from '../lib/dbb/fixtures/team-313036-matches.json';
import teamNotFound from '../lib/dbb/fixtures/team-not-found.json';

/** One read the fake DBB answers from the recorded fixtures. */
interface FakeDbbRead {
  /** The DBB path, relative to `DBB_BASE_URL`, with the id captured. */
  readonly path: RegExp;
  /** The recorded answer per id. */
  readonly recorded: Readonly<Record<string, unknown>>;
  /** What the DBB answers for an id it does not know: status `"1"`. */
  readonly notFound: unknown;
}

const FAKE_DBB_READS: readonly FakeDbbRead[] = [
  {
    path: /^team\/id\/(\d+)\/matches$/,
    recorded: { '313036': team313036Matches },
    notFound: teamNotFound,
  },
];

/**
 * How the DBB answers a GET of `path` (relative to `DBB_BASE_URL`, as
 * `dbbHttpRequest` builds it), from the anonymised fixtures: the recording
 * of a recorded id, the DBB's not-found envelope for any other, and
 * `undefined` for a read the fake does not know. For specs and the app's
 * e2e fake DBB server.
 */
export function fakeDbbAnswer(method: string, path: string): unknown {
  if (method !== 'GET') {
    return undefined;
  }
  for (const read of FAKE_DBB_READS) {
    const id = read.path.exec(path)?.[1];
    if (id !== undefined) {
      return Object.hasOwn(read.recorded, id)
        ? read.recorded[id]
        : read.notFound;
    }
  }
  return undefined;
}
