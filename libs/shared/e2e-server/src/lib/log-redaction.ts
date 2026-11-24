/**
 * What an e2e test may print about the page into a CI log, which is public
 * on Nx Cloud: a URL keeps its origin and path, never credentials, query or
 * hash, since tokens and ids travel there.
 */

/**
 * An http(s) or ws(s) URL inside a text, up to the next whitespace. A quote,
 * an angle bracket or a backtick ends it only where the text goes on with
 * whitespace, punctuation or another of them (`","error":…`, `'>`, `` `, ``):
 * a query may hold each of them unencoded (app code writes raw URLs into
 * messages, and the browser leaves a backtick as it is), so ending at the
 * first one would leave the rest of the query in the log. Every character
 * either is or is not one of them, so matching stays linear.
 */
const URL_IN_TEXT =
  /(?:https?|wss?):\/\/(?:[^\s"'<>`]|["'<>`](?![\s"'<>`,;:.!?)\]}]|$))+/gi;

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
