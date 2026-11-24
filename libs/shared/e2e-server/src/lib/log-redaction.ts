/**
 * What an e2e test may print about the page into a CI log, which is public
 * on Nx Cloud: a URL keeps its origin and path, never credentials, query or
 * hash, since tokens and ids travel there.
 */

/** Characters that end a URL's path, besides whitespace, `?` and `#`. */
const DELIMITERS = String.raw`"'<>${'`'}`;

/**
 * Where a URL starts: an http(s) or ws(s) scheme, its slashes also written
 * as backslashes or JSON-escaped (`https:\/\/`), or a relative URL, a `/` at
 * the start of a word (Angular names a relative request URL so on status 0).
 */
const URL_START = String.raw`(?:(?:https?|wss?):(?:\\?[/\\]){2}|(?<![^\s${DELIMITERS}(\[{=,])/)`;

/**
 * The path, up to whitespace, `?`, `#` or a delimiter. A delimiter followed
 * by a character a path goes on with (`it's`) belongs to it, so it cannot cut
 * a path in two and leave a query standing behind it.
 */
const URL_PATH = String.raw`(?:[^\s${DELIMITERS}?#]|[${DELIMITERS}](?![\s${DELIMITERS},;:.!)\]}]|$))*`;

/**
 * The query or hash, up to whitespace only: it may hold every delimiter and
 * punctuation unencoded (app code prints raw URLs, even JSON in a query, and
 * the browser leaves a backtick as it is), so the whole rest of the word goes
 * with it. A quote closing a URL with a query is lost with it, the accepted
 * cost of never printing a part of the query.
 */
const URL_QUERY_OR_HASH = String.raw`(?:[?#]\S*)?`;

/**
 * A URL inside a text. Each part reads every character once (its
 * alternatives exclude each other), so matching stays linear.
 */
const URL_IN_TEXT = new RegExp(URL_START + URL_PATH + URL_QUERY_OR_HASH, 'gi');

/** Credentials of a URL `new URL` refused, and where its query or hash starts. */
const CREDENTIALS = /\/\/[^/@]*@/;
const QUERY_OR_HASH_START = /[?#]/;

/** `url` without credentials, query and hash. */
export function urlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return withoutQueryOrHash(url).replace(CREDENTIALS, '//');
  }
}

/** `url` up to its first `?` or `#`; a single-character search stays linear. */
function withoutQueryOrHash(url: string): string {
  const start = url.search(QUERY_OR_HASH_START);
  return start === -1 ? url : url.slice(0, start);
}

/** `text` with every URL in it reduced as `urlForLog` does. */
export function redactUrls(text: string): string {
  return text.replace(URL_IN_TEXT, urlForLog);
}
