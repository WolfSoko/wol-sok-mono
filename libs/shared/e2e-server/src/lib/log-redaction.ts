/**
 * What an e2e test may print about the page into a CI log, which is public
 * on Nx Cloud: a URL keeps its origin and path, never credentials, query or
 * hash, since tokens and ids travel there.
 */

/** A word of a text: a URL never holds whitespace unencoded. */
const WORD = /\S+/g;

/**
 * Where a URL starts inside a word: an http(s) or ws(s) scheme, its slashes
 * also written as backslashes or JSON-escaped (`https:\/\/`), or a relative
 * URL, a `/` no letter, digit or `_` comes before (`/api`, `url:/api`,
 * `http:/host`; Angular names a relative request URL so on status 0).
 */
const URL_START = /(?:https?|wss?):(?:\\?[/\\]){2}|(?<!\w)\//i;

/**
 * Credentials (`//user:pass@`, its slashes written as `URL_START` takes
 * them), up to the last `@` before the path. They end at a quote or bracket
 * too, so an `@` further on in the word (`","b":"c@d"`) is no password.
 */
const CREDENTIALS = /(?:\\?[/\\]){2}[^/\\"'<>`]*@/g;

/** Where a query or hash starts. */
const QUERY_OR_HASH_START = /[?#]/;

/** `text` with every URL in it reduced to its origin and path. */
export function redactUrls(text: string): string {
  return text.replace(WORD, redactWord);
}

/**
 * `word` with everything from the first `?` or `#` after a URL's start cut
 * off: a query may hold any quote, bracket or punctuation unencoded (app code
 * prints raw URLs, even JSON in a query), so nothing after it in the word can
 * be told apart from it. A quote closing a URL with a query goes with it.
 */
function redactWord(word: string): string {
  const start = word.search(URL_START);
  if (start === -1) {
    return word;
  }
  const url = withoutQueryOrHash(word.slice(start));
  return word.slice(0, start) + url.replace(CREDENTIALS, '//');
}

/** `url` up to its first `?` or `#`; a single-character search stays linear. */
function withoutQueryOrHash(url: string): string {
  const start = url.search(QUERY_OR_HASH_START);
  return start === -1 ? url : url.slice(0, start);
}
