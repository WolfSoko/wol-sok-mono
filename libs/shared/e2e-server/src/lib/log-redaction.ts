/**
 * What an e2e test may print about the page into a CI log, which is public
 * on Nx Cloud: a URL keeps its origin and path, never credentials, query or
 * hash, since tokens and ids travel there.
 */

/**
 * An http(s) or ws(s) URL inside a text, up to the next whitespace, quote,
 * angle bracket or backtick, none of which a URL holds unencoded, so the
 * text after it (`","error":"timeout"}`) stays.
 */
const URL_IN_TEXT = /\b(?:https?|wss?):\/\/[^\s"'<>`]+/gi;

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
